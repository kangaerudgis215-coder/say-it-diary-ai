/**
 * Diary text-to-speech helper.
 *
 * Two problems this solves:
 *
 * 1. **iOS Safari volume routing.** `speechSynthesis` is normally routed to
 *    the system "ringer" channel on iOS, so the hardware volume rocker has
 *    no effect while the diary is being read aloud. The well-known workaround
 *    is to keep a silent media element playing in parallel: that pins the
 *    output to the media channel, which the volume rocker controls. We start
 *    the silent track on `speak()` and stop it on `cancel()` / `onend`.
 *
 * 2. **Cross-screen interference with sound effects.** `speechSynthesis` and
 *    the `<audio>`-based sound effects can briefly fight over the output
 *    device on mobile, which is why the success chime sometimes dropped right
 *    after a single-word TTS played. Calling `cancelDiaryTTS()` before any
 *    chime guarantees the channel is free.
 */

import { registerUnlockable } from './audioUnlock';

// Tiny ~0.5s silent WAV (mono, 8kHz). Loops to keep the media channel hot.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YQAAAAA=';

let silentAudio: HTMLAudioElement | null = null;
function ensureSilent() {
  if (typeof window === 'undefined') return null;
  if (silentAudio) return silentAudio;
  try {
    const a = new Audio(SILENT_WAV);
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0.001; // effectively silent but non-zero so iOS keeps routing
    registerUnlockable(a);
    silentAudio = a;
    return a;
  } catch {
    return null;
  }
}

function startSilent() {
  const a = ensureSilent();
  if (!a) return;
  try {
    if (a.paused) void a.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

function stopSilent() {
  const a = silentAudio;
  if (!a) return;
  try {
    a.pause();
    a.currentTime = 0;
  } catch {
    /* ignore */
  }
}

export interface DiarySpeakOptions {
  rate?: number;
  onEnd?: () => void;
  onError?: () => void;
}

export function speakDiary(text: string, opts: DiarySpeakOptions = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const ss = window.speechSynthesis;
  try { ss.cancel(); } catch { /* ignore */ }

  startSilent();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = opts.rate ?? 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const cleanup = () => {
    stopSilent();
  };
  utterance.onend = () => {
    cleanup();
    opts.onEnd?.();
  };
  utterance.onerror = () => {
    cleanup();
    opts.onError?.();
  };
  try {
    ss.resume();
    ss.speak(utterance);
  } catch {
    cleanup();
  }
}

export function cancelDiaryTTS() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
  stopSilent();
}