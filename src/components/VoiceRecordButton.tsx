import { Mic } from 'lucide-react';
import Lottie from 'lottie-react';
import voiceAnim from '@/assets/voice.json';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

interface VoiceRecordButtonProps {
  onTranscript: (text: string) => void;
  /** Tailwind size for the button. Defaults to a large, centered mic. */
  className?: string;
  /** Pixel size of the mic icon / lottie. */
  iconSize?: number;
}

export function VoiceRecordButton({
  onTranscript,
  className,
  iconSize = 72,
}: VoiceRecordButtonProps) {
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
    <button
      type="button"
      onClick={handleClick}
      aria-label={isListening ? 'Stop recording' : 'Start recording'}
      className={cn(
        'relative inline-flex items-center justify-center rounded-full shrink-0',
        'transition-all duration-200 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isListening
          ? 'bg-primary/15 ring-2 ring-primary/50'
          : 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-primary/50',
        className,
      )}
    >
      {/* Glow ring when idle */}
      {!isListening && (
        <span className="absolute inset-0 rounded-full bg-primary/30 blur-xl -z-10" />
      )}
      {isListening ? (
        <Lottie
          animationData={voiceAnim}
          loop
          autoplay
          style={{ width: iconSize * 1.6, height: iconSize * 1.6 }}
        />
      ) : (
        <Mic style={{ width: iconSize, height: iconSize }} />
      )}
    </button>
  );
}
