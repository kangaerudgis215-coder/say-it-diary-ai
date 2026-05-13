import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, RefreshCw, Loader2, ChevronLeft, Search, Trash2, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ExpressionListItem } from '@/components/expressions/ExpressionListItem';
import { ExpressionDetail } from '@/components/ExpressionDetail';
import { bucketOf, SCENE_CATEGORIES, POS_CATEGORIES, POS_LABELS_JA, type PosCategory } from '@/lib/mastery';
import { Input } from '@/components/ui/input';
import { findSimilarExpressions, groupSimilarExpressions } from '@/lib/expressionSimilarity';

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
type GroupBy = 'scene' | 'pos';

export default function Expressions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [expressions, setExpressions] = useState<ExpressionWithDiary[]>([]);
  const [view, setView] = useState<ViewMode>('overview');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('scene');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isTagging, setIsTagging] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    fetchExpressions();
  }, [user]);

  // Auto-purge expressions that have been archived for more than 30 days.
  // Keeps the collection lean so the swipe-to-archive flow doesn't accumulate forever.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from('expressions')
        .delete()
        .eq('user_id', user.id)
        .eq('status', 'archived')
        .lt('archived_at', cutoff);
    })();
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
  const archivedList = useMemo(
    () =>
      expressions
        .filter(e => e.status === 'archived')
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
    [expressions]
  );
  const totalEncountered = active.length;
  const masteredCount = useMemo(
    () => active.filter(e => bucketOf(e.mastery_level) === 'mastered').length,
    [active]
  );
  const masteryPct = totalEncountered > 0 ? Math.round((masteredCount / totalEncountered) * 100) : 0;

  // For each expression, count how many *similar* expressions exist across the entire
  // user history. Used to surface phrases the user keeps reaching for.
  const usageCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expressions) {
      map[e.id] = findSimilarExpressions(e.expression, expressions).length;
    }
    return map;
  }, [expressions]);

  /**
   * For each expression id, the deduped list of diary dates (desc) coming from
   * every *similar* expression in the user's history. Used by the list card and
   * detail view to drive the multi-date "View diary…" picker.
   */
  const relatedDatesById = useMemo(() => {
    const map: Record<string, string[]> = {};
    const groups = groupSimilarExpressions(expressions);
    for (const g of groups) {
      const dates = Array.from(
        new Set(
          g.members
            .map((m) => m.diary_date)
            .filter((d): d is string => !!d),
        ),
      ).sort((a, b) => b.localeCompare(a));
      for (const m of g.members) map[m.id] = dates;
    }
    return map;
  }, [expressions]);

  /**
   * For navigation: map each (representative) expression id to a lookup of
   * diary_date -> diary_entry_id, so picking a date jumps straight to the
   * correct diary review page.
   */
  const diaryIdByDateById = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    const groups = groupSimilarExpressions(expressions);
    for (const g of groups) {
      const lookup: Record<string, string> = {};
      for (const m of g.members) {
        if (m.diary_date && m.diary_entry_id && !lookup[m.diary_date]) {
          lookup[m.diary_date] = m.diary_entry_id;
        }
      }
      for (const m of g.members) map[m.id] = lookup;
    }
    return map;
  }, [expressions]);

  // Count expressions that need (re)tagging: missing OR currently parked in その他.
  // Showing this count lets the user keep draining the その他 bucket via Auto-tag.
  const untaggedCount = useMemo(
    () =>
      expressions.filter(
        (e) => !e.scene_or_context || e.scene_or_context === 'その他',
      ).length,
    [expressions],
  );

  // Per-category breakdown for whichever grouping is active.
  const buckets = groupBy === 'scene'
    ? (SCENE_CATEGORIES as readonly string[])
    : (POS_CATEGORIES as readonly string[]);

  const keyOf = (e: ExpressionWithDiary): string => {
    if (groupBy === 'scene') {
      return (SCENE_CATEGORIES as readonly string[]).includes(e.scene_or_context as any)
        ? (e.scene_or_context as string)
        : 'その他';
    }
    // "fixed phrase" was merged into "idiom"; normalise any legacy values so
    // they bucket together with イディオム・決まり文句.
    const raw = e.pos_or_type === 'fixed phrase' ? 'idiom' : e.pos_or_type;
    return (POS_CATEGORIES as readonly string[]).includes(raw as any)
      ? (raw as string)
      : 'other';
  };

  const categoryStats = useMemo(() => {
    const map = new Map<string, { total: number; mastered: number; learning: number; newCount: number }>();
    buckets.forEach(c => map.set(c, { total: 0, mastered: 0, learning: 0, newCount: 0 }));
    for (const e of active) {
      const key = keyOf(e);
      const s = map.get(key);
      if (!s) continue;
      s.total++;
      const b = bucketOf(e.mastery_level);
      if (b === 'mastered') s.mastered++;
      else if (b === 'learning') s.learning++;
      else s.newCount++;
    }
    return map;
  }, [active, groupBy]);

  const isArchiveView = activeCategory === '__archived__';

  const categoryList = useMemo(() => {
    if (!activeCategory) return [];
    let list = isArchiveView ? archivedList : active.filter(e => keyOf(e) === activeCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        e =>
          e.expression.toLowerCase().includes(q) ||
          (e.meaning ?? '').toLowerCase().includes(q)
      );
    }
    if (isArchiveView) return list; // show every archived item individually
    // Collapse similar expressions into a single representative card so the list
    // doesn't grow noisy. The newest occurrence wins (list is already sorted desc).
    const groups = groupSimilarExpressions(list);
    return groups.map((g) => g.representative);
  }, [active, archivedList, activeCategory, isArchiveView, search, groupBy]);

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
          newStatus === 'archived'
            ? '練習キューから外しました。30日後に自動削除されます。'
            : '練習キューに戻しました。',
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
            {view === 'category'
              ? (isArchiveView
                  ? '🗑 アーカイブ'
                  : groupBy === 'pos'
                  ? (POS_LABELS_JA[activeCategory as PosCategory] ?? activeCategory)
                  : activeCategory)
              : 'Phrases'}
          </h1>
          <p className="text-xs text-muted-foreground">
            {view === 'category'
              ? (isArchiveView
                  ? `${categoryList.length} 件 ・ 30日後に自動削除`
                  : `${categoryList.length} phrases`)
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

          {/* Auto-tag — always visible so users can rebalance categories anytime */}
          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl mb-4">
            <span className="text-xs text-muted-foreground">
              {untaggedCount > 0
                ? `${untaggedCount} 個の表現を再分類できます`
                : 'カテゴリをいつでも整理できます'}
            </span>
            <Button
              size="sm"
              variant="default"
              onClick={handleTagExpressions}
              disabled={isTagging}
              className="gap-1"
            >
              {isTagging ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isTagging ? 'Tagging…' : 'Auto-tag'}
            </Button>
          </div>

          {/* Group-by switch — flip between scene and POS classification. */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {groupBy === 'scene' ? '場面で分類' : '品詞で分類'}
            </p>
            <div className="inline-flex p-0.5 rounded-full bg-muted">
              <button
                onClick={() => setGroupBy('scene')}
                className={cn(
                  'px-3 py-1 text-xs rounded-full transition-colors',
                  groupBy === 'scene'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                場面
              </button>
              <button
                onClick={() => setGroupBy('pos')}
                className={cn(
                  'px-3 py-1 text-xs rounded-full transition-colors',
                  groupBy === 'pos'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                品詞
              </button>
            </div>
          </div>

          {/* Category buttons */}
          <div className="grid grid-cols-2 gap-3">
            {buckets.map(cat => {
              const s = categoryStats.get(cat)!;
              const pct = s.total > 0 ? Math.round((s.mastered / s.total) * 100) : 0;
              const label = groupBy === 'pos'
                ? POS_LABELS_JA[cat as PosCategory] ?? cat
                : cat;
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
                    <span className="font-semibold text-foreground">{label}</span>
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

          {/* Archive folder — like a trash bin. Items here are auto-deleted after 30 days. */}
          <button
            onClick={() => { setActiveCategory('__archived__'); setView('category'); }}
            className={cn(
              'mt-4 w-full text-left rounded-2xl border border-dashed p-4 transition-all',
              'border-muted-foreground/25 bg-muted/20 hover:bg-muted/30 hover:border-muted-foreground/40',
              archivedList.length === 0 && 'opacity-60'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">アーカイブ</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{archivedList.length}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  右にスワイプで復元 ・ 30日後に自動削除
                </p>
              </div>
            </div>
          </button>

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
                      usageCount={usageCounts[exp.id] ?? 1}
                      relatedDiaryDates={relatedDatesById[exp.id]}
                      isSelected={selectedId === exp.id}
                      onSelect={() => setSelectedId(selectedId === exp.id ? null : exp.id)}
                      onArchiveToggle={handleArchiveToggle}
                      onNavigateToDiary={(d) => {
                        const date = d ?? exp.diary_date ?? undefined;
                        const id =
                          (date && diaryIdByDateById[exp.id]?.[date]) ||
                          exp.diary_entry_id ||
                          undefined;
                        if (id && date) {
                          navigate(`/review?diaryId=${id}&date=${date}`);
                        } else if (date) {
                          navigate(`/calendar?date=${date}`);
                        }
                      }}
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
                    onNavigateToDiary={(d) => {
                      const date = d ?? selectedExpression.diary_date ?? undefined;
                      const id =
                        (date && diaryIdByDateById[selectedExpression.id]?.[date]) ||
                        selectedExpression.diary_entry_id ||
                        undefined;
                      if (id && date) {
                        navigate(`/review?diaryId=${id}&date=${date}`);
                      } else if (date) {
                        navigate(`/calendar?date=${date}`);
                      }
                    }}
                    onDeleted={() => { setSelectedId(null); fetchExpressions(); }}
                    onArchiveToggle={handleArchiveToggle}
                    relatedDiaryDates={relatedDatesById[selectedExpression.id]}
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
