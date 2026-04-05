import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

interface VoiceRecordButtonProps {
  onTranscript: (text: string) => void;
}

export function VoiceRecordButton({ onTranscript }: VoiceRecordButtonProps) {
  const { isListening, transcript, isSupported, startListening, stopListening, resetTranscript } =
    useSpeechRecognition();

  useEffect(() => {
    if (!isListening && transcript) {
      onTranscript(transcript);
      resetTranscript();
    }
  }, [isListening, transcript, onTranscript, resetTranscript]);

  if (!isSupported) return null;

  const handleClick = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className={cn(
        'rounded-full w-12 h-12 shrink-0',
        isListening && 'bg-destructive/20 animate-pulse'
      )}
    >
      {isListening ? (
        <MicOff className="w-5 h-5 text-destructive" />
      ) : (
        <Mic className="w-5 h-5 text-primary" />
      )}
    </Button>
  );
}
