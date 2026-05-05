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
  const listeningRef = useRef(false);
  const hasSpeechRef = useRef(false);
  
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
      hardStopTimerRef.current = setTimeout(() => {
        listeningRef.current = false;
        setIsListening(false);
        releaseSpeechRecognition(recognition, 'abort');
      }, 8000);
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
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
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
        setTranscript(prev => prev + (prev ? ' ' : '') + finalTranscript.trim());
        setInterimTranscript('');
      } else {
        if (currentInterim.trim().length > 0) hasSpeechRef.current = true;
        setInterimTranscript(currentInterim);
      }
      // Any speech activity resets the silence timer.
      armSilenceTimer();
    };

    recognitionRef.current = recognition;

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (hardStopTimerRef.current) clearTimeout(hardStopTimerRef.current);
      releaseSpeechRecognition(recognition, 'abort');
    };
  }, [continuous, interimResults, lang, isSupported, autoStopSilenceMs]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setInterimTranscript('');
      try {
        setActiveRecognition(recognitionRef.current);
        recognitionRef.current.start();
      } catch (error) {
        setActiveRecognition(null);
        console.error('Failed to start speech recognition:', error);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition && listeningRef.current) {
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
