import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { StarParticles } from './StarParticles';
import { useSuccessSound } from '@/hooks/useSuccessSound';

interface WordReorderQuizProps {
  sentence: string;
  japaneseSentence: string;
  onCorrect: () => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function WordReorderQuiz({ sentence, japaneseSentence, onCorrect }: WordReorderQuizProps) {
  // Tokenize: keep punctuation attached to words
  const correctWords = sentence.match(/[\w'']+[.,!?;:]*|[.,!?;:]+/g) || sentence.split(/\s+/);

  const [shuffled] = useState(() => {
    let s = shuffleArray(correctWords.map((w, i) => ({ word: w, origIdx: i })));
    // Ensure it's not already in order
    while (s.length > 1 && s.every((item, idx) => item.origIdx === idx)) {
      s = shuffleArray(correctWords.map((w, i) => ({ word: w, origIdx: i })));
    }
    return s;
  });

  const [placed, setPlaced] = useState<Array<{ word: string; origIdx: number }>>([]);
  const [available, setAvailable] = useState(shuffled);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isWrong, setIsWrong] = useState(false);
  const [hintIndices, setHintIndices] = useState<Set<number>>(new Set());
  const [showNice, setShowNice] = useState(false);
  const { playSuccess } = useSuccessSound();

  const handleTapAvailable = useCallback((item: { word: string; origIdx: number }) => {
    if (isCorrect) return;
    setIsWrong(false);
    setHintIndices(new Set());
    setPlaced((prev) => [...prev, item]);
    setAvailable((prev) => prev.filter((x) => x !== item));
  }, [isCorrect]);

  const handleTapPlaced = useCallback((item: { word: string; origIdx: number }, idx: number) => {
    if (isCorrect) return;
    setIsWrong(false);
    setHintIndices(new Set());
    setPlaced((prev) => prev.filter((_, i) => i !== idx));
    setAvailable((prev) => [...prev, item]);
  }, [isCorrect]);

  // Check answer when all words are placed
  useEffect(() => {
    if (placed.length === correctWords.length && !isCorrect) {
      const userSentence = placed.map((p) => p.word).join(' ');
      const target = correctWords.join(' ');
      if (userSentence === target) {
        setIsCorrect(true);
        setShowNice(true);
        playSuccess();
        // Vibrate
        if (navigator.vibrate) navigator.vibrate(100);
        setTimeout(() => {
          setShowNice(false);
          onCorrect();
        }, 2000);
      } else {
        setIsWrong(true);
        // Vibrate short for wrong
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        // Show hint: color-code the first few correct positions
        const hints = new Set<number>();
        for (let i = 0; i < correctWords.length; i++) {
          if (placed[i]?.origIdx === i) {
            hints.add(i);
          } else {
            // Show hint for the first wrong position + 1 more
            hints.add(i);
            if (i + 1 < correctWords.length) hints.add(i + 1);
            break;
          }
        }
        setHintIndices(hints);
      }
    }
  }, [placed, correctWords, isCorrect, onCorrect, playSuccess]);

  const handleRetry = () => {
    // Return all placed words to available
    setAvailable([...available, ...placed]);
    setPlaced([]);
    setIsWrong(false);
    setHintIndices(new Set());
  };

  return (
    <div className="flex flex-col h-full">
      <StarParticles active={isCorrect} />

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

      {/* Japanese prompt */}
      <div className="bg-secondary/30 rounded-xl p-4 mb-6">
        <p className="text-xs text-muted-foreground mb-1">この文を英語に並び替えよう</p>
        <p className="text-base font-japanese leading-relaxed">{japaneseSentence}</p>
      </div>

      {/* Answer area */}
      <div className={cn(
        'min-h-[120px] rounded-xl border-2 border-dashed p-3 mb-6 flex flex-wrap gap-2 content-start transition-all duration-300',
        isCorrect && 'border-primary bg-primary/10 animate-pulse',
        isWrong && 'border-destructive/50 bg-destructive/5',
        !isCorrect && !isWrong && 'border-border bg-card/50'
      )}>
        {placed.length === 0 && (
          <p className="text-sm text-muted-foreground/50 w-full text-center mt-8">
            下のカードをタップして並べよう
          </p>
        )}
        {placed.map((item, idx) => {
          const isHinted = hintIndices.has(idx);
          const isInCorrectPos = placed[idx]?.origIdx === idx;
          return (
            <button
              key={`placed-${idx}-${item.origIdx}`}
              onClick={() => handleTapPlaced(item, idx)}
              disabled={isCorrect}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95',
                isCorrect && 'bg-primary/20 text-primary border border-primary/30',
                isWrong && isHinted && isInCorrectPos && 'bg-accent/20 text-accent-foreground border border-accent/40',
                isWrong && isHinted && !isInCorrectPos && 'bg-destructive/10 text-destructive border border-destructive/30',
                !isCorrect && !isWrong && 'bg-muted text-foreground border border-border hover:bg-muted/80',
                !isHinted && isWrong && 'bg-muted text-foreground border border-border',
              )}
              style={isCorrect ? {
                animation: `wave 0.6s ease-in-out ${idx * 0.05}s`,
                boxShadow: '0 0 12px hsl(38 92% 60% / 0.4)',
              } : undefined}
            >
              {item.word}
            </button>
          );
        })}
      </div>

      {/* Wrong message + retry */}
      {isWrong && (
        <div className="flex items-center justify-between mb-4 animate-fade-in">
          <p className="text-sm text-destructive">順番が違うよ。ヒントを見て再挑戦！</p>
          <button
            onClick={handleRetry}
            className="text-xs text-primary underline"
          >
            やり直す
          </button>
        </div>
      )}

      {/* Word cards */}
      <div className="flex flex-wrap gap-2 justify-center mt-auto">
        {available.map((item, idx) => (
          <button
            key={`avail-${idx}-${item.origIdx}`}
            onClick={() => handleTapAvailable(item)}
            className={cn(
              'px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200',
              'bg-card border-border text-foreground shadow-sm',
              'hover:bg-primary/10 hover:border-primary/30 hover:shadow-md',
              'active:scale-90'
            )}
          >
            {item.word}
          </button>
        ))}
      </div>
    </div>
  );
}
