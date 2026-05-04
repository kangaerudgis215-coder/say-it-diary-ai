import { useState, useCallback, useRef, useEffect } from 'react';

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
  const { continuous = true, interimResults = true, lang = 'en-US', autoStopSilenceMs } = options;
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
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
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        try {
          recognition.stop();
        } catch {
          /* ignore */
        }
      }, autoStopSilenceMs);
    };

    recognition.onstart = () => {
      setIsListening(true);
      armSilenceTimer();
      if (hardStopTimerRef.current) clearTimeout(hardStopTimerRef.current);
      hardStopTimerRef.current = setTimeout(() => {
        try {
          recognition.stop();
        } catch {
          /* ignore */
        }
      }, 15000);
    };

    recognition.onend = () => {
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

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
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
        setTranscript(prev => prev + (prev ? ' ' : '') + finalTranscript.trim());
        setInterimTranscript('');
      } else {
        setInterimTranscript(currentInterim);
      }
      // Any speech activity resets the silence timer.
      armSilenceTimer();
    };

    recognitionRef.current = recognition;

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (hardStopTimerRef.current) clearTimeout(hardStopTimerRef.current);
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    };
  }, [continuous, interimResults, lang, isSupported, autoStopSilenceMs]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setInterimTranscript('');
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

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
