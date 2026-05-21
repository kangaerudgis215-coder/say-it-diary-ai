import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resetAudioPipeline } from '@/lib/audioUnlock';
import { clearManagedAudioCaches, playManagedEffect } from '@/lib/audioSession';
import { stopAssistantSpeech } from '@/lib/assistantSpeech';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * One-tap audio recovery for the rare iOS Safari / Bluetooth route case
 * where sound effects go silent (TTS still works). Drops cached audio,
 * resumes AudioContext, re-primes unlock, then plays a tiny confirmation
 * chime so the user can hear that output is back.
 */
export function AudioResetButton() {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Cancel any in-flight TTS so it doesn't keep blocking effects.
      try { stopAssistantSpeech(); } catch { /* no-op */ }
      try { window.speechSynthesis?.cancel(); } catch { /* no-op */ }
      clearManagedAudioCaches();
      const ok = await resetAudioPipeline();
      // Short delay so AudioContext.resume actually settles before play.
      await new Promise((r) => setTimeout(r, 120));
      try { playManagedEffect('/sounds/tap.mp3', 0.6); } catch { /* no-op */ }
      toast({
        title: ok ? '音声をリセットしました' : 'リセットを試みました',
        description: 'ポンと音が鳴れば復旧成功です。',
      });
    } finally {
      setTimeout(() => setBusy(false), 400);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="音声をリセット"
      onClick={onClick}
      className={cn(busy && 'opacity-60')}
    >
      {busy ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
    </Button>
  );
}
