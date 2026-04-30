import { useEffect, useRef } from 'react';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';
import animationData from '@/assets/day-to-night.json';
import { useTheme } from '@/components/ThemeProvider';
import { useUISound } from '@/hooks/useUISound';
import { cn } from '@/lib/utils';

/**
 * Animated Day↔Night theme toggle.
 * Forward play  = light → dark.
 * Reverse play = dark → light.
 */
export function ThemeToggleLottie({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { playTap } = useUISound();
  const ref = useRef<LottieRefCurrentProps>(null);
  const mounted = useRef(false);

  // Set initial frame to match current theme without animating on mount.
  useEffect(() => {
    const lottie = ref.current;
    if (!lottie) return;
    if (!mounted.current) {
      mounted.current = true;
      lottie.goToAndStop(theme === 'dark' ? 30 : 0, true);
      return;
    }
    if (theme === 'dark') {
      lottie.setDirection(1);
      lottie.goToAndPlay(0, true);
    } else {
      lottie.setDirection(-1);
      lottie.goToAndPlay(30, true);
    }
  }, [theme]);

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => {
        playTap();
        toggleTheme();
      }}
      className={cn(
        'inline-flex items-center justify-center h-10 w-10 rounded-full',
        'hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <Lottie
        lottieRef={ref}
        animationData={animationData}
        autoplay={false}
        loop={false}
        style={{ width: 28, height: 28 }}
      />
    </button>
  );
}