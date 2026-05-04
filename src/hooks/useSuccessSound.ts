import { useCallback, useRef } from 'react';
import { registerUnlockable } from '@/lib/audioUnlock';

/**
 * Pre-load a single Audio element per src so playback is reliable even after
 * long async work (browsers can block freshly-constructed Audio objects via
 * autoplay policies if they're created outside of a user gesture).
 * If a fresh play is requested while the previous one is still going, we
 * fall back to a one-off Audio so rapid plays don't cut each other off.
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

export function useSuccessSound() {
  const successRef = useRef<(() => void) | null>(null);
  const bigRef = useRef<(() => void) | null>(null);
  const masteredRef = useRef<(() => void) | null>(null);
  if (!successRef.current) successRef.current = makePreloaded('/sounds/correct.mp3', 0.7);
  if (!bigRef.current) bigRef.current = makePreloaded('/sounds/diary-complete.mp3', 0.75);
  if (!masteredRef.current) masteredRef.current = makePreloaded('/sounds/flashcard-correct.mp3', 0.7);

  const playSuccess = useCallback(() => successRef.current?.(), []);
  const playBigSuccess = useCallback(() => bigRef.current?.(), []);
  const playMastered = useCallback(() => masteredRef.current?.(), []);

  return { playSuccess, playBigSuccess, playMastered };
}
