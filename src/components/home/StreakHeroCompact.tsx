import { useEffect, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import fireAnimation from '@/assets/fire.json';

interface StreakHeroCompactProps {
  streak: number;
}

function useCountUp(target: number, duration = 1100) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    startRef.current = null;
    let raf = 0;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/**
 * Compact streak panel for the Home screen — fits the LEFT half
 * of a 2-column hero. Just the fire + "X day streak!".
 * The full Duolingo-style hero is reserved for post-quiz reward.
 */
export function StreakHeroCompact({ streak }: StreakHeroCompactProps) {
  const display = useCountUp(streak);
  return (
    <div className="relative h-full flex flex-col items-center justify-center text-center px-2 py-3">
      <div className="w-20 h-20 streak-glow">
        <Lottie animationData={fireAnimation} loop autoplay className="w-full h-full" />
      </div>
      <div
        className="mt-1 text-4xl font-black leading-none text-foreground tabular-nums"
        style={{ textShadow: '0 4px 18px hsl(var(--primary) / 0.35)' }}
      >
        {display}
      </div>
      <div className="mt-1 text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
        Day Streak!
      </div>
    </div>
  );
}