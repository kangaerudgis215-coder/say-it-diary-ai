import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Volume2, Play, BookOpen, Check, Loader2, Home, RotateCcw, Eye, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { SentencePractice } from '@/components/SentencePractice';
import { ThreeAxisEvaluation, ThreeAxisScores } from '@/components/ThreeAxisEvaluation';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface EvaluationResult {
  score: number;
  feedback: string;
  usedExpressions: string[];
  missedExpressions: string[];
  threeAxis?: ThreeAxisScores;
  passed?: boolean;
}

type ReviewPhase = 'study' | 'practice' | 'result';

export default function DiaryReview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const diaryId = searchParams.get('diaryId');
  const diaryDate = searchParams.get('date');

  const [diaryEntry, setDiaryEntry] = useState<any>(null);
  const [expressions, setExpressions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [phase, setPhase] = useState<ReviewPhase>('study');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);

  useEffect(() => {
    if (user && diaryId) {
      fetchDiaryEntry();
    }
  }, [user, diaryId]);

  const fetchDiaryEntry = async () => {
    if (!user || !diaryId) return;
    setIsLoading(true);

    const { data: entry } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('id', diaryId)
      .eq('user_id', user.id)
      .maybeSingle();

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

  const handlePlayAudio = async () => {
    if (!diaryEntry?.content || isPlayingAudio) return;

    setIsPlayingAudio(true);
    
    try {
      const utterance = new SpeechSynthesisUtterance(diaryEntry.content);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      
      speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('TTS error:', error);
      setIsPlayingAudio(false);
    }
  };

  const handleStopAudio = () => {
    speechSynthesis.cancel();
    setIsPlayingAudio(false);
  };

  const handleStartPractice = () => {
    setPhase('practice');
  };

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
        hints_used: ['today_memory_test'],
        completed: true,
        score: result.score,
        used_expressions: result.usedExpressions,
        missed_expressions: result.missedExpressions,
      });

      setEvaluationResult(result);
      setPhase('result');

    } catch (error) {
      console.error('Save error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save your practice session.',
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

  const handleComplete = () => {
    navigate('/');
  };

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
        <p className="text-muted-foreground mb-4">Diary not found.</p>
        <Button variant="ghost" onClick={() => navigate('/')}>
          Go home
        </Button>
      </div>
    );
  }

  const dateLabel = diaryDate ? format(new Date(diaryDate), 'MMMM d, yyyy') : 'Today';

  // Result Phase
  if (phase === 'result' && evaluationResult) {
    const isPassed = evaluationResult.passed ?? evaluationResult.score >= 70;

    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={handleBackToStudy}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-xl">Practice Complete</h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {evaluationResult.threeAxis && (
            <ThreeAxisEvaluation scores={evaluationResult.threeAxis} size="lg" />
          )}

          <div className="text-center max-w-sm">
            {isPassed ? (
              <>
                <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                  <Award className="w-8 h-8 text-accent" />
                </div>
                <h2 className="text-xl font-bold mb-2">
                  Great job today! 🎉
                </h2>
                <p className="text-muted-foreground">
                  You practiced {expressions.length} key expressions. Keep up the momentum!
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-primary mb-2">
                  Nice try! 💪
                </h2>
                <p className="text-muted-foreground">
                  {evaluationResult.feedback}
                </p>
              </>
            )}
          </div>

          {evaluationResult.usedExpressions.length > 0 && (
            <div className="w-full max-w-sm">
              <p className="text-xs text-muted-foreground mb-2 uppercase">Expressions used ✓</p>
              <div className="flex flex-wrap gap-2">
                {evaluationResult.usedExpressions.map((exp, i) => (
                  <span key={i} className="text-xs bg-accent/20 text-accent px-3 py-1.5 rounded-full">
                    {exp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {evaluationResult.missedExpressions.length > 0 && (
            <div className="w-full max-w-sm">
              <p className="text-xs text-muted-foreground mb-2 uppercase">Expressions to practice</p>
              <div className="flex flex-wrap gap-2">
                {evaluationResult.missedExpressions.map((exp, i) => (
                  <span key={i} className="text-xs bg-muted text-muted-foreground px-3 py-1.5 rounded-full">
                    {exp}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 mt-6">
          {isPassed ? (
            <Button className="w-full btn-glow" size="lg" onClick={handleComplete}>
              <Home className="w-5 h-5 mr-2" />
              Complete & Go Home
            </Button>
          ) : (
            <>
              <Button className="w-full btn-glow" size="lg" onClick={handleTryAgain}>
                <RotateCcw className="w-5 h-5 mr-2" />
                Practice Again
              </Button>
              <Button variant="outline" size="lg" className="w-full" onClick={handleBackToStudy}>
                <Eye className="w-5 h-5 mr-2" />
                Review Diary Again
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Practice Phase
  if (phase === 'practice') {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={handleBackToStudy}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-xl">Sentence Practice</h1>
            <p className="text-sm text-muted-foreground">{dateLabel}</p>
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

  // Study Phase (default)
  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      {/* Header */}
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-xl">Today's Diary</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* English Diary Card */}
        <div className="card-elevated p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">📝 Your Diary</h2>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90 mb-4">
            {diaryEntry.content}
          </p>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={isPlayingAudio ? handleStopAudio : handlePlayAudio}
            >
              {isPlayingAudio ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Volume2 className="w-4 h-4 mr-2" />
              )}
              {isPlayingAudio ? 'Stop' : 'Listen'}
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={handleStartPractice}
            >
              <Play className="w-4 h-4 mr-2" />
              Practice
            </Button>
          </div>
        </div>

        {/* Japanese Translation */}
        {diaryEntry.japanese_summary && (
          <div className="card-subtle p-4">
            <p className="text-xs text-muted-foreground mb-2">🇯🇵 Japanese</p>
            <p className="text-sm font-japanese leading-relaxed text-muted-foreground">
              {diaryEntry.japanese_summary}
            </p>
          </div>
        )}

        {/* Key Expressions */}
        {expressions.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              💡 Key Expressions
            </h3>
            <div className="grid gap-2">
              {expressions.map((exp) => (
                <div key={exp.id} className="card-elevated p-4">
                  <p className="font-medium text-primary mb-1">{exp.expression}</p>
                  {exp.meaning && (
                    <p className="text-sm text-muted-foreground">{exp.meaning}</p>
                  )}
                  {exp.example_sentence && (
                    <p className="text-xs text-muted-foreground/70 mt-2 italic">
                      e.g. {exp.example_sentence}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Great job card */}
        <div className="card-elevated p-5 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Great job today!</p>
              <p className="text-xs text-muted-foreground">
                You practiced {expressions.length} key expression{expressions.length !== 1 ? 's' : ''}.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="mt-6 space-y-3">
        <Button className="w-full btn-glow" size="lg" onClick={handleStartPractice}>
          <BookOpen className="w-5 h-5 mr-2" />
          Start Sentence Practice
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/')}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
