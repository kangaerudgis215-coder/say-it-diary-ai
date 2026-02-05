import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Calendar, Filter, X, RefreshCw, Loader2, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  is_user_added?: boolean;
}

export default function Expressions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [expressions, setExpressions] = useState<ExpressionWithDiary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sceneFilter, setSceneFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [showFilters, setShowFilters] = useState(true);
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

  // Count untagged expressions
  const untaggedCount = useMemo(() => {
    return expressions.filter(e => !e.scene_or_context || !e.pos_or_type).length;
  }, [expressions]);

  // Get unique scenes and types from data for dynamic filters
  const availableScenes = useMemo(() => {
    const scenes = new Set(expressions.map(e => e.scene_or_context).filter(Boolean));
    return ['All', ...Array.from(scenes).sort()] as string[];
  }, [expressions]);

  const availableTypes = useMemo(() => {
    const types = new Set(expressions.map(e => e.pos_or_type).filter(Boolean));
    return ['All', ...Array.from(types).sort()] as string[];
  }, [expressions]);

  // Filter expressions
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
    if (!dateStr) return 'Unknown date';
    return format(new Date(dateStr), 'MMM d, yyyy');
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
      
      // Refresh the list
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
          {/* Tag button for untagged expressions */}
          {untaggedCount > 0 && (
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
              <span className="text-sm text-muted-foreground">
                {untaggedCount} expression{untaggedCount > 1 ? 's' : ''} need tagging
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
                {isTagging ? 'Tagging...' : 'Auto-tag'}
              </Button>
            </div>
          )}

          {/* Scene filters */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Scene / Context</span>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs">
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {availableScenes.map((scene) => (
                <Badge
                  key={scene}
                  variant={sceneFilter === scene ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all",
                    sceneFilter === scene 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted"
                  )}
                  onClick={() => setSceneFilter(scene)}
                >
                  {scene === 'All' ? 'All Scenes' : scene}
                </Badge>
              ))}
            </div>
          </div>

          {/* Type filters */}
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Type / Part of Speech</span>
            <div className="flex flex-wrap gap-2">
              {availableTypes.map((type) => (
                <Badge
                  key={type}
                  variant={typeFilter === type ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all",
                    typeFilter === type 
                      ? "bg-secondary text-secondary-foreground" 
                      : "hover:bg-muted"
                  )}
                  onClick={() => setTypeFilter(type)}
                >
                  {type === 'All' ? 'All Types' : type}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4">
        {/* Expression List */}
        <div className={cn(
          "flex-1 overflow-y-auto",
          selectedExpression && "lg:max-w-md"
        )}>
          {filteredExpressions.length === 0 ? (
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
              {filteredExpressions.map((exp) => (
                <button
                  key={exp.id}
                  onClick={() => setSelectedId(selectedId === exp.id ? null : exp.id)}
                  className={cn(
                    "w-full text-left bg-card rounded-xl p-4 border border-border transition-all",
                    "hover:border-primary/30",
                    selectedId === exp.id && "border-primary ring-1 ring-primary/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-primary block truncate">{exp.expression}</span>
                      {exp.meaning && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {exp.meaning}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {exp.scene_or_context && (
                          <Badge variant="outline" className="text-xs">
                            {exp.scene_or_context}
                          </Badge>
                        )}
                        {exp.pos_or_type && (
                          <Badge variant="secondary" className="text-xs">
                            {exp.pos_or_type}
                          </Badge>
                        )}
                        {exp.is_user_added && (
                          <Badge variant="default" className="text-xs bg-amber-500/20 text-amber-500 border-amber-500/30">
                            <Star className="w-3 h-3 mr-0.5" />
                            User
                          </Badge>
                        )}
                      </div>
                    </div>
                    {exp.diary_date && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
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
                        onDeleted={() => {
                          setSelectedId(null);
                          fetchExpressions();
                        }}
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
          <div className="hidden lg:block w-80 xl:w-96 shrink-0">
            <div className="sticky top-4 bg-card rounded-xl border border-border p-5">
              <ExpressionDetail 
                expression={selectedExpression} 
                onNavigateToDiary={() => navigate(`/calendar?date=${selectedExpression.diary_date}`)}
                onDeleted={() => {
                  setSelectedId(null);
                  fetchExpressions();
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
