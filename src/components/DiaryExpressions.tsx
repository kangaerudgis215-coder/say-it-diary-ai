import { useState, useEffect } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Tag, Layers, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Expression {
  id: string;
  expression: string;
  meaning: string | null;
  example_sentence: string | null;
  mastery_level: number;
  scene_or_context: string | null;
  pos_or_type: string | null;
  is_user_added?: boolean;
}

interface DiaryExpressionsProps {
  diaryEntryId: string;
}

export function DiaryExpressions({ diaryEntryId }: DiaryExpressionsProps) {
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedExpressionId, setExpandedExpressionId] = useState<string | null>(null);

  useEffect(() => {
    if (isExpanded && expressions.length === 0) {
      fetchExpressions();
    }
  }, [isExpanded, diaryEntryId]);

  const fetchExpressions = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('expressions')
      .select('*')
      .eq('diary_entry_id', diaryEntryId);
    
    setExpressions(data || []);
    setIsLoading(false);
  };

  // Pre-fetch count on mount
  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from('expressions')
        .select('*', { count: 'exact', head: true })
        .eq('diary_entry_id', diaryEntryId);
      
      // If there are expressions, auto-expand
      if (count && count > 0) {
        fetchExpressions();
      }
    };
    fetchCount();
  }, [diaryEntryId]);

  if (expressions.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <Button
        variant="ghost"
        className="w-full justify-between h-auto py-2 px-0 hover:bg-transparent"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            Expressions from this diary ({expressions.length})
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </Button>

      {isExpanded && (
        <div className="mt-3 space-y-2 animate-in fade-in duration-200">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading expressions...</p>
          ) : expressions.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No expressions extracted from this diary.
            </p>
          ) : (
            expressions.map((exp) => (
              <button
                key={exp.id}
                onClick={() => setExpandedExpressionId(
                  expandedExpressionId === exp.id ? null : exp.id
                )}
                className={cn(
                  "w-full text-left bg-muted/50 rounded-lg p-3 space-y-2 transition-all",
                  "hover:bg-muted/70",
                  expandedExpressionId === exp.id && "ring-1 ring-primary/30"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-primary">{exp.expression}</p>
                  <div className="flex gap-1 shrink-0">
                    {exp.scene_or_context && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {exp.scene_or_context}
                      </Badge>
                    )}
                    {exp.pos_or_type && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        {exp.pos_or_type}
                      </Badge>
                    )}
                    {exp.is_user_added && (
                      <Badge variant="default" className="text-xs px-1.5 py-0 bg-amber-500/20 text-amber-500 border-amber-500/30">
                        <Star className="w-2 h-2 mr-0.5" />
                        User
                      </Badge>
                    )}
                  </div>
                </div>
                
                {expandedExpressionId === exp.id && (
                  <div className="pt-2 border-t border-border/50 space-y-2 animate-in fade-in duration-150">
                    {exp.meaning && (
                      <p className="text-xs text-muted-foreground">
                        <span className="text-foreground/70">Meaning:</span> {exp.meaning}
                      </p>
                    )}
                    {exp.example_sentence && (
                      <p className="text-xs text-muted-foreground italic">
                        "{exp.example_sentence}"
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-muted-foreground">
                        Mastery: {exp.mastery_level}/5
                      </span>
                      <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(exp.mastery_level / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
