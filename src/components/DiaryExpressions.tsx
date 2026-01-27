import { useState, useEffect } from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Expression {
  id: string;
  expression: string;
  meaning: string | null;
  example_sentence: string | null;
  mastery_level: number;
}

interface DiaryExpressionsProps {
  diaryEntryId: string;
}

export function DiaryExpressions({ diaryEntryId }: DiaryExpressionsProps) {
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
        <div className="mt-3 space-y-3 animate-in fade-in duration-200">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading expressions...</p>
          ) : expressions.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No expressions extracted from this diary.
            </p>
          ) : (
            expressions.map((exp) => (
              <div
                key={exp.id}
                className="bg-muted/50 rounded-lg p-3 space-y-1"
              >
                <p className="text-sm font-medium text-primary">{exp.expression}</p>
                {exp.meaning && (
                  <p className="text-xs text-muted-foreground">
                    {exp.meaning}
                  </p>
                )}
                {exp.example_sentence && (
                  <p className="text-xs text-muted-foreground italic">
                    "{exp.example_sentence}"
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
