import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Home, RotateCcw, Eye, BookOpen, Volume2, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { SentencePractice } from '@/components/SentencePractice';
import { RecallResult } from '@/components/RecallResult';
import { ThreeAxisScores } from '@/components/ThreeAxisEvaluation';
import { format, differenceInDays, differenceInWeeks } from 'date-fns';
import { cn } from '@/lib/utils';

interface EvaluationResult {
  score: number;
  feedback: string;
  usedExpressions: string[];
  missedExpressions: string[];
  threeAxis?: ThreeAxisScores;
  passed?: boolean;
}

type RecallPhase = 'study' | 'practice' | 'result';

export default function Recall() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const diaryIdFromUrl = searchParams.get('diaryId');
  const modeFromUrl = searchParams.get('mode');

  const [diaryEntry, setDiaryEntry] = useState<any>(null);
  const [expressions, setExpressions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sourceMode, setSourceMode] = useState<'latest' | 'calendar' | 'random'>('latest');
  const [phase, setPhase] = useState<RecallPhase>('study');
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    fetchDiaryForRecall();
  }, [user, diaryIdFromUrl, modeFromUrl]);

  const fetchDiaryForRecall = async () => {
    if (!user) return;
    setIsLoading(true);
    setDiaryEntry(null);
    setExpressions([]);
    setEvaluationResult(null);

    const today = format(new Date(), 'yyyy-MM-dd');

    let entry = null;

    if (diaryIdFromUrl) {
      setSourceMode(modeFromUrl === 'random' ? 'random' : 'calendar');
      const { data } = await supabase
        .from('diary_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('id', diaryIdFromUrl)
        .maybeSingle();
      entry = data;
    } else {
      setSourceMode('latest');
      const { data } = await supabase
        .from('diary_entries')
        .select('*')
        .eq('user_id', user.id)
        .lt('date', today)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      entry = data;
    }

    if (entry) {
      setDiaryEntry(entry);

      const { data: exprs } = await supabase
        .from('expressions')
        .select('*')
        .eq('diary_entry_id', entry.id);

      setExpressions(exprs || []);
    }
    
    setIsLoading(false);
  };

  const handlePlayAudio = useCallback(() => {
    if (!diaryEntry?.content || isPlayingAudio) return;

    setIsPlayingAudio(true);
    const utterance = new SpeechSynthesisUtterance(diaryEntry.content);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    
    speechSynthesis.speak(utterance);
  }, [diaryEntry, isPlayingAudio]);

  const handleStopAudio = useCallback(() => {
    speechSynthesis.cancel();
    setIsPlayingAudio(false);
  }, []);

  const handleEvaluate = useCallback(async (attemptText: string, targetText: string): Promise<{ score: number; threeAxis?: ThreeAxisScores; passed?: boolean }> => {
    try {
      const { data, error } = await supabase.functions.invoke('evaluate-recall', {
        body: {
          originalText: targetText,
          recallText: attemptText,
          expressions: [],
        },
      });

      if (error) throw error;
      return {
        score: data.score || 0,
        threeAxis: data.threeAxis as ThreeAxisScores | undefined,
        passed: data.passed,
      };
    } catch (error) {
      console.error('Evaluation error:', error);
      return { score: 85, passed: true };
    }
  }, []);

  const handlePracticeComplete = useCallback(async (transcript: string, score: number, passed: boolean) => {
    if (!user || !diaryEntry) return;

    try {
      const expressionTexts = expressions.map(e => e.expression);
      
      const { data: evalData } = await supabase.functions.invoke('evaluate-recall', {
        body: {
          originalText: diaryEntry.content,
          recallText: transcript,
          expressions: expressionTexts,
        },
      });

      const result: EvaluationResult = {
        score: evalData?.score || score,
        feedback: evalData?.feedback || 'Great effort!',
        usedExpressions: evalData?.usedExpressions || [],
        missedExpressions: evalData?.missedExpressions || [],
        threeAxis: evalData?.threeAxis,
        passed: evalData?.passed ?? passed,
      };

      await supabase.from('recall_sessions').insert({
        user_id: user.id,
        diary_entry_id: diaryEntry.id,
        user_attempt: transcript,
        hints_used: ['sentence_practice'],
        completed: true,
        score: result.score,
        used_expressions: result.usedExpressions,
        missed_expressions: result.missedExpressions,
      });

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

      setEvaluationResult(result);
      setPhase('result');

    } catch (error) {
      console.error('Save error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save your recall session.',
      });
    }
  }, [user, diaryEntry, expressions, toast]);

  const handleTryAgain = () => {
    setPhase('practice');
    setEvaluationResult(null);
  };

  const handleBackToStudy = () => {
    setPhase('study');
    setEvaluationResult(null);
  };

  const handleStartPractice = () => {
    setPhase('practice');
  };

  const handleGoHome = () => navigate('/');
  
  const handleGoBack = () => {
    if (sourceMode === 'calendar' || sourceMode === 'random') {
      navigate('/calendar');
    } else {
      navigate('/');
    }
  };

  // Result screen
  if (phase === 'result' && evaluationResult) {
    return (
      <RecallResult
        score={evaluationResult.score}
        feedback={evaluationResult.feedback}
        usedExpressions={evaluationResult.usedExpressions}
        missedExpressions={evaluationResult.missedExpressions}
        threeAxis={evaluationResult.threeAxis}
        passed={evaluationResult.passed}
        onTryAgain={handleTryAgain}
        onGoHome={handleGoHome}
        onGoBack={handleGoBack}
        isFromCalendar={sourceMode === 'calendar' || sourceMode === 'random'}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading diary...</p>
      </div>
    );
  }

  if (!diaryEntry) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">
          {sourceMode === 'calendar' ? "No diary for this date" : "No past diaries yet"}
        </h2>
        <p className="text-muted-foreground mb-6 max-w-xs">
          {sourceMode === 'calendar' 
            ? "Try selecting a different day."
            : "Complete today's diary first! 💪"
          }
        </p>
        {sourceMode === 'latest' && (
          <Button className="btn-glow" onClick={() => navigate('/chat')}>
            Start today's diary
          </Button>
        )}
        <Button variant="ghost" onClick={handleGoBack} className="mt-3">
          Go back
        </Button>
      </div>
    );
  }

  const recallingDateLabel = format(new Date(diaryEntry.date), 'MMMM d, yyyy');
  
  const getTimeAgoLabel = () => {
    const date = new Date(diaryEntry.date);
    const days = differenceInDays(new Date(), date);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    const weeks = differenceInWeeks(new Date(), date);
    if (weeks === 1) return '1 week ago';
    return `${weeks} weeks ago`;
  };

  // Practice Phase
  if (phase === 'practice') {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={handleBackToStudy}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-xl">Recall Practice</h1>
            <p className="text-sm text-muted-foreground">{recallingDateLabel}</p>
          </div>
        </header>

        <div className="flex-1">
          <SentencePractice 
            diaryContent={diaryEntry.content}
            japaneseSummary={diaryEntry.japanese_summary}
            onComplete={handlePracticeComplete}
            onEvaluate={handleEvaluate}
          />
        </div>
      </div>
    );
  }

  // Study Phase - Flashback Challenge Style
  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={handleGoBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-xl">Ready to test your memory?</h1>
          <p className="text-sm text-muted-foreground">{getTimeAgoLabel()}</p>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* Challenge Card */}
        <div className="card-elevated p-5 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{recallingDateLabel}</p>
              <p className="font-semibold">Memory Challenge</p>
            </div>
          </div>
          
          <p className="text-sm font-japanese text-secondary-foreground leading-relaxed">
            {diaryEntry.japanese_summary || 'Try to remember what you wrote...'}
          </p>
        </div>

        {/* English Diary (for review) */}
        <div className="card-elevated p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-muted-foreground">📝 Review the diary</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={isPlayingAudio ? handleStopAudio : handlePlayAudio}
            >
              {isPlayingAudio ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {diaryEntry.content}
          </p>
        </div>

        {/* Key Expressions */}
        {expressions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">💡 Key expressions</p>
            <div className="flex flex-wrap gap-2">
              {expressions.slice(0, 5).map((exp) => (
                <span 
                  key={exp.id} 
                  className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full"
                >
                  {exp.expression}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="mt-6 space-y-3">
        <Button className="w-full btn-glow" size="lg" onClick={handleStartPractice}>
          <BookOpen className="w-5 h-5 mr-2" />
          Start Practice
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={handleGoBack}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
