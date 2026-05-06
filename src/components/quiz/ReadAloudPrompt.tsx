import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Mic, SkipForward, Check } from 'lucide-react';
import Lottie from 'lottie-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import voiceAnim from '@/assets/voice.json';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { normalizeText } from '@/lib/textComparison';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { cn } from '@/lib/utils';
import { cancelDiaryTTS } from '@/lib/diaryTTS';
import { stopAssistantSpeech } from '@/lib/assistantSpeech';
import { forceReleaseActiveRecognition } from '@/lib/speechRecognition';

interface ReadAloudPromptProps {
  englishText: string;
  japaneseText: string;
  onComplete: () => void;
  onSkip: () => void;
  /**
   * Optional list of "key expressions" used by the diary. When provided,
   * the 穴抜き mode masks these phrases inside the English text so the
   * learner has to recall them while reading aloud.
   */
  expressions?: string[];
}

type DifficultyMode = 'normal' | 'blank' | 'hidden';

/**
 * Read-aloud / 暗唱 step. Three difficulty modes:
 *   - normal: full English + JP shown
 *   - blank:  汎用表現が ＿＿ に置き換わる + 日本語訳全文表示
 *   - hidden: 英文を完全に隠して日本語訳のみ表示（暗唱）
 *
 * Critically: judgement is *passive*. The mic stays open until the user
 * explicitly taps "読み終わった". We never auto-stop the mic mid-reading.
 */
export function ReadAloudPrompt({
  englishText,
  japaneseText,
  onComplete,
  onSkip,
  expressions = [],
}: ReadAloudPromptProps) {
  const [gaugeValue, setGaugeValue] = useState(0);
  const [passed, setPassed] = useState(false);
  const [showNice, setShowNice] = useState(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const [mode, setMode] = useState<DifficultyMode>('normal');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { playSuccess } = useSuccessSound();

  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({ lang: 'en-US', continuous: true, autoRestart: true });

  /** Build the English text with key expressions masked for 穴抜き mode. */
  const blankedEnglish = useMemo(() => {
    if (!expressions.length) return englishText;
    let out = englishText;
    const sorted = [...expressions].filter(Boolean).sort((a, b) => b.length - a.length);
    for (const exp of sorted) {
      const escaped = exp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${escaped}\\b`, 'gi');
      out = out.replace(re, '＿＿＿');
    }
    return out;
  }, [englishText, expressions]);

  /**
   * Passive accuracy update: only nudges the gauge based on coverage.
   * Never triggers completion — the user controls that explicitly.
   */
  const updateGauge = useCallback(
    (rawTranscript: string) => {
      if (passed) return;
      const userWords = normalizeText(rawTranscript).split(' ').filter((w) => w.length > 0);
      const targetWords = normalizeText(englishText).split(' ').filter((w) => w.length > 0);
      if (targetWords.length === 0) return;

      let cursor = 0;
      let orderedMatches = 0;
      for (const word of userWords) {
        const nextIdx = targetWords.indexOf(word, cursor);
        if (nextIdx >= 0) {
          orderedMatches += 1;
          cursor = nextIdx + 1;
        }
      }
      const coverage = orderedMatches / targetWords.length;
      setGaugeValue(Math.min(98, Math.round(coverage * 100)));
    },
    [englishText, passed],
  );

  useEffect(() => {
    if (passed) return;
    const combined = `${transcript} ${interimTranscript}`.trim();
    if (combined) updateGauge(combined);
  }, [transcript, interimTranscript, passed, updateGauge]);

  // Subtle gauge "breathing" while listening, even before any words come in.
  useEffect(() => {
    if (isListening && !passed) {
      intervalRef.current = setInterval(() => {
        setGaugeValue((prev) => Math.min(prev + 1, 60));
      }, 400);
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
      cancelDiaryTTS();
      stopAssistantSpeech();
      resetTranscript();
      setGaugeValue(0);
      startListening();
    }
  }, [isListening, passed, startListening, stopListening, resetTranscript]);

  /** User explicitly declares they've finished reading. */
  const handleDonePress = useCallback(() => {
    if (passed) return;
    if (isListening) stopListening();
    // Make absolutely sure the mic / audio session is released BEFORE we
    // play the success chime. Otherwise iOS keeps the device in
    // "communication mode" and the chime is routed to the phone speaker
    // even when Bluetooth earphones are connected.
    forceReleaseActiveRecognition();
    setPassed(true);
    setShowNice(true);
    setShowSuccessAnim(true);
    setGaugeValue(100);
    // Wait a bit longer so the OS has time to tear down the recognition
    // audio session and re-route audio back to the Bluetooth output.
    window.setTimeout(() => playSuccess(), 450);
    if (navigator.vibrate) navigator.vibrate(100);
    setTimeout(() => {
      setShowNice(false);
      setShowSuccessAnim(false);
      onComplete();
    }, 1500);
  }, [isListening, passed, playSuccess, onComplete, stopListening]);

  const showEnglish = mode !== 'hidden';
  const displayedEnglish = mode === 'blank' ? blankedEnglish : englishText;

  const modeOptions: { v: DifficultyMode; label: string; disabled?: boolean }[] = [
    { v: 'normal', label: '通常' },
    { v: 'blank', label: '穴抜き', disabled: expressions.length === 0 },
    { v: 'hidden', label: '全文隠す' },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      {showNice && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div
            className="text-5xl font-bold text-primary animate-bounce"
            style={{
              textShadow:
                '0 0 20px hsl(38 92% 60% / 0.6), 0 0 40px hsl(38 92% 60% / 0.3)',
            }}
          >
            Nice! ✨
          </div>
        </div>
      )}

      <p className="text-lg font-semibold text-primary mb-3">🎤 声に出してみよう</p>

      {/* Difficulty selector */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-full bg-muted">
        {modeOptions.map((opt) => (
          <button
            key={opt.v}
            type="button"
            disabled={opt.disabled}
            onClick={() => setMode(opt.v)}
            className={cn(
              'px-3 py-1.5 text-xs rounded-full transition-all font-japanese',
              mode === opt.v
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              opt.disabled && 'opacity-40 cursor-not-allowed',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Diary text */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4 w-full max-w-md">
        {showEnglish ? (
          <p className="text-base leading-relaxed mb-4 whitespace-pre-wrap">
            {displayedEnglish}
          </p>
        ) : (
          <p className="text-sm text-center text-muted-foreground italic mb-4 py-3 font-japanese">
            英文は隠れています。日本語を見て暗唱しましょう。
          </p>
        )}
        <p className="text-sm text-muted-foreground font-japanese leading-relaxed">
          {japaneseText}
        </p>
      </div>

      {/* Gauge */}
      <div className="w-full max-w-md mb-6">
        <Progress
          value={gaugeValue}
          className={cn('h-3 transition-all', passed && '[&>div]:bg-primary')}
        />
        <p className="text-xs text-muted-foreground mt-1 text-center font-japanese">
          {isListening
            ? '聞いています…読み終えたら下の「読み終わった」を押してください'
            : gaugeValue > 0 && !passed
            ? '続きから話せます'
            : 'マイクボタンを押して話そう'}
        </p>
      </div>

      {/* Mic */}
      <button
        onClick={handleMicPress}
        disabled={passed || !isSupported}
        className={cn(
          'relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 mb-4',
          isListening
            ? 'bg-primary/15 ring-2 ring-primary/50'
            : 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-primary/50',
          passed && 'opacity-50',
        )}
      >
        {!isListening && (
          <span className="absolute inset-0 rounded-full bg-primary/30 blur-xl -z-10" />
        )}
        {isListening ? (
          <Lottie animationData={voiceAnim} loop autoplay style={{ width: 128, height: 128 }} />
        ) : (
          <Mic style={{ width: 56, height: 56 }} />
        )}
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

      {/* Done — manual completion */}
      <Button
        variant="glow"
        size="lg"
        onClick={handleDonePress}
        disabled={passed}
        className="gap-2 mb-2 px-6 font-japanese"
      >
        <Check className="w-5 h-5" />
        読み終わった
      </Button>

      <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
        <SkipForward className="w-4 h-4 mr-1" />
        スキップ
      </Button>
    </div>
  );
}
