import { useState, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceRecordButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceRecordButton({ onTranscript, disabled, className }: VoiceRecordButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClick = useCallback(async () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      setIsProcessing(true);
      
      // Simulate processing for now - will be replaced with actual speech-to-text
      setTimeout(() => {
        setIsProcessing(false);
        // For now, we'll add a placeholder. In production, this would be the transcribed text
      }, 500);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsRecording(true);
        // In production, we would start the actual recording here
        stream.getTracks().forEach(track => track.stop()); // Stop immediately for demo
      } catch (error) {
        console.error('Microphone access denied:', error);
      }
    }
  }, [isRecording, onTranscript]);

  return (
    <Button
      variant={isRecording ? "destructive" : "glow"}
      size="icon-lg"
      onClick={handleClick}
      disabled={disabled || isProcessing}
      className={cn(
        "relative transition-all duration-300",
        isRecording && "pulse-gentle",
        className
      )}
    >
      {isProcessing ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : isRecording ? (
        <MicOff className="w-6 h-6" />
      ) : (
        <Mic className="w-6 h-6" />
      )}
      
      {isRecording && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full animate-pulse" />
      )}
    </Button>
  );
}
