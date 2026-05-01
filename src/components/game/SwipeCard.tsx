import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { MasteryBucket } from '@/lib/mastery';
import { useSuccessSound } from '@/hooks/useSuccessSound';

interface SwipeCardProps {
  /** Front side (always shown). */
  front: string;
  /** Back side (shown after tap to reveal). */
  back: string;
  /** Hint above the front, e.g. "EN → JP". */
  topHint?: string;
  onSwipe: (answer: MasteryBucket) => void;
  /** Animation key — change to reset the card. */
  cardKey: string;
  /**
   * Optional source quote shown at the bottom of the English side, styled like
   * a famous quotation: "…sentence…" — MM,DD,YYYY
   */
  quote?: { text: string; date: string } | null;
  /** Which side ("en" / "jp") of the card the original quote should appear on. */
  quoteSide?: 'front' | 'back';
}

/**
 * A flick-able flashcard.
 *  - Tap to flip (front <-> back).
 *  - Drag left  -> ✕ "new"      (not learned)
 *  - Drag right -> 〇 "mastered"
 *  - Drag up    -> △ "learning" (fuzzy)
 */
export function SwipeCard({ front, back, topHint, onSwipe, cardKey, quote, quoteSide = 'front' }: SwipeCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const releasedRef = useRef(false);
  const { playMastered } = useSuccessSound();

  // Reset on new card.
  useEffect(() => {
    setFlipped(false);
    setPos(null);
    releasedRef.current = false;
  }, [cardKey]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (releasedRef.current) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    draggingRef.current = true;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !startRef.current) return;
    setPos({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y });
  };

  const decide = (dx: number, dy: number): MasteryBucket | null => {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const T = 90;
    if (absX < T && absY < T) return null;
    // Up wins only if it's clearly more vertical than horizontal AND upward.
    if (-dy > absX && -dy > T) return 'learning';
    if (dx > T && absX >= absY) return 'mastered';
    if (dx < -T && absX >= absY) return 'new';
    return null;
  };

  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (!pos || !startRef.current) {
      // Treat as tap → flip.
      setFlipped(f => !f);
      setPos(null);
      return;
    }
    const decided = decide(pos.x, pos.y);
    if (!decided) {
      setPos(null); // snap back
      return;
    }
    releasedRef.current = true;
    // Animate off-screen, then notify.
    const flyX = decided === 'mastered' ? 600 : decided === 'new' ? -600 : 0;
    const flyY = decided === 'learning' ? -700 : 0;
    setPos({ x: flyX, y: flyY });
    if (decided === 'mastered') playMastered();
    setTimeout(() => onSwipe(decided), 220);
  };

  const dx = pos?.x ?? 0;
  const dy = pos?.y ?? 0;
  const rot = dx / 18; // gentle rotation
  const transform = pos
    ? `translate(${dx}px, ${dy}px) rotate(${rot}deg)`
    : undefined;

  const guess = pos ? decide(dx, dy) : null;

  return (
    <div className="relative w-full aspect-[3/4] max-w-sm mx-auto select-none">
      {/* Decision overlays */}
      <div className={cn(
        'absolute top-6 left-6 px-3 py-1 rounded-full border-2 text-2xl font-black transition-opacity',
        'border-rose-400 text-rose-400',
        guess === 'new' ? 'opacity-100' : 'opacity-0'
      )}>
        ✕
      </div>
      <div className={cn(
        'absolute top-6 right-6 px-3 py-1 rounded-full border-2 text-2xl font-black transition-opacity',
        'border-emerald-400 text-emerald-400',
        guess === 'mastered' ? 'opacity-100' : 'opacity-0'
      )}>
        〇
      </div>
      <div className={cn(
        'absolute top-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full border-2 text-2xl font-black transition-opacity',
        'border-amber-400 text-amber-400',
        guess === 'learning' ? 'opacity-100' : 'opacity-0'
      )}>
        △
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform,
          transition: pos && draggingRef.current ? 'none' : 'transform 0.22s ease-out',
        }}
        className={cn(
          'absolute inset-0 rounded-3xl bg-card border border-border/70 shadow-2xl',
          'flex flex-col items-center justify-center p-6 cursor-grab active:cursor-grabbing',
          'touch-none'
        )}
      >
        {topHint && (
          <span className="absolute top-4 text-[10px] uppercase tracking-widest text-muted-foreground">
            {topHint}
          </span>
        )}
        <div className="flex-1 flex items-center justify-center text-center">
          <p className={cn(
            'text-2xl font-semibold leading-snug',
            flipped ? 'text-foreground' : 'text-primary'
          )}>
            {flipped ? back : front}
          </p>
        </div>
        {quote && ((quoteSide === 'front' && !flipped) || (quoteSide === 'back' && flipped)) && (
          <div className="w-full mt-3 px-1">
            <div className="border-t border-border/40 pt-3 text-center">
              <p className="text-[11px] italic text-muted-foreground/90 leading-snug font-serif">
                “{quote.text}”
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1 tracking-widest">
                —— {quote.date}
              </p>
            </div>
          </div>
        )}
        <span className="text-[10px] text-muted-foreground/70 mt-2">
          {flipped ? 'Tap to hide' : 'Tap to reveal'}
        </span>
      </div>
    </div>
  );
}
