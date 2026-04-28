import { Flame } from 'lucide-react';

interface StreakHeroProps {
  streak: number;
}

/**
 * Big celebratory streak counter shown at the top of Home.
 * Inspired by Duolingo / Streaks app — large number + flame mascot.
 */
export function StreakHero({ streak }: StreakHeroProps) {
  const message =
    streak === 0
      ? 'Start your streak today!'
      : streak === 1
        ? 'You started — keep it going!'
        : streak < 7
          ? "Nice rhythm — don't break it!"
          : streak < 30
            ? "You're on fire!"
            : 'Legendary commitment 👑';

  return (
    <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-transparent border border-primary/30 px-5 py-6">
      <div className="absolute -right-6 -top-4 opacity-90 streak-glow pointer-events-none">
        <Flame className="w-32 h-32 text-primary fill-primary/40" strokeWidth={1.5} />
      </div>

      <div className="relative">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/60 text-[10px] font-bold tracking-widest text-primary uppercase">
          Streak
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-6xl font-black leading-none text-foreground drop-shadow-sm">
            {streak}
          </span>
          <span className="text-lg font-semibold text-foreground/80">
            {streak === 1 ? 'day' : 'days'}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-foreground/70">{message}</p>
      </div>
    </div>
  );
}