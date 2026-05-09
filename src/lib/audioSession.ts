type ScheduledKind = 'tap' | 'effect' | 'speech';

let micActive = false;
let mediaRouteReadyAt = 0;
let speechTicket = 0;

const EFFECT_AFTER_MIC_MS = 900;
const SPEECH_AFTER_MIC_MS = 750;

function now() {
  return Date.now();
}

function waitMs(kind: ScheduledKind) {
  const base = kind === 'speech' ? SPEECH_AFTER_MIC_MS : EFFECT_AFTER_MIC_MS;
  return Math.max(0, mediaRouteReadyAt - now(), micActive ? base : 0);
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

export function cancelQueuedSpeech() {
  speechTicket += 1;
}

export function runWhenAudioRouteReady(kind: ScheduledKind, fn: () => void, options: { dropIfMicActive?: boolean } = {}) {
  if (options.dropIfMicActive && (micActive || waitMs(kind) > 0)) return false;
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