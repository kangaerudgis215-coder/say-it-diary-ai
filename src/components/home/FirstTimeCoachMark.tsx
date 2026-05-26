import { useEffect, useState } from 'react';

type Pos = { cx: number; cy: number; r: number };

interface Step {
  /** Target description used to compute the spotlight position. */
  target: 'pen' | 'help' | 'theme' | 'cat';
  title: string;
  body: string;
  /** Bubble placement preference relative to viewport. */
  bubble: { top?: string; bottom?: string; left?: string; right?: string };
}

const STEPS: Step[] = [
  {
    target: 'pen',
    title: '🐱 はじめまして！',
    body: 'まずは右下のペンをタップして、今日の日記をかいてみるにゃ ✏️',
    bubble: { right: '24px', bottom: '230px' },
  },
  {
    target: 'help',
    title: '❓ 困ったらここ',
    body: 'ヘルプアイコンから使い方やフローをいつでも見られるにゃ。',
    bubble: { top: '80px', right: '16px' },
  },
  {
    target: 'theme',
    title: '🌙 昼と夜を切り替え',
    body: '右上のボタンでダーク／ライトモードをトグルできるにゃ〜',
    bubble: { top: '80px', right: '16px' },
  },
  {
    target: 'cat',
    title: '🐾 SO-KIがいるよ',
    body: 'カレンダー上の猫キャラが日記の内容に反応してくれるにゃ。書いたらまた覗いてみて！',
    bubble: { top: '300px', left: '16px', right: '16px' },
  },
];

function computePos(target: Step['target']): Pos {
  const W = window.innerWidth;
  const H = window.innerHeight;
  switch (target) {
    case 'pen':
      // FAB: right-5 (20px), bottom-[88px], w-14 h-14 (56px)
      return { cx: W - 20 - 28, cy: H - 88 - 28, r: 44 };
    case 'theme':
      // Header: rightmost icon button (~40px wide), px-5 padding.
      return { cx: W - 20 - 20, cy: 20 + 20, r: 26 };
    case 'help':
      // Third from right: theme (rightmost) + audio + help → ~120px from right edge.
      return { cx: W - 20 - 100, cy: 20 + 20, r: 26 };
    case 'cat':
      // CatBuddy lives in the streak hero, right column. Approximate.
      return { cx: W - 90, cy: 160, r: 60 };
  }
}

/**
 * Multi-step onboarding tour shown to brand-new users with no diary entries.
 * Uses a CSS mask cutout so the highlighted UI stays perfectly crisp
 * (no blur over the target), and walks through: ✏️ pen FAB → ❓ help →
 * 🌙 theme toggle → 🐾 SO-KI cat. Tap the dimmed area or the next button
 * to advance; the final tap dismisses.
 */
export function FirstTimeCoachMark({ onDismiss }: { onDismiss?: () => void }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<Pos>(() =>
    typeof window !== 'undefined' ? computePos('pen') : { cx: 0, cy: 0, r: 40 },
  );

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setPos(computePos(STEPS[step].target));
    const onResize = () => setPos(computePos(STEPS[step].target));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [step]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss?.(), 200);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      handleDismiss();
    }
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleDismiss();
  };

  if (!visible) return null;

  const current = STEPS[step];
  // Build a radial-gradient mask that punches a transparent hole around the target.
  const mask = `radial-gradient(circle at ${pos.cx}px ${pos.cy}px, transparent ${pos.r}px, black ${pos.r + 2}px)`;

  return (
    <div
      role="dialog"
      aria-label="アプリの使い方ツアー"
      onClick={handleNext}
      className="fixed inset-0 z-[60] animate-fade-in cursor-pointer"
    >
      {/* Dimmed backdrop with a crisp cutout around the highlighted target */}
      <div
        className="absolute inset-0 bg-background/75"
        style={{
          WebkitMaskImage: mask,
          maskImage: mask,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          transition: 'mask-image 300ms ease, -webkit-mask-image 300ms ease',
        }}
      />

      {/* Spotlight ring around the target */}
      <div
        className="absolute pointer-events-none rounded-full ring-4 ring-primary animate-pulse"
        style={{
          left: pos.cx - pos.r,
          top: pos.cy - pos.r,
          width: pos.r * 2,
          height: pos.r * 2,
          boxShadow: '0 0 40px 12px hsl(var(--primary) / 0.6)',
        }}
      />

      {/* Speech bubble */}
      <div
        className="absolute max-w-[280px] animate-scale-in"
        style={current.bubble}
      >
        <div className="relative bg-card border border-primary/40 text-foreground rounded-2xl px-4 py-3 shadow-xl">
          <p className="text-sm font-semibold leading-snug font-japanese">{current.title}</p>
          <p className="text-sm text-muted-foreground mt-1 leading-snug font-japanese">
            {current.body}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              {step + 1} / {STEPS.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSkip}
                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1"
              >
                スキップ
              </button>
              <button
                onClick={handleNext}
                className="text-xs font-semibold bg-primary text-primary-foreground rounded-full px-3 py-1.5 hover:opacity-90"
              >
                {step < STEPS.length - 1 ? '次へ →' : 'はじめる ✨'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground font-japanese">
        画面をタップでも次へ進めます
      </p>
    </div>
  );
}