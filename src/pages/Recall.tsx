import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Languages, Check, Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
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
  const [isCompleting, setIsCompleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  useEffect(() => {
    fetchYesterdayDiary();
  }, [user]);

  const fetchYesterdayDiary = async () => {
    if (!user) return;
    setIsLoading(true);

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
    
    setIsLoading(false);
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
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
        user_attempt: transcript,
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
          review_count: (diaryEntry.review_count || 0) + 1,
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading yesterday's diary...</p>
      </div>
    );
  }

  if (!diaryEntry) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">No diary from yesterday yet</h2>
        <p className="text-muted-foreground mb-6 max-w-xs">
          Please complete today's diary first! Once you do, you can recall it tomorrow. 💪
        </p>
        <Button variant="glow" onClick={() => navigate('/chat')}>
          Start today's diary
        </Button>
        <Button variant="ghost" onClick={() => navigate('/')} className="mt-3">
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
            Recalling: {format(subDays(new Date(), 1), 'MMMM d, yyyy')}
          </p>
        </div>
      </header>

      {/* Instructions */}
      <div className="bg-card rounded-2xl p-4 border border-border mb-6">
        <p className="text-sm text-center text-muted-foreground">
          Try to say yesterday's diary in English, from memory.
          If you get stuck, use the hint buttons below! 💭
        </p>
      </div>

      {/* Recording Area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 mb-6">
        {!isSupported ? (
          <div className="text-center p-4 bg-destructive/10 rounded-xl">
            <p className="text-sm text-destructive">
              Speech recognition is not supported in your browser.
              Please try Chrome or Edge.
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={handleMicClick}
              className={cn(
                "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300",
                isListening
                  ? "bg-destructive/20 animate-pulse"
                  : "bg-primary/20 hover:bg-primary/30"
              )}
            >
              {isListening ? (
                <MicOff className="w-12 h-12 text-destructive" />
              ) : (
                <Mic className="w-12 h-12 text-primary" />
              )}
            </button>

            <p className="text-sm text-muted-foreground">
              {isListening ? "Tap to stop recording" : "Tap to start speaking"}
            </p>
          </>
        )}

        {/* Live transcript display */}
        <div className="w-full max-w-md min-h-32 p-4 rounded-xl bg-muted border border-border">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
            Your spoken text:
          </p>
          {transcript || interimTranscript ? (
            <p className="text-sm">
              {transcript}
              {interimTranscript && (
                <span className="text-muted-foreground italic">
                  {transcript ? ' ' : ''}{interimTranscript}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {isListening ? "Listening..." : "Start speaking to see your text here..."}
            </p>
          )}
        </div>

        {transcript && (
          <Button variant="ghost" size="sm" onClick={resetTranscript}>
            Clear and try again
          </Button>
        )}
      </div>

      {/* Hint Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Button
          variant={showJapaneseHint ? "secondary" : "outline"}
          onClick={() => setShowJapaneseHint(!showJapaneseHint)}
          className="h-auto py-3 flex flex-col gap-1"
        >
          <Languages className="w-5 h-5" />
          <span className="text-xs">Show Japanese hint</span>
        </Button>

        <Button
          variant={showExpressionHint ? "secondary" : "outline"}
          onClick={() => setShowExpressionHint(!showExpressionHint)}
          className="h-auto py-3 flex flex-col gap-1"
        >
          <Lightbulb className="w-5 h-5" />
          <span className="text-xs">Show key English phrases</span>
        </Button>
      </div>

      {/* Hints Display */}
      {showJapaneseHint && (
        <div className="bg-secondary/50 rounded-xl p-4 mb-4 animate-in fade-in duration-300">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
            Japanese Hint
          </p>
          {diaryEntry.japanese_summary ? (
            <p className="text-sm font-japanese text-secondary-foreground">
              {diaryEntry.japanese_summary}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No Japanese summary available for this entry.
            </p>
          )}
        </div>
      )}

      {showExpressionHint && (
        <div className="bg-accent/30 rounded-xl p-4 mb-4 animate-in fade-in duration-300">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
            Key English Phrases
          </p>
          {expressions.length > 0 ? (
            <div className="space-y-2">
              {expressions.slice(0, 7).map((exp) => (
                <p key={exp.id} className="text-sm text-accent-foreground">
                  • {exp.expression}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No expressions saved for this entry.
            </p>
          )}
        </div>
      )}

      {/* Complete Button */}
      <Button
        variant="glow"
        size="lg"
        onClick={handleComplete}
        disabled={isCompleting || !transcript}
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

      {!transcript && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          Speak something to complete the recall
        </p>
      )}
    </div>
  );
}
