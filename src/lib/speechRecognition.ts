export interface SpeechRecognitionLike {
  start(): void;
  stop(): void;
  abort(): void;
}

/**
 * Module-level reference to the most recently started recognition session.
 * Lets global listeners (popstate, pagehide, etc.) and React-Router
 * navigation helpers force-release the mic even when the owning component
 * has already unmounted.
 */
let activeRecognition: SpeechRecognitionLike | null = null;
const pendingReleaseRecognitions = new Set<SpeechRecognitionLike>();

function safelyCall(rec: SpeechRecognitionLike, method: 'stop' | 'abort'): void {
  try {
    rec[method]();
  } catch {
    /* stale recognition session */
  }
}

function scheduleSafariReleaseFallback(rec: SpeechRecognitionLike, mode: 'stop' | 'abort'): void {
  if (typeof window === 'undefined') return;
  pendingReleaseRecognitions.add(rec);

  window.setTimeout(() => {
    safelyCall(rec, 'stop');
  }, 80);

  window.setTimeout(() => {
    safelyCall(rec, 'stop');
    if (mode === 'abort') safelyCall(rec, 'abort');
    pendingReleaseRecognitions.delete(rec);
  }, 260);
}

export function setActiveRecognition(rec: SpeechRecognitionLike | null): void {
  activeRecognition = rec;
}

export function clearActiveRecognition(rec: SpeechRecognitionLike): void {
  if (activeRecognition === rec) activeRecognition = null;
}

export function getActiveRecognition(): SpeechRecognitionLike | null {
  return activeRecognition;
}

export function hasActiveSpeechRecognition(): boolean {
  return Boolean(activeRecognition) || pendingReleaseRecognitions.size > 0;
}

export function forceReleaseActiveRecognition(): void {
  const recognitions = new Set(pendingReleaseRecognitions);
  if (activeRecognition) recognitions.add(activeRecognition);
  activeRecognition = null;
  recognitions.forEach((rec) => {
    safelyCall(rec, 'abort');
    safelyCall(rec, 'stop');
    scheduleSafariReleaseFallback(rec, 'abort');
  });
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
  // Safari can keep the system mic indicator alive if navigation happens in
  // the same tick as abort()/stop(). Hold the native instance briefly and retry
  // on later turns of the event loop so the AudioSession actually releases.
  scheduleSafariReleaseFallback(recognition, mode);
}

export async function releaseSpeechRecognitionBeforeNavigation(
  recognition: SpeechRecognitionLike | null | undefined,
): Promise<void> {
  if (!recognition && !hasActiveSpeechRecognition()) return;

  if (recognition) releaseSpeechRecognition(recognition, 'abort');
  forceReleaseActiveRecognition();

  // Do not navigate while Safari's delayed release taps are still running.
  // There is no browser API for the mic indicator state, so wait until every
  // scheduled abort/stop retry has completed before letting audio play elsewhere.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 650));
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
