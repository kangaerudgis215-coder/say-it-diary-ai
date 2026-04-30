import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, RotateCcw, Trophy, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { bucketOf, BUCKET_META, MasteryBucket, nextMasteryLevel } from '@/lib/mastery';
import { SwipeCard } from '@/components/game/SwipeCard';

interface Phrase {
  id: string;
  expression: string;
  meaning: string | null;
  mastery_level: number;
}

type Range = 'all' | 'new' | 'learning' | 'mastered';
type Direction = 'en2jp' | 'jp2en';
type Stage = 'select' | 'play' | 'done';

const RANGE_LABEL: Record<Range, string> = {
  all: 'All Phrases',
  new: '✕ New',
  learning: '△ In Progress',
  mastered: '〇 Mastered',
};

export default function InstantComposition() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stage, setStage] = useState<Stage>('select');
  const [range, setRange] = useState<Range>('new');
  const [direction, setDirection] = useState<Direction>('en2jp');
  const [queue, setQueue] = useState<Phrase[]>([]);
  const [results, setResults] = useState<Record<MasteryBucket, number>>({ new: 0, learning: 0, mastered: 0 });

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  const loadAll = async () => {
    if (!user) return;
    setIsLoading(true);
    const { data } = await supabase
      .from('expressions')
      .select('id, expression, meaning, mastery_level')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .not('meaning', 'is', null);
    setPhrases((data ?? []) as Phrase[]);
    setIsLoading(false);
  };

  // Overall mastery % across all active phrases.
  const overallPct = useMemo(() => {
    if (phrases.length === 0) return 0;
    const m = phrases.filter(p => bucketOf(p.mastery_level) === 'mastered').length;
    return Math.round((m / phrases.length) * 100);
  }, [phrases]);

  const buckets = useMemo(() => {
    const b = { all: phrases.length, new: 0, learning: 0, mastered: 0 } as Record<Range, number>;
    for (const p of phrases) b[bucketOf(p.mastery_level)]++;
    return b;
  }, [phrases]);

  const startSession = (r: Range) => {
    const pool = phrases.filter(p => r === 'all' || bucketOf(p.mastery_level) === r);
    if (pool.length === 0) return;
    // Shuffle
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setRange(r);
    setQueue(shuffled);
    setResults({ new: 0, learning: 0, mastered: 0 });
    setStage('play');
  };

  const current = queue[0];

  const handleSwipe = useCallback(
    async (answer: MasteryBucket) => {
      if (!current || !user) return;
      // Persist new mastery level.
      const next = nextMasteryLevel(current.mastery_level, answer);
      await supabase
        .from('expressions')
        .update({ mastery_level: next, last_reviewed_at: new Date().toISOString() } as any)
        .eq('id', current.id)
        .eq('user_id', user.id);

      // Local update of master list (so % recalculates if user replays).
      setPhrases(prev => prev.map(p => (p.id === current.id ? { ...p, mastery_level: next } : p)));

      setResults(r => ({ ...r, [answer]: r[answer] + 1 }));

      // Re-queue ✕ and △ until mastered.
      setQueue(q => {
        const [, ...rest] = q;
        if (answer === 'mastered') return rest;
        // Push toward the back (random distance 2-5) so it returns later in the session.
        const updated = { ...current, mastery_level: next };
        const insertAt = Math.min(rest.length, 2 + Math.floor(Math.random() * 4));
        const next2 = [...rest];
        next2.splice(insertAt, 0, updated);
        return next2;
      });
    },
    [current, user]
  );

  // Detect end of session.
  useEffect(() => {
    if (stage === 'play' && queue.length === 0 && !isLoading) {
      // Only flip to "done" if a session was actually played.
      const total = results.new + results.learning + results.mastered;
      if (total > 0) setStage('done');
    }
  }, [queue.length, stage, results, isLoading]);

  const restart = () => {
    setStage('select');
    setQueue([]);
    setResults({ new: 0, learning: 0, mastered: 0 });
    loadAll();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  // ============ SELECT STAGE (default TOP) ============
  if (stage === 'select') {
    return (
      <div className="min-h-screen flex flex-col p-4 safe-bottom">
        <header className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold tracking-tight text-foreground/90">Flashcards</h1>
            <p className="text-xs text-muted-foreground">Pick a range and start swiping.</p>
          </div>
        </header>

        {/* Hero: overall mastery % */}
        <div className="rounded-3xl bg-gradient-to-br from-primary/20 via-card to-card border border-border/60 p-6 mb-5 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Overall mastery</p>
          <p className="text-7xl font-black tracking-tight text-primary leading-none">{overallPct}%</p>
          <p className="text-xs text-muted-foreground mt-3">
            {phrases.filter(p => bucketOf(p.mastery_level) === 'mastered').length} / {phrases.length} phrases mastered
          </p>
        </div>

        {/* Direction toggle */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Direction</p>
          <button
            onClick={() => setDirection(d => (d === 'en2jp' ? 'jp2en' : 'en2jp'))}
            className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 transition-colors"
          >
            <span className={cn(direction === 'en2jp' && 'text-primary')}>EN</span>
            <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className={cn(direction === 'jp2en' && 'text-primary')}>JP</span>
          </button>
        </div>

        {/* Range buttons */}
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Range</p>
        <div className="grid grid-cols-2 gap-3">
          {(['all', 'new', 'learning', 'mastered'] as Range[]).map(r => {
            const meta = r === 'all' ? null : BUCKET_META[r];
            const count = buckets[r];
            return (
              <button
                key={r}
                onClick={() => startSession(r)}
                disabled={count === 0}
                className={cn(
                  'rounded-2xl p-4 border border-border/60 bg-card text-left transition-all',
                  'hover:border-primary/40 hover:shadow-lg hover:scale-[1.02]',
                  count === 0 && 'opacity-40 pointer-events-none'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn('font-semibold', meta?.color)}>{RANGE_LABEL[r]}</span>
                  <span className="text-xs text-muted-foreground">{count}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {r === 'all' && 'Mix everything together.'}
                  {r === 'new' && 'Phrases you have not learned yet.'}
                  {r === 'learning' && 'Fuzzy ones — keep them coming back.'}
                  {r === 'mastered' && 'Confidence check on locked-in phrases.'}
                </p>
              </button>
            );
          })}
        </div>

        {phrases.length === 0 && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            No phrases yet. Write a diary first!
          </p>
        )}

        <div className="mt-auto text-center text-[11px] text-muted-foreground pt-6">
          Swipe ← ✕ Not yet · ↑ △ Fuzzy · → 〇 Got it
        </div>
      </div>
    );
  }

  // ============ DONE STAGE ============
  if (stage === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center safe-bottom">
        <Trophy className="w-16 h-16 text-primary mb-4" />
        <h2 className="text-2xl font-bold mb-1">Session complete!</h2>
        <p className="text-sm text-muted-foreground mb-6">{RANGE_LABEL[range]}</p>

        <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-8">
          {(['mastered', 'learning', 'new'] as MasteryBucket[]).map(b => {
            const meta = BUCKET_META[b];
            return (
              <div key={b} className={cn('rounded-2xl p-3', meta.bg)}>
                <p className={cn('text-2xl font-black', meta.color)}>{meta.symbol}</p>
                <p className={cn('text-2xl font-bold', meta.color)}>{results[b]}</p>
                <p className="text-[10px] text-muted-foreground">{meta.label}</p>
              </div>
            );
          })}
        </div>

        <div className="space-y-2 w-full max-w-xs">
          <Button className="w-full gap-2" onClick={restart}>
            <RotateCcw className="w-4 h-4" /> Play again
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
            Back home
          </Button>
        </div>
      </div>
    );
  }

  // ============ PLAY STAGE ============
  const remaining = queue.length;
  return (
    <div className="min-h-screen flex flex-col p-4 safe-bottom">
      <header className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={restart}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-base font-semibold tracking-tight text-foreground/90">{RANGE_LABEL[range]}</h1>
          <p className="text-xs text-muted-foreground">{remaining} left in queue</p>
        </div>
        <button
          onClick={() => setDirection(d => (d === 'en2jp' ? 'jp2en' : 'en2jp'))}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70"
        >
          {direction === 'en2jp' ? 'EN→JP' : 'JP→EN'}
          <ArrowLeftRight className="w-3 h-3" />
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center">
        {current ? (
          <SwipeCard
            cardKey={current.id + '-' + queue.length}
            front={direction === 'en2jp' ? current.expression : (current.meaning ?? '')}
            back={direction === 'en2jp' ? (current.meaning ?? '') : current.expression}
            topHint={direction === 'en2jp' ? 'EN → JP' : 'JP → EN'}
            onSwipe={handleSwipe}
          />
        ) : (
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-6 text-center text-[11px] text-muted-foreground">
        <div>
          <span className="block text-rose-400 font-bold text-base">←</span>
          ✕ Not yet
        </div>
        <div>
          <span className="block text-amber-400 font-bold text-base">↑</span>
          △ Fuzzy
        </div>
        <div>
          <span className="block text-emerald-400 font-bold text-base">→</span>
          〇 Got it
        </div>
      </div>
    </div>
  );
}
