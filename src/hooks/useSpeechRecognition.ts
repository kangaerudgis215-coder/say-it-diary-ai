import { useState, useCallback, useRef, useEffect } from 'react';
import { clearActiveRecognition, releaseSpeechRecognition, setActiveRecognition } from '@/lib/speechRecognition';

interface UseSpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  /**
   * If set, automatically stop the recogniser after this many ms of silence
   * (no new interim or final results). Useful for "speak then auto-send" flows
   * so the user doesn't have to tap the mic again to stop recording.
   */
  autoStopSilenceMs?: number;
  /** Optional safety limit. Leave unset for long read-aloud flows. */
  hardStopMs?: number;
  /** Restart if the browser ends recognition unexpectedly during an active read. */
  autoRestart?: boolean;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

// Web Speech API type definition
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { continuous = true, interimResults = true, lang = 'en-US', autoStopSilenceMs, hardStopMs, autoRestart = false } = options;
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeningRef = useRef(false);
  const shouldRestartRef = useRef(false);
  const hasSpeechRef = useRef(false);
  // Throttle restart loop. The Web Speech API on desktop Chrome often emits
  // `network` / `no-speech` / `aborted` errors several times per minute even
  // on a healthy connection. Unbounded auto-restart turns that into a
  // visible "マイクが切れた" / "ネットワークエラー" loop.
  const consecutiveErrorsRef = useRef(0);
  const lastErrorAtRef = useRef(0);
  const micWarmedRef = useRef(false);
  
  // Check for browser support
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();
    
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    const armSilenceTimer = () => {
      if (!autoStopSilenceMs) return;
      // Don't auto-stop until the user has actually spoken at least once.
      // Otherwise the mic gets killed before they get a chance to start.
      if (!hasSpeechRef.current) return;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        listeningRef.current = false;
        setIsListening(false);
        // abort() frees the underlying audio session faster than stop(),
        // which is critical on mobile to prevent the OS from keeping the
        // device in "communication mode" (Bluetooth re-routing, broken
        // volume rocker, etc.).
        releaseSpeechRecognition(recognition, 'abort');
      }, autoStopSilenceMs);
    };

    recognition.onstart = () => {
      listeningRef.current = true;
      hasSpeechRef.current = false;
      setIsListening(true);
      if (hardStopTimerRef.current) clearTimeout(hardStopTimerRef.current);
      if (hardStopMs) {
        hardStopTimerRef.current = setTimeout(() => {
          shouldRestartRef.current = false;
          listeningRef.current = false;
          setIsListening(false);
          releaseSpeechRecognition(recognition, 'abort');
        }, hardStopMs);
      }
    };

    recognition.onend = () => {
      listeningRef.current = false;
      clearActiveRecognition(recognition);
      setIsListening(false);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (hardStopTimerRef.current) {
        clearTimeout(hardStopTimerRef.current);
        hardStopTimerRef.current = null;
      }
      if (autoRestart && shouldRestartRef.current && document.visibilityState === 'visible') {
        window.setTimeout(() => {
          if (!shouldRestartRef.current || listeningRef.current) return;
          try {
            setActiveRecognition(recognition);
            recognition.start();
          } catch (error) {
            shouldRestartRef.current = false;
            console.error('Failed to restart speech recognition:', error);
          }
        }, 180);
      }
    };

    recognition.onerror = (event) => {
      const err = event.error;
      // Permission / hardware: stop trying.
      if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture') {
        shouldRestartRef.current = false;
      }
      // Transient: count consecutive failures and back off. After 3 fast
      // failures in a row we stop auto-restarting so the user gets a calm
      // idle mic instead of a flashing error.
      if (err === 'network' || err === 'no-speech' || err === 'aborted') {
        const now = Date.now();
        if (now - lastErrorAtRef.current < 4000) {
          consecutiveErrorsRef.current += 1;
        } else {
          consecutiveErrorsRef.current = 1;
        }
        lastErrorAtRef.current = now;
        if (consecutiveErrorsRef.current >= 3) {
          shouldRestartRef.current = false;
        }
      } else {
        // Real error worth surfacing once in the console.
        // eslint-disable-next-line no-console
        console.error('Speech recognition error:', err);
      }
      listeningRef.current = false;
      clearActiveRecognition(recognition);
      setIsListening(false);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (hardStopTimerRef.current) {
        clearTimeout(hardStopTimerRef.current);
        hardStopTimerRef.current = null;
      }
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          currentInterim += result[0].transcript;
        }
      }

      if (finalTranscript) {
        hasSpeechRef.current = true;
        consecutiveErrorsRef.current = 0;
        setTranscript(prev => prev + (prev ? ' ' : '') + finalTranscript.trim());
        setInterimTranscript('');
      } else {
        if (currentInterim.trim().length > 0) {
          hasSpeechRef.current = true;
          consecutiveErrorsRef.current = 0;
        }
        setInterimTranscript(currentInterim);
      }
      // Any speech activity resets the silence timer.
      armSilenceTimer();
    };

    recognitionRef.current = recognition;

    return () => {
      shouldRestartRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (hardStopTimerRef.current) clearTimeout(hardStopTimerRef.current);
      releaseSpeechRecognition(recognition, 'abort');
    };
  }, [continuous, interimResults, lang, isSupported, autoStopSilenceMs, hardStopMs, autoRestart]);

  const startListening = useCallback(async () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setInterimTranscript('');
      consecutiveErrorsRef.current = 0;
      lastErrorAtRef.current = 0;
      // Warm the audio capture stack with proper constraints. This gives
      // the OS a chance to enable AGC / noise suppression before the Web
      // Speech API grabs the mic — noticeably improves desktop sensitivity
      // and reduces spurious `no-speech` events.
      if (!micWarmedRef.current && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          // Release immediately — we only wanted the OS-level warm-up.
          stream.getTracks().forEach((t) => t.stop());
          micWarmedRef.current = true;
        } catch {
          /* permission denied or unsupported — fall through */
        }
      }
      try {
        shouldRestartRef.current = autoRestart;
        setActiveRecognition(recognitionRef.current);
        recognitionRef.current.start();
      } catch (error) {
        shouldRestartRef.current = false;
        setActiveRecognition(null);
        console.error('Failed to start speech recognition:', error);
      }
    }
  }, [isListening, autoRestart]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition && listeningRef.current) {
      shouldRestartRef.current = false;
      listeningRef.current = false;
      setIsListening(false);
      // Use abort() so the OS releases the mic / audio session immediately.
      // stop() lets the engine finalise results which can keep the device in
      // "communication mode" for several seconds, breaking volume control
      // and triggering Bluetooth re-routing on mobile.
      releaseSpeechRecognition(recognition, 'abort');
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
