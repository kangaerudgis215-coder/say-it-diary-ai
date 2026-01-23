import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Languages, Check, Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Recall() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [diaryEntry, setDiaryEntry] = useState<any>(null);
  const [expressions, setExpressions] = useState<any[]>([]);
  const [showJapaneseHint, setShowJapaneseHint] = useState(false);
  const [showExpressionHint, setShowExpressionHint] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attempt, setAttempt] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    fetchYesterdayDiary();
  }, [user]);

  const fetchYesterdayDiary = async () => {
    if (!user) return;

    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    const { data: entry } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', yesterday)
      .single();

    if (entry) {
      setDiaryEntry(entry);

      // Fetch expressions
      const { data: exprs } = await supabase
        .from('expressions')
        .select('*')
        .eq('diary_entry_id', entry.id);

      setExpressions(exprs || []);
    }
  };

  const handleComplete = async () => {
    if (!user || !diaryEntry) return;

    setIsCompleting(true);

    try {
      // Save recall session
      await supabase.from('recall_sessions').insert({
        user_id: user.id,
        diary_entry_id: diaryEntry.id,
        user_attempt: attempt,
        hints_used: [
          ...(showJapaneseHint ? ['japanese'] : []),
          ...(showExpressionHint ? ['expressions'] : []),
        ],
        completed: true,
      });

      // Update diary entry review count
      await supabase
        .from('diary_entries')
        .update({
          review_count: diaryEntry.review_count + 1,
          next_review_date: format(
            new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            'yyyy-MM-dd'
          ),
        })
        .eq('id', diaryEntry.id);

      toast({
        title: "Great recall session! 🧠",
        description: "Your memory is getting stronger!",
      });

      navigate('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save recall session',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  if (!diaryEntry) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground text-center">
          No diary entry from yesterday to recall.
        </p>
        <Button variant="soft" onClick={() => navigate('/')} className="mt-4">
          Go back home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      {/* Header */}
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-xl">Recall Yesterday</h1>
          <p className="text-sm text-muted-foreground">
            {format(subDays(new Date(), 1), 'MMMM d, yyyy')}
          </p>
        </div>
      </header>

      {/* Instructions */}
      <div className="bg-card rounded-2xl p-4 border border-border mb-6">
        <p className="text-sm text-center text-muted-foreground">
          Try to remember and speak yesterday's diary entry from memory.
          Use hints if you get stuck! 💭
        </p>
      </div>

      {/* Recording Area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 mb-6">
        <button
          onClick={() => setIsRecording(!isRecording)}
          className={cn(
            "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300",
            isRecording
              ? "bg-destructive/20 pulse-gentle"
              : "bg-primary/20 hover:bg-primary/30"
          )}
        >
          {isRecording ? (
            <MicOff className="w-12 h-12 text-destructive" />
          ) : (
            <Mic className="w-12 h-12 text-primary" />
          )}
        </button>

        <p className="text-sm text-muted-foreground">
          {isRecording ? "Tap to stop recording" : "Tap to start speaking"}
        </p>

        {/* Text input as fallback */}
        <textarea
          value={attempt}
          onChange={(e) => setAttempt(e.target.value)}
          placeholder="Or type your recall attempt here..."
          className="w-full max-w-md h-32 p-4 rounded-xl bg-muted border-0 text-sm resize-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Hint Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Button
          variant={showJapaneseHint ? "secondary" : "outline"}
          onClick={() => setShowJapaneseHint(!showJapaneseHint)}
          className="h-auto py-3 flex flex-col gap-1"
        >
          <Languages className="w-5 h-5" />
          <span className="text-xs">Japanese Hint</span>
        </Button>

        <Button
          variant={showExpressionHint ? "secondary" : "outline"}
          onClick={() => setShowExpressionHint(!showExpressionHint)}
          className="h-auto py-3 flex flex-col gap-1"
        >
          <Lightbulb className="w-5 h-5" />
          <span className="text-xs">Key Expressions</span>
        </Button>
      </div>

      {/* Hints Display */}
      {showJapaneseHint && diaryEntry.japanese_summary && (
        <div className="bg-secondary/50 rounded-xl p-4 mb-4 fade-in">
          <p className="text-sm font-japanese text-secondary-foreground">
            {diaryEntry.japanese_summary}
          </p>
        </div>
      )}

      {showExpressionHint && expressions.length > 0 && (
        <div className="bg-accent/30 rounded-xl p-4 mb-4 fade-in">
          <div className="space-y-2">
            {expressions.slice(0, 5).map((exp) => (
              <p key={exp.id} className="text-sm text-accent-foreground">
                • {exp.expression}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Complete Button */}
      <Button
        variant="glow"
        size="lg"
        onClick={handleComplete}
        disabled={isCompleting}
        className="w-full"
      >
        {isCompleting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Check className="w-5 h-5" />
            Complete Recall
          </>
        )}
      </Button>
    </div>
  );
}
