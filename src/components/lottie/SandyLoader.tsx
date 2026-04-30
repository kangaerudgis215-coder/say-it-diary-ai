import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { cn } from '@/lib/utils';

interface SandyLoaderProps {
  size?: number;
  className?: string;
  /** Render as a fixed full-screen overlay. */
  fullscreen?: boolean;
  label?: string;
}

/**
 * Unified app loader (Sandy Loading lottie).
 * Used for page transitions and major loading states.
 */
export function SandyLoader({ size = 160, className, fullscreen, label }: SandyLoaderProps) {
  const inner = (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
      <DotLottieReact
        src="/anim/sandy-loading.lottie"
        autoplay
        loop
        style={{ width: size, height: size }}
      />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        {inner}
      </div>
    );
  }
  return inner;
}