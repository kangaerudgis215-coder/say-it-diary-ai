import { useEffect, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import { Check } from 'lucide-react';
import { startOfWeek, addDays, format, isSameDay, parseISO } from 'date-fns';
import fireAnimation from '@/assets/fire.json';
import { cn } from '@/lib/utils';

interface StreakHeroProps {
  streak: number;
  entryDates: string[]; // yyyy-MM-dd
}

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    startRef.current = null;
    let raf = 0;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function StreakHero({ streak, entryDates }: StreakHeroProps) {
  const display = useCountUp(streak, 1400);
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const week = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  const entrySet = new Set(entryDates);
  const hasEntry = (d: Date) => entrySet.has(format(d, 'yyyy-MM-dd'));

  const message =
    streak === 0
      ? 'Start your streak today!'
      : streak === 1
        ? 'Great start — keep it going!'
        : streak < 7
          ? "You're building momentum!"
          : streak < 30
            ? "You're on fire! 🔥"
            : 'Legendary commitment 👑';

  return (
    <div className="relative rounded-3xl overflow-hidden bg-card/60 border border-border/50 px-6 pt-8 pb-6">
      {/* Soft glow backdrop */}
      <div
        className="absolute inset-0 pointer-events-none opacity-80"
        style={{
          background:
            'radial-gradient(ellipse at center top, hsl(var(--primary) / 0.20), transparent 60%)',
        }}
      />

      <div className="relative flex flex-col items-center text-center">
        {/* Fire Lottie */}
        <div className="w-32 h-32 -mt-2 -mb-2 streak-glow">
          <Lottie
            animationData={fireAnimation}
            loop
            autoplay
            className="w-full h-full"
          />
        </div>

        {/* Big count */}
        <div
          className="text-7xl font-black leading-none text-foreground tabular-nums"
          style={{ textShadow: '0 4px 24px hsl(var(--primary) / 0.35)' }}
        >
          {display}
        </div>

        <div className="mt-2 text-lg font-bold tracking-wide text-foreground">
          {streak === 1 ? 'Day Streak!' : 'Day Streak!'}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>

        {/* Weekday chips */}
        <div className="mt-5 grid grid-cols-7 gap-2 w-full max-w-xs">
          {week.map((d, i) => {
            const done = hasEntry(d);
            const isToday = isSameDay(d, today);
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    'text-[10px] font-bold tracking-wider uppercase',
                    isToday ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {DAY_LABELS[i]}
                </span>
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500',
                    done
                      ? 'bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.5)] animate-[fade-in_0.4s_ease-out]'
                      : 'bg-muted/60 border border-border/60 text-muted-foreground/50',
                    isToday && !done && 'ring-2 ring-primary/60',
                  )}
                  style={done ? { animationDelay: `${i * 80}ms` } : undefined}
                >
                  {done ? (
                    <Check className="w-4 h-4" strokeWidth={3} />
                  ) : (
                    <span className="text-xs font-semibold">{format(d, 'd')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
