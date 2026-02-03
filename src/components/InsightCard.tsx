import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays, isYesterday, differenceInDays } from 'date-fns';

interface Expression {
  expression: string;
  meaning: string | null;
}

interface InsightData {
  date: string;
  highlight: string;
  expression?: Expression;
  diaryId: string;
}

export function InsightCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchInsight();
    }
  }, [user]);

  const fetchInsight = async () => {
    if (!user) return;
    setIsLoading(true);

    const today = format(new Date(), 'yyyy-MM-dd');

    // Get most recent past diary
    const { data: diary } = await supabase
      .from('diary_entries')
      .select('id, date, content, japanese_summary')
      .eq('user_id', user.id)
      .lt('date', today)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (diary) {
      // Get one expression from this diary
      const { data: expressions } = await supabase
        .from('expressions')
        .select('expression, meaning')
        .eq('diary_entry_id', diary.id)
        .limit(1);

      const highlight = diary.content
        ? diary.content.split('.')[0] + '.'
        : 'No content available';

      setInsight({
        date: diary.date,
        highlight: highlight.slice(0, 100) + (highlight.length > 100 ? '...' : ''),
        expression: expressions?.[0] || undefined,
        diaryId: diary.id,
      });
    }

    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="card-elevated p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-24 mb-3" />
        <div className="h-3 bg-muted rounded w-full mb-2" />
        <div className="h-3 bg-muted rounded w-3/4" />
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="card-elevated p-4">
        <p className="text-sm text-muted-foreground text-center">
          Complete your first diary to see insights here ✨
        </p>
      </div>
    );
  }

  const getDaysAgoLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isYesterday(date)) return "Yesterday's insight";
    const days = differenceInDays(new Date(), date);
    return `${days} days ago`;
  };

  return (
    <button
      onClick={() => navigate(`/recall?diaryId=${insight.diaryId}`)}
      className="card-elevated p-4 w-full text-left group hover:border-primary/30 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span className="text-xs font-medium">{getDaysAgoLabel(insight.date)}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      
      <p className="text-sm text-foreground/90 leading-relaxed mb-3">
        "{insight.highlight}"
      </p>

      {insight.expression && (
        <div className="bg-primary/10 rounded-lg px-3 py-2 inline-block">
          <span className="text-xs font-semibold text-primary">
            {insight.expression.expression}
          </span>
          {insight.expression.meaning && (
            <span className="text-xs text-muted-foreground ml-2">
              — {insight.expression.meaning}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
