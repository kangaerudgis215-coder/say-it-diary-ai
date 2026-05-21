import { useState } from 'react';
import { RefreshCw, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resetAudioPipeline } from '@/lib/audioUnlock';
import { clearManagedAudioCaches, playManagedEffect } from '@/lib/audioSession';
import { stopAssistantSpeech } from '@/lib/assistantSpeech';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * One-tap recovery button. Combines:
 *  - Audio pipeline reset (for "effects went silent" cases)
 *  - Soft reload signal ('soki:soft-reload' CustomEvent) so the current
 *    page (Chat/Speak) can re-trigger welcome message / re-fetch data
 *    without a hard page refresh.
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
      // Tell the current page to refresh its own state (welcome message,
      // data fetch, etc.) without a full page reload.
      try {
        window.dispatchEvent(new CustomEvent('soki:soft-reload'));
      } catch { /* no-op */ }
      toast({
        title: ok ? '音声をリセットしました' : 'リセットを試みました',
        description: 'ポンと音が鳴れば復旧成功です。表示も更新しました。',
      });
    } finally {
      setTimeout(() => setBusy(false), 400);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="音声・表示をリセット"
      onClick={onClick}
      className={cn(busy && 'opacity-60')}
    >
      {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}
    </Button>
  );
}
