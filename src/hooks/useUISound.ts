import { useCallback, useRef } from 'react';
import { registerUnlockable } from '@/lib/audioUnlock';

/**
 * Preload an Audio element once and reuse it. Falls back to a fresh Audio
 * if the primary is still playing — this keeps rapid taps reliable while
 * avoiding the autoplay issues that come from constructing Audio inside an
 * async callback (browsers may silently block such playback).
 */
function makePreloaded(src: string, volume: number) {
  let primary: HTMLAudioElement | null = null;
  if (typeof window !== 'undefined') {
    try {
      primary = new Audio(src);
      primary.preload = 'auto';
      primary.volume = volume;
      registerUnlockable(primary);
    } catch {
      primary = null;
    }
  }
  return () => {
    try {
      if (primary && primary.paused) {
        primary.currentTime = 0;
        void primary.play().catch(() => {
          try {
            const fresh = new Audio(src);
            fresh.volume = volume;
            void fresh.play().catch(() => {});
          } catch {
            /* no-op */
          }
        });
        return;
      }
      const fresh = new Audio(src);
      fresh.volume = volume;
      void fresh.play().catch(() => {});
    } catch {
      /* no-op */
    }
  };
}

/**
 * Universal tap/navigate sound — used for every interactive control
 * (buttons, tab bar, FAB, theme toggle, etc.).
 */
export function useUISound() {
  const tapRef = useRef<(() => void) | null>(null);
  if (!tapRef.current) tapRef.current = makePreloaded('/sounds/tap.mp3', 0.4);
  const playTap = useCallback(() => tapRef.current?.(), []);
  const playNavigate = useCallback(() => tapRef.current?.(), []);

  return { playTap, playNavigate };
}
