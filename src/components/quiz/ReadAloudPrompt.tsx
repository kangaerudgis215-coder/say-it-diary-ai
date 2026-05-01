import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, SkipForward } from 'lucide-react';
import Lottie from 'lottie-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import voiceAnim from '@/assets/voice.json';
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
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { playSuccess } = useSuccessSound();

  const { isListening, transcript, isSupported, startListening, stopListening, resetTranscript } =
    useSpeechRecognition({ lang: 'en-US' });

  // Check transcript accuracy against the full diary. We watch the *interim*
  // transcript too so we can pass the user the moment they hit the threshold,
  // without waiting for the recogniser to finalise. This makes judgement feel
  // significantly snappier.
  const checkAccuracy = useCallback(
    (rawTranscript: string) => {
      if (passed) return;
      const userWords = normalizeText(rawTranscript).split(' ').filter((w) => w.length > 0);
      const targetWords = normalizeText(englishText).split(' ').filter((w) => w.length > 0);
      if (targetWords.length === 0) return;

      const targetSet = new Set(targetWords);
      const matched = userWords.filter((w) => targetSet.has(w)).length;
      const accuracy = matched / targetWords.length;

      // Lower threshold + early exit for a much snappier feel.
      if (accuracy >= 0.35) {
        setPassed(true);
        setShowNice(true);
        setShowSuccessAnim(true);
        setGaugeValue(100);
        playSuccess();
        if (navigator.vibrate) navigator.vibrate(100);
        // Stop listening immediately — no need to keep the mic open.
        if (isListening) stopListening();
        setTimeout(() => {
          setShowNice(false);
          setShowSuccessAnim(false);
          onComplete();
        }, 1200);
      } else {
        setGaugeValue(Math.min(95, Math.round(accuracy * 100)));
      }
    },
    [englishText, passed, playSuccess, onComplete, isListening, stopListening],
  );

  // Re-check on every transcript / interim update for fast judgement.
  useEffect(() => {
    if (passed) return;
    if (transcript || (isListening && (window as any))) {
      checkAccuracy(transcript);
    }
  }, [transcript, isListening, passed, checkAccuracy]);

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
          'relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 mb-6',
          isListening
            ? 'bg-primary/15 ring-2 ring-primary/50'
            : 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-primary/50',
          passed && 'opacity-50'
        )}
      >
        {!isListening && (
          <span className="absolute inset-0 rounded-full bg-primary/30 blur-xl -z-10" />
        )}
        {isListening ? (
          <Lottie
            animationData={voiceAnim}
            loop
            autoplay
            style={{ width: 160, height: 160 }}
          />
        ) : (
          <Mic style={{ width: 72, height: 72 }} />
        )}

        {/* Success animation overlaid on top of the mic for a triumphant moment. */}
        {showSuccessAnim && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <DotLottieReact
              src="/anim/success-2.lottie"
              autoplay
              loop={false}
              style={{ width: 240, height: 240 }}
            />
          </div>
        )}
      </button>

      {/* Skip */}
      <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
        <SkipForward className="w-4 h-4 mr-1" />
        スキップ
      </Button>
    </div>
  );
}
