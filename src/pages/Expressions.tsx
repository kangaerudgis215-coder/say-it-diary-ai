import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ExpressionWithDiary {
  id: string;
  expression: string;
  meaning: string | null;
  example_sentence: string | null;
  mastery_level: number;
  diary_entry_id: string | null;
  created_at: string;
  diary_date?: string | null;
}

export default function Expressions() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [expressions, setExpressions] = useState<ExpressionWithDiary[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchExpressions();
  }, [user]);

  const fetchExpressions = async () => {
    if (!user) return;

    // Fetch expressions with their associated diary dates
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

  const formatDiaryDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown date';
    return format(new Date(dateStr), 'MMMM d, yyyy');
  };

  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      {/* Header */}
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-xl">My Expressions</h1>
          <p className="text-sm text-muted-foreground">
            {expressions.length} phrases collected
          </p>
        </div>
      </header>

      {/* Expressions List */}
      {expressions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-bold text-lg mb-2">No expressions yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Start writing diary entries and I'll extract useful English expressions for you to review!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {expressions.map((exp) => (
            <button
              key={exp.id}
              onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)}
              className={cn(
                "w-full text-left bg-card rounded-xl p-4 border border-border transition-all",
                "hover:border-primary/30",
                expandedId === exp.id && "border-primary/50"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="font-medium text-primary">{exp.expression}</span>
                  {exp.diary_date && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>From: {formatDiaryDate(exp.diary_date)}</span>
                    </div>
                  )}
                </div>
                <ChevronRight 
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    expandedId === exp.id && "rotate-90"
                  )} 
                />
              </div>
              
              {expandedId === exp.id && (
                <div className="mt-3 pt-3 border-t border-border space-y-2 fade-in">
                  {exp.meaning && (
                    <p className="text-sm text-muted-foreground">
                      <span className="text-foreground/70">Meaning:</span> {exp.meaning}
                    </p>
                  )}
                  {exp.example_sentence && (
                    <p className="text-sm text-muted-foreground italic">
                      "{exp.example_sentence}"
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-xs text-muted-foreground">
                      Mastery: {exp.mastery_level}/5
                    </span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(exp.mastery_level / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                  {exp.diary_entry_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/calendar?date=${exp.diary_date}`);
                      }}
                    >
                      View diary from this day
                    </Button>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
