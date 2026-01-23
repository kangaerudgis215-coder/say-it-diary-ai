import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export default function Expressions() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [expressions, setExpressions] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchExpressions();
  }, [user]);

  const fetchExpressions = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('expressions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setExpressions(data || []);
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
                <span className="font-medium text-primary">{exp.expression}</span>
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
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
