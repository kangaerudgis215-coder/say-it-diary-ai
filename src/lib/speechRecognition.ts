export interface SpeechRecognitionLike {
  start(): void;
  stop(): void;
  abort(): void;
}

function isAppleWebKitBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Apple/i.test(navigator.vendor || '') || /iPad|iPhone|iPod/.test(ua);
}

/**
 * WebKit can leave the system microphone session active after a plain stop/abort.
 * Starting once immediately before stop is the safest known release path on iOS Safari.
 */
export function releaseSpeechRecognition(
  recognition: SpeechRecognitionLike | null | undefined,
  mode: 'stop' | 'abort' = 'stop',
): void {
  if (!recognition) return;

  if (isAppleWebKitBrowser()) {
    try {
      recognition.start();
    } catch {
      /* already started or already ending */
    }
    try {
      recognition.stop();
    } catch {
      /* stale recognition session */
    }
    return;
  }

  try {
    if (mode === 'abort') recognition.abort();
    else recognition.stop();
  } catch {
    /* stale recognition session */
  }
}
