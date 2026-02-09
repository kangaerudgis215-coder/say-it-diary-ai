import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Filter, X, RefreshCw, Loader2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { ExpressionDetail } from '@/components/ExpressionDetail';
import { useToast } from '@/hooks/use-toast';
import { ExpressionListItem } from '@/components/expressions/ExpressionListItem';
import { ExpressionFilters } from '@/components/expressions/ExpressionFilters';
import { ExpressionSortSelect, SortOption } from '@/components/expressions/ExpressionSortSelect';

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

export default function Expressions() {
  const { user } = useAuth();
  const { isPro, startCheckout } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [expressions, setExpressions] = useState<ExpressionWithDiary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sceneFilter, setSceneFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [showFilters, setShowFilters] = useState(true);
  const [isTagging, setIsTagging] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    fetchExpressions();
  }, [user]);

  const fetchExpressions = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('expressions')
      .select(`
        *,
        diary_entries:diary_entry_id (
          date
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      const expressionsWithDates = data.map((exp: any) => ({
        ...exp,
        diary_date: exp.diary_entries?.date || null,
      }));
      setExpressions(expressionsWithDates);
    }
  };

  const untaggedCount = useMemo(() => {
    return expressions.filter(e => !e.scene_or_context || !e.pos_or_type).length;
  }, [expressions]);

  const availableScenes = useMemo(() => {
    const scenes = new Set(expressions.map(e => e.scene_or_context).filter(Boolean));
    return ['All', ...Array.from(scenes).sort()] as string[];
  }, [expressions]);

  const availableTypes = useMemo(() => {
    const types = new Set(expressions.map(e => e.pos_or_type).filter(Boolean));
    return ['All', ...Array.from(types).sort()] as string[];
  }, [expressions]);

  // Filter and sort expressions
  const filteredExpressions = useMemo(() => {
    let result = expressions.filter(exp => {
      const matchesScene = sceneFilter === 'All' || exp.scene_or_context === sceneFilter;
      const matchesType = typeFilter === 'All' || exp.pos_or_type === typeFilter;
      const matchesStatus = statusFilter === 'all' || exp.status === statusFilter;
      return matchesScene && matchesType && matchesStatus;
    });

    // Sort
    switch (sortBy) {
      case 'recent':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'least_reviewed':
        result.sort((a, b) => (a.review_count || 0) - (b.review_count || 0));
        break;
      case 'oldest_review':
        result.sort((a, b) => {
          const aTime = a.last_reviewed_at ? new Date(a.last_reviewed_at).getTime() : 0;
          const bTime = b.last_reviewed_at ? new Date(b.last_reviewed_at).getTime() : 0;
          return aTime - bTime;
        });
        break;
      case 'alphabetical':
        result.sort((a, b) => a.expression.localeCompare(b.expression));
        break;
    }

    // Free tier: limit to 30 most recent
    if (!isPro && sortBy === 'recent') {
      result = result.slice(0, 30);
    }

    return result;
  }, [expressions, sceneFilter, typeFilter, statusFilter, sortBy, isPro]);

  const FREE_LIMIT = 30;
  const isFreeLimited = !isPro && filteredExpressions.length >= FREE_LIMIT;

  // Paginated view
  const visibleExpressions = useMemo(() => {
    const list = !isPro ? filteredExpressions.slice(0, FREE_LIMIT) : filteredExpressions;
    return list.slice(0, visibleCount);
  }, [filteredExpressions, visibleCount, isPro]);

  const hasMore = isPro
    ? visibleCount < filteredExpressions.length
    : visibleCount < Math.min(filteredExpressions.length, FREE_LIMIT);

  const selectedExpression = useMemo(() => {
    return expressions.find(e => e.id === selectedId) || null;
  }, [expressions, selectedId]);

  const clearFilters = () => {
    setSceneFilter('All');
    setTypeFilter('All');
    setStatusFilter('active');
  };

  const handleTagExpressions = async () => {
    setIsTagging(true);
    try {
      const { data, error } = await supabase.functions.invoke('tag-expressions');
      if (error) throw error;
      toast({
        title: 'Expressions Tagged',
        description: data.message || `Updated ${data.updated} expressions`,
      });
      await fetchExpressions();
    } catch (error) {
      console.error('Error tagging expressions:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to tag expressions. Please try again.',
      });
    } finally {
      setIsTagging(false);
    }
  };

  const handleArchiveToggle = useCallback(async (id: string, newStatus: string) => {
    await supabase
      .from('expressions')
      .update({ status: newStatus } as any)
      .eq('id', id);
    setExpressions(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e));
    toast({
      title: newStatus === 'archived' ? 'Expression archived' : 'Expression restored',
      description: newStatus === 'archived'
        ? 'Removed from practice queue.'
        : 'Back in your practice queue.',
    });
  }, [toast]);

  const hasActiveFilters = sceneFilter !== 'All' || typeFilter !== 'All' || statusFilter !== 'active';

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sceneFilter, typeFilter, statusFilter, sortBy]);

  const activeCount = expressions.filter(e => e.status === 'active').length;
  const archivedCount = expressions.filter(e => e.status === 'archived').length;

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 safe-bottom">
      {/* Header */}
      <header className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-xl">My Expressions</h1>
          <p className="text-sm text-muted-foreground">
            {filteredExpressions.length} of {expressions.length} phrases
            {' · '}{activeCount} active, {archivedCount} archived
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(hasActiveFilters && "text-primary")}
        >
          <Filter className="w-5 h-5" />
        </Button>
      </header>

      {/* Filters */}
      {showFilters && (
        <div className="mb-4 space-y-3 animate-in fade-in duration-200">
          {/* Status filter */}
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Status</span>
            <div className="flex flex-wrap gap-2">
              {(['active', 'archived', 'all'] as const).map(s => (
                <Badge
                  key={s}
                  variant={statusFilter === s ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all capitalize",
                    statusFilter === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? 'All' : s === 'active' ? `Active (${activeCount})` : `Archived (${archivedCount})`}
                </Badge>
              ))}
            </div>
          </div>

          {/* Sort */}
          <ExpressionSortSelect value={sortBy} onChange={setSortBy} />

          {/* Tag button */}
          {untaggedCount > 0 && (
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
              <span className="text-sm text-muted-foreground">
                {untaggedCount} expression{untaggedCount > 1 ? 's' : ''} need tagging
              </span>
              <Button size="sm" onClick={handleTagExpressions} disabled={isTagging}>
                {isTagging ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                {isTagging ? 'Tagging...' : 'Auto-tag'}
              </Button>
            </div>
          )}

          <ExpressionFilters
            availableScenes={availableScenes}
            availableTypes={availableTypes}
            sceneFilter={sceneFilter}
            typeFilter={typeFilter}
            onSceneChange={setSceneFilter}
            onTypeChange={setTypeFilter}
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
          />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4">
        {/* Expression List */}
        <div className={cn("flex-1 overflow-y-auto", selectedExpression && "lg:max-w-md")}>
          {visibleExpressions.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              {expressions.length === 0 ? (
                <>
                  <h3 className="font-bold text-lg mb-2">No expressions yet</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Start writing diary entries and I'll extract useful English expressions for you!
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-bold text-lg mb-2">No matches</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Try adjusting your filters to see more expressions.
                  </p>
                  <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                    Clear filters
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {visibleExpressions.map(exp => (
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
                  onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                >
                  Load more ({filteredExpressions.length - visibleCount} remaining)
                </Button>
              )}
              {isFreeLimited && (
                <div className="mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-center">
                  <p className="text-sm font-japanese mb-2">
                    Freeプランでは最新30件まで表示されます
                  </p>
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={startCheckout}
                  >
                    <Crown className="w-4 h-4" />
                    Proで全件表示
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detail Panel - Desktop only */}
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
    </div>
  );
}
