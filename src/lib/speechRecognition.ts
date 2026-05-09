export interface SpeechRecognitionLike {
  start(): void;
  stop(): void;
  abort(): void;
  onstart?: ((...args: any[]) => void) | null;
  onend?: ((...args: any[]) => void) | null;
  onerror?: ((...args: any[]) => void) | null;
  onresult?: ((...args: any[]) => void) | null;
}

import { markMicSessionActive, markMicSessionInactive } from './audioSession';

/**
 * Module-level reference to the most recently started recognition session.
 * Lets global listeners (popstate, pagehide, etc.) and React-Router
 * navigation helpers force-release the mic even when the owning component
 * has already unmounted.
 */
let activeRecognition: SpeechRecognitionLike | null = null;

function safelyCall(rec: SpeechRecognitionLike, method: 'stop' | 'abort'): void {
  try {
    rec[method]();
  } catch {
    /* stale recognition session */
  }
}

export function setActiveRecognition(rec: SpeechRecognitionLike | null): void {
  activeRecognition = rec;
  if (rec) markMicSessionActive();
}

export function clearActiveRecognition(rec: SpeechRecognitionLike): void {
  if (activeRecognition === rec) activeRecognition = null;
}

export function getActiveRecognition(): SpeechRecognitionLike | null {
  return activeRecognition;
}

export function hasActiveSpeechRecognition(): boolean {
  return Boolean(activeRecognition);
}

export function forceReleaseActiveRecognition(): void {
  const rec = activeRecognition;
  activeRecognition = null;
  if (!rec) return;
  safelyCall(rec, 'abort');
  safelyCall(rec, 'stop');
  markMicSessionInactive();
}

/**
 * Simple, browser-native release. Earlier versions tried a WebKit-specific
 * "start then stop" trick to flush the audio route, but that itself triggered
 * spurious `audio-capture` ("マイクが見つかりません") errors on iOS Safari and
 * left the session in a worse state. Plain stop/abort is the most reliable.
 */
export function releaseSpeechRecognition(
  recognition: SpeechRecognitionLike | null | undefined,
  mode: 'stop' | 'abort' = 'stop',
): void {
  if (!recognition) return;
  if (activeRecognition === recognition) activeRecognition = null;
  safelyCall(recognition, mode);
  if (mode === 'abort') safelyCall(recognition, 'stop');
  markMicSessionInactive();
}

export async function releaseSpeechRecognitionBeforeNavigation(
  recognition: SpeechRecognitionLike | null | undefined,
): Promise<void> {
  if (!recognition && !hasActiveSpeechRecognition()) return;

  const rec = recognition ?? activeRecognition;
  activeRecognition = null;
  if (!rec) return;
  markMicSessionInactive(1000);

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      rec.onstart = null;
      rec.onend = null;
      rec.onerror = null;
      rec.onresult = null;
      resolve();
    };

    rec.onend = finish;
    rec.onerror = finish;
    safelyCall(rec, 'abort');
    safelyCall(rec, 'stop');
    window.setTimeout(finish, 900);
  });

  // Small settle window after WebKit fires `end`; avoids clipping the first
  // effect sound on the destination screen without touching the mic again.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
}

// Install a one-time global safety net so that browser back / tab hide /
// page unload always releases an active mic session, even if the owning
// React component never gets a chance to run its cleanup.
if (typeof window !== 'undefined' && !(window as any).__sokiMicGuardInstalled) {
  (window as any).__sokiMicGuardInstalled = true;
  const release = () => forceReleaseActiveRecognition();
  window.addEventListener('popstate', release);
  window.addEventListener('pagehide', release);
  window.addEventListener('beforeunload', release);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') release();
  });
}
