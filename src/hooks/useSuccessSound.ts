import { useCallback } from 'react';
import { playManagedEffect } from '@/lib/audioSession';

export function useSuccessSound() {
  const playSuccess = useCallback(() => playManagedEffect('/sounds/correct.mp3', 0.58), []);
  const playBigSuccess = useCallback(() => playManagedEffect('/sounds/diary-complete.mp3', 0.62), []);
  const playMastered = useCallback(() => playManagedEffect('/sounds/flashcard-correct.mp3', 0.58), []);

  return { playSuccess, playBigSuccess, playMastered };
}
