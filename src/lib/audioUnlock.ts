/**
 * Global audio "unlock" helper.
 *
 * Browsers (especially iOS Safari and Chrome with strict autoplay policies)
 * silently block `audio.play()` and `speechSynthesis.speak()` calls that
 * happen outside a direct user gesture — for example, a chime triggered
 * after a long `await` or after a navigation to a new screen.
 *
 * The fix is to "prime" every audio element and the speech-synthesis
 * pipeline once, inside the very first user gesture of the session.
 * Afterwards, plays from any context (including post-async / post-route)
 * are allowed.
 *
 * Usage:
 *   1. Call `installAudioUnlock()` once at app boot (App.tsx).
 *   2. Hooks/components that own a preloaded `<audio>` element call
 *      `registerUnlockable(audioEl)` so it gets primed on first gesture.
 */

const registry = new Set<HTMLAudioElement>();
let unlocked = false;
let installed = false;
let sharedAudioContext: AudioContext | null = null;

// Sounds to eagerly decode at unlock time. Pre-decoding lets the very
// first tap play with zero perceived latency (otherwise the first press
// of the session lagged by ~1 frame while the buffer was being decoded).
const EAGER_BUFFER_SOURCES = [
  '/sounds/tap.mp3',
  '/sounds/correct.mp3',
  '/sounds/diary-complete.mp3',
  '/sounds/flashcard-correct.mp3',
];

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = globalThis.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new AudioContextClass();
    } catch {
      return null;
    }
  }
  return sharedAudioContext;
}

function unlockWebAudio() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    void ctx.resume();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    /* ignore */
  }
}

function primeOne(a: HTMLAudioElement) {
  try {
    // Silent warm-up only: load buffers so the first real play() is snappy.
    // We must NOT call play() here (even muted) — on some mobile browsers a
    // muted-then-unmuted prime can leak an audible blip, which was firing the
    // "correct" chime when the Chat screen mounted on a past diary.
    // HTMLAudio's autoplay policy is satisfied as long as the document has
    // received any user gesture, which is what `installAudioUnlock` ensures.
    a.load();
  } catch {
    /* no-op */
  }
}

function unlockSpeech() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.resume();
    // iOS Safari unlock requirements (known quirks):
    //   - utterance text must be non-empty (a single space is dropped)
    //   - volume must be > 0 (volume:0 is treated as "did not actually speak"
    //     and the engine stays in the locked state)
    //   - the speak() call must run synchronously inside the user gesture
    // We use a very short, very quiet, very fast utterance so the user
    // effectively can't hear it but the engine flips into the
    // "user-activated" state and post-async speak() calls are allowed.
    const u = new SpeechSynthesisUtterance('.');
    u.volume = 0.01;
    u.rate = 10; // max rate — finishes almost instantly
    u.pitch = 1;
    u.lang = 'en-US';
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

function doUnlock() {
  if (unlocked) return;
  unlocked = true;
  registry.forEach(primeOne);
  ['/sounds/tap.mp3', '/sounds/correct.mp3', '/sounds/diary-complete.mp3', '/sounds/flashcard-correct.mp3']
    .forEach((src) => {
      try {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.load();
      } catch {
        /* no-op */
      }
    });
  unlockWebAudio();
  unlockSpeech();
  // Pre-decode commonly-used effect buffers so the first plays are snappy.
  // Imported lazily to avoid a circular dep at module load.
  import('./audioSession').then(({ preloadEffectBuffer }) => {
    EAGER_BUFFER_SOURCES.forEach((src) => preloadEffectBuffer(src));
  }).catch(() => { /* no-op */ });
}

export function registerUnlockable(audio: HTMLAudioElement | null | undefined) {
  if (!audio) return;
  registry.add(audio);
  if (unlocked) primeOne(audio);
}

export function isAudioUnlocked() {
  return unlocked;
}

export function getUnlockedAudioContext() {
  return getAudioContext();
}

export function installAudioUnlock() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const handler = () => {
    doUnlock();
  };
  const opts: AddEventListenerOptions = { once: false, capture: true, passive: true };
  // Multiple gesture types — first one wins, then we self-remove.
  const events: (keyof WindowEventMap)[] = ['pointerdown', 'touchstart', 'mousedown', 'keydown'];
  const wrapped = () => {
    handler();
    events.forEach((e) => window.removeEventListener(e, wrapped, true));
  };
  events.forEach((e) => window.addEventListener(e, wrapped, opts));
}

/**
 * Manual audio recovery — for when sound effects silently stop working
 * (typical iOS Safari / Bluetooth route bugs) while TTS keeps playing.
 * Called from a user gesture (the 🔊 reset button in Home header).
 *
 * Resumes the shared AudioContext, drops cached audio elements, re-primes
 * the unlock pipeline, then plays a short confirmation chime so the user
 * can hear that output is back.
 */
export async function resetAudioPipeline(): Promise<boolean> {
  try {
    // 1. Resume / re-create AudioContext if it's suspended.
    const ctx = getAudioContext();
    if (ctx) {
      try { await ctx.resume(); } catch { /* no-op */ }
    }
    // 2. Forget any cached <audio> elements — they can wedge after
    //    route switches on iOS.
    registry.clear();
    // 3. Re-prime unlock so future plays from any context work.
    unlocked = false;
    doUnlock();
    return true;
  } catch {
    return false;
  }
}