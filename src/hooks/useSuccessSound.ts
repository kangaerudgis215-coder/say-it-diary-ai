import { useCallback } from 'react';

/**
 * Plays an mp3 from /public. Each call creates a fresh Audio so rapid
 * successive plays don't get cut off by an in-flight playback.
 */
function playFile(src: string, volume = 0.7) {
  try {
    const a = new Audio(src);
    a.volume = volume;
    void a.play().catch(() => {});
  } catch {
    /* no-op */
  }
}

export function useSuccessSound() {
  // Word-reorder correct → bright "ping"
  const playSuccess = useCallback(() => {
    playFile('/sounds/correct.mp3', 0.7);
  }, []);

  // Quiz completion / diary saved → triumphant chime
  const playBigSuccess = useCallback(() => {
    playFile('/sounds/diary-complete.mp3', 0.75);
  }, []);

  // Flashcard 〇 (mastered) → game-show bell
  const playMastered = useCallback(() => {
    playFile('/sounds/flashcard-correct.mp3', 0.7);
  }, []);

  return { playSuccess, playBigSuccess, playMastered };
}
