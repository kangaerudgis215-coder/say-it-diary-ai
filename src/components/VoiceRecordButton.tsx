import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface VoiceRecordButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
  size?: 'default' | 'large';
}

// Web Speech API type definitions
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

export function VoiceRecordButton({ onTranscript, disabled, className, size = 'default' }: VoiceRecordButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const { toast } = useToast();

  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      setIsProcessing(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setIsProcessing(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      setIsProcessing(false);
      
      let message = 'Voice input failed. Please try again.';
      if (event.error === 'not-allowed') {
        message = 'Microphone access denied. Please allow microphone access.';
      } else if (event.error === 'no-speech') {
        message = 'No speech detected. Please try speaking again.';
      } else if (event.error === 'network') {
        message = 'Network error. Please check your connection.';
      }
      
      toast({
        variant: 'destructive',
        title: 'Voice Input Error',
        description: message,
      });
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        onTranscript(finalTranscript.trim());
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [isSupported, onTranscript, toast]);

  const handleClick = useCallback(async () => {
    if (!isSupported) {
      toast({
        variant: 'destructive',
        title: 'Not Supported',
        description: 'Voice input is not supported in your browser. Please use Chrome or Edge.',
      });
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsProcessing(true);
        recognitionRef.current?.start();
      } catch (error) {
        console.error('Microphone access denied:', error);
        toast({
          variant: 'destructive',
          title: 'Microphone Access Denied',
          description: 'Please allow microphone access to use voice input.',
        });
      }
    }
  }, [isRecording, isSupported, toast]);

  const isLarge = size === 'large';

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isProcessing}
      className={cn(
        "relative transition-all duration-300 flex items-center justify-center rounded-full",
        isLarge ? "w-24 h-24" : "w-14 h-14",
        isRecording 
          ? "bg-destructive text-destructive-foreground pulse-gentle" 
          : "bg-primary text-primary-foreground",
        !isRecording && "shadow-glow hover:shadow-glow-lg hover:scale-105",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {isProcessing ? (
        <Loader2 className={cn("animate-spin", isLarge ? "w-10 h-10" : "w-6 h-6")} />
      ) : isRecording ? (
        <MicOff className={cn(isLarge ? "w-10 h-10" : "w-6 h-6")} />
      ) : (
        <Mic className={cn(isLarge ? "w-10 h-10" : "w-6 h-6")} />
      )}
      
      {isRecording && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full animate-pulse" />
      )}
    </button>
  );
}
