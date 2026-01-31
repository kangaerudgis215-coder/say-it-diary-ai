import { useCallback, useRef } from 'react';

// Simple success sound using Web Audio API
export function useSuccessSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playSuccess = useCallback(() => {
    try {
      // Create audio context lazily
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      
      // Resume context if suspended (browser autoplay policy)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Create a gentle chime sound
      const oscillator1 = ctx.createOscillator();
      const oscillator2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Pleasant chord frequencies (C major-ish)
      oscillator1.frequency.value = 523.25; // C5
      oscillator2.frequency.value = 659.25; // E5

      oscillator1.type = 'sine';
      oscillator2.type = 'sine';

      // Gentle envelope
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      oscillator1.start(now);
      oscillator2.start(now);
      oscillator1.stop(now + 0.5);
      oscillator2.stop(now + 0.5);
    } catch (error) {
      console.log('Could not play success sound:', error);
    }
  }, []);

  const playBigSuccess = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Create a more triumphant sound for quiz completion
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 - C major chord
      
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = freq;
        osc.type = 'sine';
        
        const startTime = now + i * 0.08;
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.12, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.6);
        
        osc.start(startTime);
        osc.stop(startTime + 0.7);
      });
    } catch (error) {
      console.log('Could not play big success sound:', error);
    }
  }, []);

  return { playSuccess, playBigSuccess };
}
