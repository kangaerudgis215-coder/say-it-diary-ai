import { useCallback } from 'react';
import { playManagedEffect } from '@/lib/audioSession';

/**
 * Universal tap/navigate sound — used for every interactive control
 * (buttons, tab bar, FAB, theme toggle, etc.).
 */
export function useUISound() {
  const playTap = useCallback(() => playManagedEffect('/sounds/tap.mp3', 0.34, 'tap'), []);
  const playNavigate = useCallback(() => playManagedEffect('/sounds/tap.mp3', 0.34, 'tap'), []);

  return { playTap, playNavigate };
}
