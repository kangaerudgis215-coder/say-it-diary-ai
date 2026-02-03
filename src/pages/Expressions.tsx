import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Calendar, Filter, X, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ExpressionDetail } from '@/components/ExpressionDetail';
import { useToast } from '@/hooks/use-toast';

interface ExpressionWithDiary {
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
}

export default function Expressions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [expressions, setExpressions] = useState<ExpressionWithDiary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sceneFilter, setSceneFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [isTagging, setIsTagging] = useState(false);

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

  const filteredExpressions = useMemo(() => {
    return expressions.filter(exp => {
      const matchesScene = sceneFilter === 'All' || exp.scene_or_context === sceneFilter;
      const matchesType = typeFilter === 'All' || exp.pos_or_type === typeFilter;
      return matchesScene && matchesType;
    });
  }, [expressions, sceneFilter, typeFilter]);

  const selectedExpression = useMemo(() => {
    return expressions.find(e => e.id === selectedId) || null;
  }, [expressions, selectedId]);

  const formatDiaryDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown';
    return format(new Date(dateStr), 'MMM d');
  };

  const clearFilters = () => {
    setSceneFilter('All');
    setTypeFilter('All');
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

  const hasActiveFilters = sceneFilter !== 'All' || typeFilter !== 'All';

  return (
    <div className="min-h-screen flex flex-col pb-nav">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 pt-6 pb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-xl">My Vocabulary</h1>
          <p className="text-sm text-muted-foreground">
            {filteredExpressions.length} expression{filteredExpressions.length !== 1 ? 's' : ''}
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
        <div className="px-6 mb-4 space-y-3 fade-in">
          {untaggedCount > 0 && (
            <div className="card-elevated p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {untaggedCount} need tagging
              </span>
              <Button 
                size="sm" 
                onClick={handleTagExpressions}
                disabled={isTagging}
              >
                {isTagging ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                Auto-tag
              </Button>
            </div>
          )}

          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Scene</span>
            <div className="flex flex-wrap gap-2">
              {availableScenes.map((scene) => (
                <Badge
                  key={scene}
                  variant={sceneFilter === scene ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all",
                    sceneFilter === scene && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => setSceneFilter(scene)}
                >
                  {scene === 'All' ? 'All' : scene}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Type</span>
            <div className="flex flex-wrap gap-2">
              {availableTypes.map((type) => (
                <Badge
                  key={type}
                  variant={typeFilter === type ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all",
                    typeFilter === type && "bg-secondary text-secondary-foreground"
                  )}
                  onClick={() => setTypeFilter(type)}
                >
                  {type === 'All' ? 'All' : type}
                </Badge>
              ))}
            </div>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-3 h-3 mr-1" />
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Expression List */}
      <div className="flex-1 overflow-y-auto px-6">
        {filteredExpressions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            {expressions.length === 0 ? (
              <>
                <h3 className="font-bold text-lg mb-2">No expressions yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Start writing diaries and I'll extract useful expressions for you!
                </p>
              </>
            ) : (
              <>
                <h3 className="font-bold text-lg mb-2">No matches</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Try adjusting your filters
                </p>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {filteredExpressions.map((exp) => (
              <button
                key={exp.id}
                onClick={() => setSelectedId(selectedId === exp.id ? null : exp.id)}
                className={cn(
                  "w-full text-left card-elevated p-4 transition-all",
                  "hover:border-primary/30",
                  selectedId === exp.id && "border-primary ring-1 ring-primary/20"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary mb-1">{exp.expression}</p>
                    {exp.meaning && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {exp.meaning}
                      </p>
                    )}
                    {exp.example_sentence && (
                      <p className="text-xs text-muted-foreground/70 mt-1 italic line-clamp-1">
                        {exp.example_sentence}
                      </p>
                    )}
                  </div>
                  {exp.diary_date && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 bg-muted px-2 py-1 rounded-full">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDiaryDate(exp.diary_date)}</span>
                    </div>
                  )}
                </div>

                {/* Inline detail on mobile when selected */}
                {selectedId === exp.id && (
                  <div className="lg:hidden mt-4 pt-4 border-t border-border">
                    <ExpressionDetail 
                      expression={exp} 
                      onNavigateToDiary={() => navigate(`/calendar?date=${exp.diary_date}`)}
                    />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel - Desktop only */}
      {selectedExpression && (
        <div className="hidden lg:block fixed right-0 top-0 h-full w-96 bg-card border-l border-border p-6">
          <ExpressionDetail 
            expression={selectedExpression} 
            onNavigateToDiary={() => navigate(`/calendar?date=${selectedExpression.diary_date}`)}
          />
        </div>
      )}

      <BottomNav />
    </div>
  );
}
