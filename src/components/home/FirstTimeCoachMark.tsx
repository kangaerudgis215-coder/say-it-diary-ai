import { useEffect, useState } from 'react';

/**
 * Full-screen coach mark shown to brand-new users with no diary entries.
 * Dims the screen, draws an arrow pointing to the pencil FAB, and shows
 * a cat-style speech bubble inviting them to write today's diary.
 * Dismisses on any tap.
 */
export function FirstTimeCoachMark({ onDismiss }: { onDismiss?: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay so the layout settles and the animation feels intentional.
    const t = setTimeout(() => setVisible(true), 350);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss?.(), 200);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="日記を書いてみよう"
      onClick={handleDismiss}
      className="fixed inset-0 z-[60] bg-background/70 backdrop-blur-[2px] animate-fade-in cursor-pointer"
    >
      {/* Spotlight ring around the pen FAB (FAB is bottom-right, w-14 h-14, right-5, bottom-[88px]) */}
      <div
        className="absolute"
        style={{ right: '0.65rem', bottom: '78px' }}
      >
        <div className="w-[72px] h-[72px] rounded-full ring-4 ring-primary animate-pulse shadow-[0_0_40px_12px_hsl(var(--primary)/0.6)]" />
      </div>

      {/* Curved arrow pointing toward the FAB */}
      <svg
        className="absolute"
        style={{ right: '90px', bottom: '120px' }}
        width="120"
        height="100"
        viewBox="0 0 120 100"
        fill="none"
      >
        <path
          d="M10 20 Q 60 10 90 70"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          strokeDasharray="5 6"
        />
        <path
          d="M82 60 L 92 72 L 78 74"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {/* Cat speech bubble */}
      <div
        className="absolute max-w-[260px] animate-scale-in"
        style={{ right: '24px', bottom: '230px' }}
      >
        <div className="relative bg-card border border-primary/40 text-foreground rounded-2xl px-4 py-3 shadow-xl">
          <p className="text-sm font-medium leading-snug">
            🐱 はじめまして！
          </p>
          <p className="text-sm text-muted-foreground mt-1 leading-snug">
            まずはここをタップして、<br />
            今日の日記をかいてみるにゃ ✏️
          </p>
          {/* Bubble tail */}
          <div
            className="absolute -bottom-2 right-10 w-4 h-4 rotate-45 bg-card border-r border-b border-primary/40"
          />
        </div>
      </div>

      {/* Dismiss hint */}
      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
        タップで閉じる
      </p>
    </div>
  );
}