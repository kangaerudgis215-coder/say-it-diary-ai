import { useCallback } from 'react';

function playFile(src: string, volume = 0.4) {
  try {
    const a = new Audio(src);
    a.volume = volume;
    void a.play().catch(() => {});
  } catch {
    /* no-op */
  }
}

/**
 * Universal tap/navigate sound — used for every interactive control
 * (buttons, tab bar, FAB, theme toggle, etc.).
 */
export function useUISound() {
  const playTap = useCallback(() => {
    playFile('/sounds/tap.mp3', 0.4);
  }, []);

  // Same sound for navigation, kept as alias for compatibility.
  const playNavigate = useCallback(() => {
    playFile('/sounds/tap.mp3', 0.45);
  }, []);

  return { playTap, playNavigate };
}
