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

export function setActiveRecognition(rec: SpeechRecognitionLike | null): void {
  activeRecognition = rec;
}

export function getActiveRecognition(): SpeechRecognitionLike | null {
  return activeRecognition;
}

export function forceReleaseActiveRecognition(): void {
  const rec = activeRecognition;
  activeRecognition = null;
  if (!rec) return;
  // Safari sometimes ignores a single abort() — call abort then stop in
  // sequence so the audio route is always handed back to the system.
  try { rec.abort(); } catch { /* ignore */ }
  try { rec.stop(); } catch { /* ignore */ }
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
  try {
    if (mode === 'abort') {
      recognition.abort();
      // Safari: belt-and-suspenders — also call stop() so the underlying
      // AudioSession is definitely released even if abort() was a no-op.
      try { recognition.stop(); } catch { /* ignore */ }
    } else {
      recognition.stop();
    }
  } catch {
    /* stale recognition session */
  }
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
