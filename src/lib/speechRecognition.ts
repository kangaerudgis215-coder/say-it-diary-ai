export interface SpeechRecognitionLike {
  start(): void;
  stop(): void;
  abort(): void;
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
  try {
    if (mode === 'abort') recognition.abort();
    else recognition.stop();
  } catch {
    /* stale recognition session */
  }
}
