import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Brain, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PendingDiary {
  id: string;
  date: string;
  content: string;
}

/**
 * Lists yesterday-and-earlier diaries whose sentence-reorder quiz has NOT
 * been completed yet. Today's diary is excluded (the "Latest" review targets
 * everything _before_ today).
 */
export function PendingRecallList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingDiary[]>([]);

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    if (!user) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('diary_entries')
      .select('id, date, content, sentences_review_completed')
      .eq('user_id', user.id)
      .lt('date', today)
      .eq('sentences_review_completed', false)
      .order('date', { ascending: true });
    setPending((data || []) as PendingDiary[]);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-6 pb-28">
      <header className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-lg">過去の復習</h1>
      </header>

      {pending.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-bold">すべて復習済みです 🎉</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            溜まっている過去の日記の復習はありません。<br />
            明日また挑戦してくださいね。
          </p>
          <Button variant="outline" onClick={() => navigate('/')}>
            ホームに戻る
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {pending.length}件の日記がまだ復習されていません。古い順に取り組みましょう。
          </p>
          <ul className="space-y-3">
            {pending.map((d, i) => {
              const dt = parseISO(d.date);
              return (
                <li key={d.id}>
                  <button
                    onClick={() => navigate(`/quiz?diaryId=${d.id}`)}
                    className={cn(
                      'w-full text-left bg-card/70 hover:bg-card transition-colors',
                      'rounded-2xl border border-border/60 p-4 flex gap-4 items-center',
                    )}
                  >
                    <div className="flex flex-col items-center justify-center w-12 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {format(dt, 'EEEEE', { locale: ja })}
                      </span>
                      <span className="text-2xl font-bold leading-none mt-0.5">
                        {format(dt, 'd')}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-1">
                        {format(dt, 'M月')}
                      </span>
                    </div>
                    <p className="flex-1 text-sm leading-relaxed text-foreground/90 line-clamp-2">
                      {d.content}
                    </p>
                    {i === 0 && (
                      <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-primary/15 text-primary">
                        次
                      </span>
                    )}
                    <Brain className="w-5 h-5 text-muted-foreground shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
