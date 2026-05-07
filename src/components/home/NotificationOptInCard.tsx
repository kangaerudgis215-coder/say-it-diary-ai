import { useEffect, useState } from 'react';
import { Mail, MailX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const DISMISS_KEY = 'soki:email-optin-dismissed';

/**
 * SO-KI styled card asking the user to enable nightly reminder emails (21:00 JST).
 * Hidden once the user opts in or dismisses it.
 */
export function NotificationOptInCard() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('email_notifications_enabled')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!mounted) return;
      if (!data?.email_notifications_enabled) setVisible(true);
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (!visible) return null;

  const handleEnable = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ email_notifications_enabled: true })
        .eq('user_id', user.id);
      if (error) throw error;
      toast({
        title: 'メール通知をオンにしたにゃ！',
        description: '毎晩21時(JST)に、登録メールへそっと声をかけるにゃ〜',
      });
      setVisible(false);
    } catch (e: any) {
      toast({
        title: '設定できなかったにゃ',
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
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-japanese text-sm font-semibold text-foreground/90">
            毎晩21時、メールで声かけしていい？
          </p>
          <p className="font-japanese text-xs text-muted-foreground mt-1 leading-relaxed">
            その日まだ日記を書いてないときだけ、登録メールにそっとリマインドするにゃ〜
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleEnable} disabled={busy} className="gap-1">
              <Mail className="w-3.5 h-3.5" />
              メール通知をオンにする
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} className="gap-1">
              <MailX className="w-3.5 h-3.5" />
              あとで
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
