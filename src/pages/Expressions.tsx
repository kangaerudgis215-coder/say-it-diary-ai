import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, RefreshCw, Loader2, ChevronLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ExpressionListItem } from '@/components/expressions/ExpressionListItem';
import { ExpressionDetail } from '@/components/ExpressionDetail';
import { bucketOf, SCENE_CATEGORIES } from '@/lib/mastery';
import { Input } from '@/components/ui/input';

export interface ExpressionWithDiary {
  id: string;
  expression: string;
  meaning: string | null;
  example_sentence: string | null;
  mastery_level: number;
  diary_entry_id: string | null;
  created_at: string;
  diary_date?: string | null;
  scene_or_context: string | null;
  pos_or_type: string | null;
  is_user_added?: boolean;
  status: string;
  review_count: number;
  correct_streak: number;
  last_reviewed_at: string | null;
}

const PAGE_SIZE = 50;

type ViewMode = 'overview' | 'category';

export default function Expressions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [expressions, setExpressions] = useState<ExpressionWithDiary[]>([]);
  const [view, setView] = useState<ViewMode>('overview');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isTagging, setIsTagging] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    fetchExpressions();
  }, [user]);

  const fetchExpressions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('expressions')
      .select(`*, diary_entries:diary_entry_id ( date )`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      setExpressions(
        data.map((exp: any) => ({ ...exp, diary_date: exp.diary_entries?.date || null }))
      );
    }
  };

  // Active = not archived. Total expressions encountered.
  const active = useMemo(() => expressions.filter(e => e.status !== 'archived'), [expressions]);
  const totalEncountered = active.length;
  const masteredCount = useMemo(
    () => active.filter(e => bucketOf(e.mastery_level) === 'mastered').length,
    [active]
  );
  const masteryPct = totalEncountered > 0 ? Math.round((masteredCount / totalEncountered) * 100) : 0;

  const untaggedCount = useMemo(
    () => expressions.filter(e => !e.scene_or_context).length,
    [expressions]
  );

  // Per-category breakdown using the 6 fixed categories.
  const categoryStats = useMemo(() => {
    const map = new Map<string, { total: number; mastered: number; learning: number; newCount: number }>();
    SCENE_CATEGORIES.forEach(c => map.set(c, { total: 0, mastered: 0, learning: 0, newCount: 0 }));
    for (const e of active) {
      const key = (SCENE_CATEGORIES as readonly string[]).includes(e.scene_or_context as any)
        ? (e.scene_or_context as string)
        : 'その他';
      const s = map.get(key)!;
      s.total++;
      const b = bucketOf(e.mastery_level);
      if (b === 'mastered') s.mastered++;
      else if (b === 'learning') s.learning++;
      else s.newCount++;
    }
    return map;
  }, [active]);

  const categoryList = useMemo(() => {
    if (!activeCategory) return [];
    let list = active.filter(e => {
      const c = (SCENE_CATEGORIES as readonly string[]).includes(e.scene_or_context as any)
        ? (e.scene_or_context as string)
        : 'その他';
      return c === activeCategory;
    });
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        e =>
          e.expression.toLowerCase().includes(q) ||
          (e.meaning ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [active, activeCategory, search]);

  const visible = categoryList.slice(0, visibleCount);
  const hasMore = visibleCount < categoryList.length;

  useEffect(() => setVisibleCount(PAGE_SIZE), [activeCategory, search]);

  const selectedExpression = useMemo(
    () => expressions.find(e => e.id === selectedId) || null,
    [expressions, selectedId]
  );

  const handleArchiveToggle = useCallback(
    async (id: string, newStatus: string) => {
      await supabase.from('expressions').update({ status: newStatus } as any).eq('id', id);
      setExpressions(prev => prev.map(e => (e.id === id ? { ...e, status: newStatus } : e)));
      toast({
        title: newStatus === 'archived' ? 'Expression archived' : 'Expression restored',
        description:
          newStatus === 'archived' ? 'Removed from practice queue.' : 'Back in your practice queue.',
      });
    },
    [toast]
  );

  const handleTagExpressions = async () => {
    setIsTagging(true);
    try {
      const { data, error } = await supabase.functions.invoke('tag-expressions');
      if (error) throw error;
      toast({ title: 'Tagged', description: data.message || `Updated ${data.updated} expressions` });
      await fetchExpressions();
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to tag expressions.' });
    } finally {
      setIsTagging(false);
    }
  };

  // Hero "rainbow" gradient ring around the big number.
  const ringStyle = {
    background: `conic-gradient(hsl(var(--primary)) ${masteryPct * 3.6}deg, hsl(var(--muted)) 0deg)`,
  } as const;

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 safe-bottom">
      {/* Header */}
      <header className="flex items-center gap-3 mb-4">
        {view === 'category' ? (
          <Button variant="ghost" size="icon" onClick={() => { setActiveCategory(null); setView('overview'); setSelectedId(null); }}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground/90">
            {view === 'category' ? activeCategory : 'Phrases'}
          </h1>
          <p className="text-xs text-muted-foreground">
            {view === 'category'
              ? `${categoryList.length} phrases`
              : `${totalEncountered} encountered · ${masteredCount} mastered`}
          </p>
        </div>
      </header>

      {view === 'overview' && (
        <>
          {/* Hero: encountered count + mastery ring */}
          <div className="rounded-3xl bg-gradient-to-br from-primary/15 via-card to-card border border-border/60 p-6 mb-5 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="flex items-center gap-5 relative">
              {/* Big number */}
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
                  Words encountered
                </p>
                <p className="text-6xl font-black tracking-tight text-foreground leading-none">
                  {totalEncountered}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Every word you've met through your diaries.
                </p>
              </div>
              {/* Mastery ring */}
              <div className="relative w-24 h-24 shrink-0">
                <div className="w-24 h-24 rounded-full p-[3px]" style={ringStyle}>
                  <div className="w-full h-full rounded-full bg-card flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-primary leading-none">{masteryPct}%</span>
                    <span className="text-[9px] text-muted-foreground mt-0.5 uppercase">mastered</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tagging hint */}
          {untaggedCount > 0 && (
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl mb-4">
              <span className="text-xs text-muted-foreground">
                {untaggedCount} phrase{untaggedCount > 1 ? 's' : ''} need a category
              </span>
              <Button size="sm" variant="ghost" onClick={handleTagExpressions} disabled={isTagging}>
                {isTagging ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                {isTagging ? 'Tagging…' : 'Auto-tag'}
              </Button>
            </div>
          )}

          {/* Category buttons */}
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Categories</p>
          <div className="grid grid-cols-2 gap-3">
            {SCENE_CATEGORIES.map(cat => {
              const s = categoryStats.get(cat)!;
              const pct = s.total > 0 ? Math.round((s.mastered / s.total) * 100) : 0;
              return (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setView('category'); }}
                  disabled={s.total === 0}
                  className={cn(
                    'group text-left rounded-2xl bg-card border border-border/60 p-4 transition-all',
                    'hover:border-primary/40 hover:shadow-lg hover:scale-[1.02]',
                    s.total === 0 && 'opacity-40 pointer-events-none'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-foreground">{cat}</span>
                    <span className="text-xs text-muted-foreground">{s.total}</span>
                  </div>
                  {/* Meter */}
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1.5">
                    <div
                      className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{s.mastered}/{s.total} mastered</span>
                    <span className="font-semibold text-primary">{pct}%</span>
                  </div>
                </button>
              );
            })}
          </div>

          {totalEncountered === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-bold text-lg mb-2">No phrases yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Start writing diary entries and SO-KI will collect useful expressions here.
              </p>
            </div>
          )}
        </>
      )}

      {view === 'category' && activeCategory && (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search phrases…"
              className="pl-9"
            />
          </div>

          <div className="flex-1 flex flex-col lg:flex-row gap-4">
            <div className={cn('flex-1 overflow-y-auto', selectedExpression && 'lg:max-w-md')}>
              {visible.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  {search ? 'No matches.' : 'No phrases in this category yet.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {visible.map(exp => (
                    <ExpressionListItem
                      key={exp.id}
                      expression={exp}
                      isSelected={selectedId === exp.id}
                      onSelect={() => setSelectedId(selectedId === exp.id ? null : exp.id)}
                      onArchiveToggle={handleArchiveToggle}
                      onNavigateToDiary={() => navigate(`/calendar?date=${exp.diary_date}`)}
                      onDeleted={() => { setSelectedId(null); fetchExpressions(); }}
                    />
                  ))}
                  {hasMore && (
                    <Button
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => setVisibleCount(p => p + PAGE_SIZE)}
                    >
                      Load more ({categoryList.length - visibleCount} remaining)
                    </Button>
                  )}
                </div>
              )}
            </div>

            {selectedExpression && (
              <div className="hidden lg:block w-80 xl:w-96 shrink-0">
                <div className="sticky top-4 bg-card rounded-xl border border-border p-5">
                  <ExpressionDetail
                    expression={selectedExpression}
                    onNavigateToDiary={() => navigate(`/calendar?date=${selectedExpression.diary_date}`)}
                    onDeleted={() => { setSelectedId(null); fetchExpressions(); }}
                    onArchiveToggle={handleArchiveToggle}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
