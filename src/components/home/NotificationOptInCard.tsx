import { useEffect, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  enablePushNotifications,
  disablePushNotifications,
  isPushEnabledHere,
  isPushSupported,
  pushPermission,
} from '@/lib/pushNotifications';

const DISMISS_KEY = 'soki:push-optin-dismissed';

/**
 * Small SO-KI styled card asking the user to enable nightly reminders.
 * Hidden when push isn't supported (e.g. Lovable preview iframe), already
 * enabled, permission denied, or user dismissed it.
 */
export function NotificationOptInCard() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isPushSupported()) return;
      const perm = pushPermission();
      if (perm === 'denied') return;
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
      const enabled = await isPushEnabledHere();
      if (!mounted) return;
      if (!enabled) setVisible(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!visible) return null;

  const handleEnable = async () => {
    setBusy(true);
    try {
      await enablePushNotifications();
      toast({
        title: '通知をオンにしたにゃ！',
        description: '毎晩21時にそっと声をかけるにゃ〜',
      });
      setVisible(false);
    } catch (e: any) {
      toast({
        title: '通知をオンにできなかったにゃ',
        description: e?.message ?? '時間をおいてもう一度試してにゃ',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="relative rounded-2xl border border-primary/30 bg-primary/5 p-4 fade-in">
      <button
        type="button"
        aria-label="閉じる"
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/15 p-2">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-japanese text-sm font-semibold text-foreground/90">
            毎晩21時、SO-KIから声かけしていい？
          </p>
          <p className="font-japanese text-xs text-muted-foreground mt-1 leading-relaxed">
            「コンコンにゃ。今日はどんな一日だったにゃ？」って、優しくリマインドするにゃ〜
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleEnable} disabled={busy} className="gap-1">
              <Bell className="w-3.5 h-3.5" />
              通知をオンにする
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} className="gap-1">
              <BellOff className="w-3.5 h-3.5" />
              あとで
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}