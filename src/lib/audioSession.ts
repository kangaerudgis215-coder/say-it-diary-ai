type ScheduledKind = 'tap' | 'effect' | 'speech';

let micActive = false;
let mediaRouteReadyAt = 0;
let speechTicket = 0;
let speechActiveCount = 0;
let speechFreeAt = 0;

const EFFECT_AFTER_MIC_MS = 900;
const SPEECH_AFTER_MIC_MS = 750;
const EFFECT_AFTER_SPEECH_MS = 220;

// Effects/taps that arrived while speech was active. They are flushed in order
// once `markSpeechEnd` brings the active count back to zero (plus the small
// post-speech settle delay), so the success chime never gets clipped by an
// in-flight TTS utterance.
const pendingAfterSpeech: Array<() => void> = [];

function flushPendingAfterSpeech() {
  if (pendingAfterSpeech.length === 0) return;
  const wait = Math.max(0, speechFreeAt - now());
  const drain = () => {
    while (pendingAfterSpeech.length > 0) {
      const fn = pendingAfterSpeech.shift();
      try { fn?.(); } catch { /* no-op */ }
    }
  };
  if (wait <= 0) drain();
  else window.setTimeout(drain, wait);
}

function now() {
  return Date.now();
}

function waitMs(kind: ScheduledKind) {
  const base = kind === 'speech' ? SPEECH_AFTER_MIC_MS : EFFECT_AFTER_MIC_MS;
  const micWait = Math.max(0, mediaRouteReadyAt - now(), micActive ? base : 0);
  // Effects/taps should also wait until any in-flight TTS has fully released
  // the audio output, otherwise mobile/Bluetooth routes garble both streams.
  if (kind !== 'speech') {
    const speechWait = speechActiveCount > 0
      ? EFFECT_AFTER_SPEECH_MS
      : Math.max(0, speechFreeAt - now());
    return Math.max(micWait, speechWait);
  }
  return micWait;
}

export function markMicSessionActive() {
  micActive = true;
  mediaRouteReadyAt = Math.max(mediaRouteReadyAt, now() + EFFECT_AFTER_MIC_MS);
}

export function markMicSessionInactive(settleMs = EFFECT_AFTER_MIC_MS) {
  micActive = false;
  mediaRouteReadyAt = Math.max(mediaRouteReadyAt, now() + settleMs);
}

export function isMicAudioSessionActive() {
  return micActive;
}

export function markSpeechStart() {
  speechActiveCount += 1;
}

export function markSpeechEnd() {
  speechActiveCount = Math.max(0, speechActiveCount - 1);
  speechFreeAt = now() + EFFECT_AFTER_SPEECH_MS;
  if (speechActiveCount === 0) flushPendingAfterSpeech();
}

export function cancelQueuedSpeech() {
  speechTicket += 1;
  // Treat any pending speech as ended so queued effects/taps can fire.
  speechActiveCount = 0;
  speechFreeAt = now() + EFFECT_AFTER_SPEECH_MS;
  flushPendingAfterSpeech();
}

export function runWhenAudioRouteReady(kind: ScheduledKind, fn: () => void, options: { dropIfMicActive?: boolean } = {}) {
  if (options.dropIfMicActive && (micActive || waitMs(kind) > 0)) return false;
  // Effects/taps must wait for any in-flight speech to fully release the
  // audio output. Queue them and let `markSpeechEnd` drain the queue.
  if (kind !== 'speech' && speechActiveCount > 0) {
    const micWait = Math.max(0, mediaRouteReadyAt - now(), micActive ? EFFECT_AFTER_MIC_MS : 0);
    pendingAfterSpeech.push(() => {
      if (micWait > 0) window.setTimeout(fn, micWait);
      else fn();
    });
    return true;
  }
  const delay = waitMs(kind);
  if (delay <= 0) {
    fn();
    return true;
  }
  window.setTimeout(fn, delay);
  return true;
}

export function runSpeechWhenAudioRouteReady(fn: () => void) {
  const ticket = ++speechTicket;
  runWhenAudioRouteReady('speech', () => {
    if (ticket !== speechTicket) return;
    fn();
  });
}

const audioCache = new Map<string, HTMLAudioElement>();

export function getManagedAudio(src: string, volume: number) {
  if (typeof window === 'undefined') return null;
  let audio = audioCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = 'auto';
    audioCache.set(src, audio);
  }
  audio.volume = volume;
  return audio;
}

export function playManagedEffect(src: string, volume: number, kind: 'tap' | 'effect' = 'effect') {
  runWhenAudioRouteReady(kind, () => {
    try {
      const audio = getManagedAudio(src, volume);
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    } catch {
      /* no-op */
    }
  }, { dropIfMicActive: kind === 'tap' });
}