import { useState, useCallback, useEffect, useRef } from 'react';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StarParticles } from './StarParticles';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { Button } from '@/components/ui/button';

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

type WordItem = { word: string; origIdx: number };

export function WordReorderQuiz({ sentence, japaneseSentence, onCorrect }: WordReorderQuizProps) {
  const correctWords = sentence.match(/[\w'']+[.,!?;:]*|[.,!?;:]+/g) || sentence.split(/\s+/);

  const [shuffled] = useState(() => {
    let s = shuffleArray(correctWords.map((w, i) => ({ word: w, origIdx: i })));
    while (s.length > 1 && s.every((item, idx) => item.origIdx === idx)) {
      s = shuffleArray(correctWords.map((w, i) => ({ word: w, origIdx: i })));
    }
    return s;
  });

  const [placed, setPlaced] = useState<WordItem[]>([]);
  const [available, setAvailable] = useState<WordItem[]>(shuffled);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isWrong, setIsWrong] = useState(false);
  const [hintIndex, setHintIndex] = useState<number | null>(null);
  const [showNice, setShowNice] = useState(false);
  const { playSuccess } = useSuccessSound();

  // Touch drag state for reordering placed words
  const touchDragRef = useRef<{
    idx: number;
    startX: number;
    startY: number;
    el: HTMLElement | null;
    clone: HTMLElement | null;
    moved: boolean;
  } | null>(null);
  const placedContainerRef = useRef<HTMLDivElement>(null);
  const placedRefs = useRef<(HTMLElement | null)[]>([]);

  const handleTapAvailable = useCallback((item: WordItem) => {
    if (isCorrect) return;
    setIsWrong(false);
    setHintIndex(null);
    setPlaced((prev) => [...prev, item]);
    setAvailable((prev) => prev.filter((x) => x !== item));
  }, [isCorrect]);

  const handleTapPlaced = useCallback((item: WordItem, idx: number) => {
    if (isCorrect) return;
    setIsWrong(false);
    setHintIndex(null);
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
        if (navigator.vibrate) navigator.vibrate(100);
        setTimeout(() => {
          setShowNice(false);
          onCorrect();
        }, 2000);
      } else {
        setIsWrong(true);
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      }
    }
  }, [placed, correctWords, isCorrect, onCorrect, playSuccess]);

  // Hint button: find the first incorrect position and highlight next correct word
  const handleHint = () => {
    if (isCorrect) return;
    // Find first wrong position in placed
    let firstWrongIdx = -1;
    for (let i = 0; i < placed.length; i++) {
      if (placed[i].origIdx !== i) {
        firstWrongIdx = i;
        break;
      }
    }
    if (firstWrongIdx === -1 && placed.length < correctWords.length) {
      // All placed so far are correct, hint the next one needed
      const nextOrigIdx = placed.length;
      // Find in available
      const availIdx = available.findIndex(a => a.origIdx === nextOrigIdx);
      if (availIdx !== -1) {
        setHintIndex(nextOrigIdx);
      }
    } else if (firstWrongIdx >= 0) {
      // Highlight which origIdx should be at firstWrongIdx
      setHintIndex(firstWrongIdx);
    }
    // Auto-clear hint after 3 seconds
    setTimeout(() => setHintIndex(null), 3000);
  };

  const handleRetry = () => {
    setAvailable([...available, ...placed]);
    setPlaced([]);
    setIsWrong(false);
    setHintIndex(null);
  };

  // Touch drag handlers for mobile reordering of placed words
  const handlePlacedTouchStart = (idx: number, e: React.TouchEvent) => {
    if (isCorrect) return;
    const touch = e.touches[0];
    const el = placedRefs.current[idx];
    touchDragRef.current = {
      idx,
      startX: touch.clientX,
      startY: touch.clientY,
      el,
      clone: null,
      moved: false,
    };
  };

  const handlePlacedTouchMove = (e: React.TouchEvent) => {
    const state = touchDragRef.current;
    if (!state || !state.el) return;
    const touch = e.touches[0];
    const dx = touch.clientX - state.startX;
    const dy = touch.clientY - state.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 8) {
      state.moved = true;
      e.preventDefault();

      // Create floating clone on first move
      if (!state.clone) {
        const rect = state.el.getBoundingClientRect();
        const clone = state.el.cloneNode(true) as HTMLElement;
        clone.style.position = 'fixed';
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.zIndex = '9999';
        clone.style.pointerEvents = 'none';
        clone.style.opacity = '0.9';
        clone.style.transform = 'scale(1.05)';
        document.body.appendChild(clone);
        state.clone = clone;
        state.el.style.opacity = '0.3';
      }

      state.clone.style.left = `${touch.clientX - state.clone.offsetWidth / 2}px`;
      state.clone.style.top = `${touch.clientY - state.clone.offsetHeight / 2}px`;
    }
  };

  const handlePlacedTouchEnd = (idx: number, e: React.TouchEvent) => {
    const state = touchDragRef.current;
    if (!state) return;

    if (state.el) state.el.style.opacity = '1';
    if (state.clone) {
      document.body.removeChild(state.clone);
    }

    if (!state.moved) {
      // It was a tap, remove word
      handleTapPlaced(placed[idx], idx);
      touchDragRef.current = null;
      return;
    }

    // Find drop target
    const touch = e.changedTouches[0];
    let dropIdx = -1;
    for (let i = 0; i < placedRefs.current.length; i++) {
      const ref = placedRefs.current[i];
      if (!ref || i === state.idx) continue;
      const rect = ref.getBoundingClientRect();
      if (touch.clientX >= rect.left && touch.clientX <= rect.right && touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        dropIdx = i;
        break;
      }
    }

    if (dropIdx >= 0 && dropIdx !== state.idx) {
      setIsWrong(false);
      setHintIndex(null);
      setPlaced((prev) => {
        const arr = [...prev];
        const [dragged] = arr.splice(state.idx, 1);
        arr.splice(dropIdx, 0, dragged);
        return arr;
      });
    }

    touchDragRef.current = null;
  };

  // Desktop drag handlers
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => {
    if (isCorrect) return;
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    setIsWrong(false);
    setHintIndex(null);
    setPlaced((prev) => {
      const newPlaced = [...prev];
      const [dragged] = newPlaced.splice(dragIdx, 1);
      newPlaced.splice(idx, 0, dragged);
      return newPlaced;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="flex flex-col h-full" onTouchMove={handlePlacedTouchMove as any}>
      <StarParticles active={isCorrect} />

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
      <div
        ref={placedContainerRef}
        className={cn(
          'min-h-[120px] rounded-xl border-2 border-dashed p-3 mb-4 flex flex-wrap gap-2 content-start transition-all duration-300',
          isCorrect && 'border-primary bg-primary/10 animate-pulse',
          isWrong && 'border-destructive/50 bg-destructive/5',
          !isCorrect && !isWrong && 'border-border bg-card/50'
        )}
      >
        {placed.length === 0 && (
          <p className="text-sm text-muted-foreground/50 w-full text-center mt-8">
            下のカードをタップして並べよう
          </p>
        )}
        {placed.map((item, idx) => {
          const isDragging = dragIdx === idx;
          const isDragOver = dragOverIdx === idx;
          return (
            <button
              key={`placed-${idx}-${item.origIdx}`}
              ref={(el) => { placedRefs.current[idx] = el; }}
              onClick={() => handleTapPlaced(item, idx)}
              draggable={!isCorrect}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handlePlacedTouchStart(idx, e)}
              onTouchEnd={(e) => handlePlacedTouchEnd(idx, e)}
              disabled={isCorrect}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 cursor-grab touch-none',
                isCorrect && 'bg-primary/20 text-primary border border-primary/30',
                !isCorrect && 'bg-muted text-foreground border border-border hover:bg-muted/80',
                isDragging && 'opacity-40 scale-90',
                isDragOver && 'border-primary border-2',
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

      {/* Hint + Wrong message row */}
      <div className="flex items-center justify-between mb-4 min-h-[32px]">
        {isWrong ? (
          <>
            <p className="text-sm text-destructive">順番が違うよ。ヒントを見て再挑戦！</p>
            <button onClick={handleRetry} className="text-xs text-primary underline">やり直す</button>
          </>
        ) : (
          <div className="flex-1" />
        )}
        {!isCorrect && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 gap-1 text-xs text-muted-foreground"
            onClick={handleHint}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            ヒント
          </Button>
        )}
      </div>

      {/* Word cards */}
      <div className="flex flex-wrap gap-2 justify-center mt-auto">
        {available.map((item, idx) => {
          const isHinted = hintIndex !== null && item.origIdx === hintIndex;
          return (
            <button
              key={`avail-${idx}-${item.origIdx}`}
              onClick={() => handleTapAvailable(item)}
              className={cn(
                'px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200',
                'bg-card border-border text-foreground shadow-sm',
                'active:scale-90',
                isHinted && 'ring-2 ring-primary border-primary bg-primary/10 animate-pulse'
              )}
            >
              {item.word}
            </button>
          );
        })}
      </div>
    </div>
  );
}
