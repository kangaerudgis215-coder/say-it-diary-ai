import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { normalizeText } from '@/lib/textComparison';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { cn } from '@/lib/utils';

interface ReadAloudPromptProps {
  englishText: string;
  japaneseText: string;
  onComplete: () => void;
  onSkip: () => void;
}

export function ReadAloudPrompt({ englishText, japaneseText, onComplete, onSkip }: ReadAloudPromptProps) {
  const [gaugeValue, setGaugeValue] = useState(0);
  const [passed, setPassed] = useState(false);
  const [showNice, setShowNice] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { playSuccess } = useSuccessSound();

  const { isListening, transcript, isSupported, startListening, stopListening, resetTranscript } =
    useSpeechRecognition({ lang: 'en-US' });

  // Check transcript accuracy against the full diary
  useEffect(() => {
    if (!isListening && transcript && !passed) {
      const userWords = normalizeText(transcript).split(' ').filter(w => w.length > 0);
      const targetWords = normalizeText(englishText).split(' ').filter(w => w.length > 0);
      
      if (targetWords.length === 0) return;
      
      // Count how many target words appear in user's speech
      const targetSet = new Set(targetWords);
      const matched = userWords.filter(w => targetSet.has(w)).length;
      const accuracy = matched / targetWords.length;
      
      if (accuracy >= 0.5) {
        setPassed(true);
        setShowNice(true);
        setGaugeValue(100);
        playSuccess();
        if (navigator.vibrate) navigator.vibrate(100);
        setTimeout(() => {
          setShowNice(false);
          onComplete();
        }, 1800);
      } else {
        // Partial progress
        setGaugeValue(Math.min(95, Math.round(accuracy * 100)));
      }
    }
  }, [isListening, transcript, englishText, passed, onComplete, playSuccess]);

  // Gauge animation while listening
  useEffect(() => {
    if (isListening && !passed) {
      intervalRef.current = setInterval(() => {
        setGaugeValue((prev) => Math.min(prev + 2, 80));
      }, 300);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isListening, passed]);

  const handleMicPress = useCallback(() => {
    if (passed) return;
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      setGaugeValue(0);
      startListening();
    }
  }, [isListening, passed, startListening, stopListening, resetTranscript]);

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      {/* Nice! overlay */}
      {showNice && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-5xl font-bold text-primary animate-bounce" style={{
            textShadow: '0 0 20px hsl(38 92% 60% / 0.6), 0 0 40px hsl(38 92% 60% / 0.3)',
          }}>
            Nice! ✨
          </div>
        </div>
      )}

      {/* Message */}
      <p className="text-lg font-semibold text-primary mb-6">🎤 声に出してみよう</p>

      {/* Full diary text */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4 w-full max-w-md">
        <p className="text-base leading-relaxed mb-4">{englishText}</p>
        <p className="text-sm text-muted-foreground font-japanese leading-relaxed">{japaneseText}</p>
      </div>

      {/* Gauge */}
      <div className="w-full max-w-md mb-8">
        <Progress 
          value={gaugeValue} 
          className={cn("h-3 transition-all", passed && "[&>div]:bg-primary")}
        />
        <p className="text-xs text-muted-foreground mt-1 text-center">
          {isListening ? '聞いています...' : gaugeValue > 0 && !passed ? 'もう一度話してみよう' : 'マイクボタンを押して話そう'}
        </p>
      </div>

      {/* Mic button */}
      <button
        onClick={handleMicPress}
        disabled={passed || !isSupported}
        className={cn(
          'w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 mb-6',
          isListening
            ? 'bg-destructive/20 shadow-lg shadow-destructive/20 animate-pulse'
            : 'bg-primary/20 hover:bg-primary/30 shadow-md',
          passed && 'opacity-50'
        )}
      >
        <Mic className={cn(
          'w-8 h-8',
          isListening ? 'text-destructive' : 'text-primary'
        )} />
      </button>

      {/* Skip */}
      <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
        <SkipForward className="w-4 h-4 mr-1" />
        スキップ
      </Button>
    </div>
  );
}
