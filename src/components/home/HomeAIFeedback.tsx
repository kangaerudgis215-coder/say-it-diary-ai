import { useEffect, useState } from 'react';
import { Loader2, PawPrint } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface Cached { message: string; cachedDate: string; }

// v3 — local-data variant. Bumped key to invalidate older cached messages.
const STORAGE_KEY = 'soki_daily_encouragement_v3';

/**
 * Daily AI encouragement card. Reads streak/expression stats from local
 * storage and posts them to the `daily-encouragement` edge function so
 * SO-KI can reply with a short, factually grounded message.
 */
export function HomeAIFeedback() {
  const { user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const collectLocalStats = async () => {
    if (!user) return null;
    const [{ data: profile }, { data: entries }, { data: exprs }] = await Promise.all([
      supabase.from('profiles').select('display_name, current_streak, total_diary_entries').eq('user_id', user.id).maybeSingle(),
      supabase.from('diary_entries').select('id').eq('user_id', user.id),
      supabase.from('expressions').select('mastery_level, status').eq('user_id', user.id).eq('status', 'active'),
    ]);
    const total = (exprs || []).length;
    const mastered = (exprs || []).filter((e: any) => (e.mastery_level || 0) >= 80).length;
    const learning = (exprs || []).filter((e: any) => {
      const m = e.mastery_level || 0;
      return m >= 30 && m < 80;
    }).length;
    return {
      displayName: (profile as any)?.display_name || '',
      currentStreak: (profile as any)?.current_streak || 0,
      totalDiaryEntries: (entries || []).length,
      totalExpressions: total,
      masteredExpressions: mastered,
      learningExpressions: learning,
    };
  };

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const p: Cached = JSON.parse(cached);
        if (p.cachedDate === today && p.message) {
          setMessage(p.message);
          setLoading(false);
          return;
        }
      }
    } catch { /* ignore */ }

    try {
      const stats = await collectLocalStats();
      const { data, error } = await supabase.functions.invoke('daily-encouragement', {
        body: { userId: user?.id, stats },
      });
      if (error) throw error;
      const msg = (data as any)?.message || 'またゆっくり書こうにゃ〜🌙';
      setMessage(msg);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ message: msg, cachedDate: today }));
      } catch { /* ignore */ }
    } catch (e) {
      console.error('AI feedback fetch error:', e);
      setMessage('今日も自分のペースでいこうにゃ🐾');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">SO-KIが考えてるにゃ…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/10 to-accent/10 overflow-hidden">
      <CardContent className="py-4">
        <div className="flex gap-3">
          <div className="relative w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 shadow-inner">
            <span className="text-lg leading-none" aria-hidden>🐱</span>
            <span
              aria-hidden
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-card border border-primary/30 flex items-center justify-center text-primary"
            >
              <PawPrint className="w-2.5 h-2.5" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">SO-KIから一言 🐾</p>
            <p className="text-sm leading-relaxed text-foreground/90 font-japanese">{message}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}