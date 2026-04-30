import { useCallback, useRef } from 'react';

// Simple success sound using Web Audio API
export function useSuccessSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playSuccess = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Bright "pikon!" — quick two-note ascending blip (game-style correct cue)
      const notes = [
        { freq: 988, start: 0, dur: 0.09, peak: 0.22 },   // B5
        { freq: 1568, start: 0.07, dur: 0.18, peak: 0.28 }, // G6
      ];
      notes.forEach(({ freq, start, dur, peak }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);
        // Tiny upward glide for the "pi" sparkle
        osc.frequency.exponentialRampToValueAtTime(freq * 1.06, now + start + dur * 0.6);
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(peak, now + start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.02);
      });
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
