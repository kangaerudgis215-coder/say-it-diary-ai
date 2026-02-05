/**
 * Unified 3-step practice flow:
 *   1. Per-sentence cloze (key expression)
 *   2. Per-sentence full sentence
 *   3. Full diary recall + correction log
 */
import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ClozeQuiz } from '@/components/ClozeQuiz';
import { FullSentenceStep } from './FullSentenceStep';
import { FullDiaryStep } from './FullDiaryStep';
import { CorrectionLog } from './CorrectionLog';
import { PracticeSentence } from '@/lib/practiceBuilder';
import { cn } from '@/lib/utils';

type FlowPhase = 'cloze' | 'full_sentence' | 'full_diary' | 'correction_log';

interface SentencePracticeFlowProps {
  sentences: PracticeSentence[];
  japaneseSummary: string;
  englishDiary: string;
  onComplete: (userAttempt: string, accuracy: number, usedExprs: string[], missedExprs: string[]) => void;
  onBack: () => void;
  title?: string;
  subtitle?: string;
}

export function SentencePracticeFlow({
  sentences,
  japaneseSummary,
  englishDiary,
  onComplete,
  onBack,
  title = 'Sentence Practice',
  subtitle,
}: SentencePracticeFlowProps) {
  const [phase, setPhase] = useState<FlowPhase>('cloze');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [clozeCleared, setClozeCleared] = useState<Set<number>>(new Set());
  const [fullSentenceCleared, setFullSentenceCleared] = useState<Set<number>>(new Set());
  // Diary result
  const [diaryResult, setDiaryResult] = useState<{
    attempt: string;
    accuracy: number;
    used: string[];
    missed: string[];
  } | null>(null);

  const totalSentences = sentences.length;

  const progress = useMemo(() => {
    // 0-60% for cloze, 60-90% for full sentence, 90-100% for diary
    if (phase === 'correction_log') return 100;
    if (phase === 'full_diary') return 95;
    const clozeP = (clozeCleared.size / totalSentences) * 60;
    const fullP = (fullSentenceCleared.size / totalSentences) * 30;
    return Math.round(clozeP + fullP);
  }, [phase, clozeCleared.size, fullSentenceCleared.size, totalSentences]);

  const currentSentence = sentences[currentIndex] ?? null;

  // ----- Cloze handlers -----
  const handleClozeComplete = useCallback(
    (_attemptText: string, _score: number, _passed: boolean) => {
      // All cloze done; move to full-sentence for the first sentence
      setClozeCleared(new Set(sentences.map((_, i) => i)));
      setCurrentIndex(0);
      setPhase('full_sentence');
    },
    [sentences]
  );

  // ----- Full sentence handlers -----
  const handleFullSentenceBack = useCallback(() => {
    // Go back to cloze for this sentence (reset cleared so user re-does)
    setPhase('cloze');
  }, []);

  const handleFullSentenceNext = useCallback(() => {
    setFullSentenceCleared((prev) => new Set([...prev, currentIndex]));
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // All full sentences done, proceed to diary
      setPhase('full_diary');
    }
  }, [currentIndex, sentences.length]);

  // ----- Full diary handlers -----
  const handleFullDiaryComplete = useCallback(
    (attempt: string, accuracy: number, used: string[], missed: string[]) => {
      setDiaryResult({ attempt, accuracy, used, missed });
      setPhase('correction_log');
    },
    []
  );

  const handleRetryDiary = useCallback(() => {
    setDiaryResult(null);
    setPhase('full_diary');
  }, []);

  const handleBackToSentences = useCallback(() => {
    setDiaryResult(null);
    setCurrentIndex(0);
    setFullSentenceCleared(new Set());
    setPhase('full_sentence');
  }, []);

  const handleDone = useCallback(() => {
    if (diaryResult) {
      onComplete(diaryResult.attempt, diaryResult.accuracy, diaryResult.used, diaryResult.missed);
    } else {
      onComplete('', 0, [], []);
    }
  }, [diaryResult, onComplete]);

  // ----- Render -----

  // Correction log
  if (phase === 'correction_log' && diaryResult) {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={handleRetryDiary}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-xl">Correction Log</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </header>
        <CorrectionLog
          sentences={sentences}
          userAttempt={diaryResult.attempt}
          usedExpressions={diaryResult.used}
          missedExpressions={diaryResult.missed}
          accuracy={diaryResult.accuracy}
          onRetry={handleRetryDiary}
          onBackToSentences={handleBackToSentences}
          onDone={handleDone}
        />
      </div>
    );
  }

  // Full diary
  if (phase === 'full_diary') {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={handleBackToSentences}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-xl">Full Diary Recall</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </header>

        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Step 3: Full diary</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex-1">
          <FullDiaryStep
            japaneseSummary={japaneseSummary}
            englishDiary={englishDiary}
            expressions={sentences.flatMap((s) => s.expressions)}
            onBack={handleBackToSentences}
            onComplete={handleFullDiaryComplete}
          />
        </div>
      </div>
    );
  }

  // Full sentence step
  if (phase === 'full_sentence' && currentSentence) {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={handleFullSentenceBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-xl">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </header>

        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Sentence {currentIndex + 1} of {totalSentences} — Step 2: Full sentence</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mb-4">
          {['cloze', 'full_sentence', 'full_diary'].map((s, i) => (
            <div
              key={s}
              className={cn(
                'w-2 h-2 rounded-full',
                s === phase ? 'bg-primary' : i < 1 ? 'bg-primary/40' : 'bg-muted'
              )}
            />
          ))}
        </div>

        <div className="flex-1">
          <FullSentenceStep
            english={currentSentence.english}
            japanese={currentSentence.japanese}
            expressions={currentSentence.expressions}
            onBack={handleFullSentenceBack}
            onNext={handleFullSentenceNext}
          />
        </div>
      </div>
    );
  }

  // Cloze step (default)
  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      <header className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-xl">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </header>

      <div className="flex-1">
        <ClozeQuiz sentences={sentences} onComplete={handleClozeComplete} />
      </div>
    </div>
  );
}
