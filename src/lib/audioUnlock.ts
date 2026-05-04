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
    // Speaking a near-silent space inside the gesture flips the engine into
    // the "user-activated" state so subsequent post-async speak() calls work.
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

function doUnlock() {
  if (unlocked) return;
  unlocked = true;
  registry.forEach(primeOne);
  unlockSpeech();
}

export function registerUnlockable(audio: HTMLAudioElement | null | undefined) {
  if (!audio) return;
  registry.add(audio);
  if (unlocked) primeOne(audio);
}

export function isAudioUnlocked() {
  return unlocked;
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