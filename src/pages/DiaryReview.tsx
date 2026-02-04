import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Volume2, Check, Loader2, Eye, RotateCcw, BookOpen, Target, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ClozeQuiz } from '@/components/ClozeQuiz';
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
      toast({
        variant: 'destructive',
        title: 'Audio Error',
        description: 'Could not play audio. Please try again.',
      });
    }
  };

  const handleStopAudio = () => {
    speechSynthesis.cancel();
    setIsPlayingAudio(false);
  };

  const handleStartPractice = () => {
    setPhase('practice');
  };

  // Evaluate a single sentence or full diary - returns object for new 3-axis system
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
      // Be generous on error
      return { score: 85, passed: true };
    }
  }, []);

  // Handle practice completion (final quiz done)
  const handlePracticeComplete = useCallback(async (transcript: string, score: number, passed: boolean) => {
    if (!user || !diaryEntry) return;

    try {
      const expressionTexts = expressions.map(e => e.expression);
      
      // Get detailed evaluation for the result screen
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

      // Save the session
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
          <h1 className="font-bold text-xl">Memory Test Result</h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {/* Three-axis evaluation */}
          {evaluationResult.threeAxis && (
            <ThreeAxisEvaluation scores={evaluationResult.threeAxis} size="lg" />
          )}

          {/* Feedback */}
          <div className="text-center max-w-sm">
            {isPassed ? (
              <>
                <h2 className="text-xl font-bold text-green-500 mb-2">
                  🎉 Great job!
                </h2>
                <p className="text-muted-foreground">
                  You remembered today's diary very well. Today's memorization is complete!
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
                <p className="text-sm text-muted-foreground mt-2">
                  You've done great practice! Try the full recall again when you're ready.
                </p>
              </>
            )}
          </div>

          {/* Expressions Used/Missed */}
          {evaluationResult.usedExpressions.length > 0 && (
            <div className="w-full max-w-sm bg-green-500/10 rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-2 uppercase">Expressions you used ✓</p>
              <div className="flex flex-wrap gap-2">
                {evaluationResult.usedExpressions.map((exp, i) => (
                  <span key={i} className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                    {exp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {evaluationResult.missedExpressions.length > 0 && (
            <div className="w-full max-w-sm bg-muted rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-2 uppercase">Expressions to practice</p>
              <div className="flex flex-wrap gap-2">
                {evaluationResult.missedExpressions.map((exp, i) => (
                  <span key={i} className="text-xs bg-muted-foreground/20 text-muted-foreground px-2 py-1 rounded">
                    {exp}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mt-6">
          {isPassed ? (
            <Button variant="glow" size="lg" className="w-full" onClick={handleComplete}>
              <Home className="w-5 h-5 mr-2" />
              Complete & Go Home
            </Button>
          ) : (
            <>
              <Button variant="glow" size="lg" className="w-full" onClick={handleTryAgain}>
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

  // Practice Phase - use ClozeQuiz with important sentences
  if (phase === 'practice') {
    // Parse important_sentences if available
    const importantSentences = diaryEntry.important_sentences 
      ? (diaryEntry.important_sentences as Array<{ english: string; japanese: string; expressions?: string[] }>)
      : null;

    // Build sentences array for ClozeQuiz
    const practiceSentences = importantSentences && importantSentences.length > 0
      ? importantSentences
      : diaryEntry.content.split(/[.!?]+/).filter((s: string) => s.trim()).map((s: string, i: number) => ({
          english: s.trim() + '.',
          japanese: diaryEntry.japanese_summary?.split(/[。！？]+/)[i]?.trim() || '',
          expressions: expressions.filter(e => s.toLowerCase().includes(e.expression.toLowerCase())).map(e => e.expression),
        }));

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
          <ClozeQuiz 
            sentences={practiceSentences}
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
          <h1 className="font-bold text-xl">Review Today's Diary</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* English Diary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              📝 English Diary
              <Button
                variant="ghost"
                size="sm"
                onClick={isPlayingAudio ? handleStopAudio : handlePlayAudio}
                disabled={!diaryEntry.content}
              >
                {isPlayingAudio ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
                <span className="ml-1 text-xs">
                  {isPlayingAudio ? 'Stop' : 'Listen'}
                </span>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{diaryEntry.content}</p>
          </CardContent>
        </Card>

        {/* Japanese Translation */}
        {diaryEntry.japanese_summary && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">🇯🇵 Japanese Translation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-japanese leading-relaxed text-muted-foreground">
                {diaryEntry.japanese_summary}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Expressions */}
        {expressions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">💡 Key Expressions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {expressions.map((exp) => (
                  <div key={exp.id} className="bg-muted rounded-lg p-3">
                    <p className="font-medium text-sm text-primary">{exp.expression}</p>
                    {exp.meaning && (
                      <p className="text-xs text-muted-foreground mt-1">{exp.meaning}</p>
                    )}
                    {exp.example_sentence && (
                      <p className="text-xs text-muted-foreground/70 mt-1 italic">
                        e.g. {exp.example_sentence}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 space-y-3">
        <p className="text-xs text-muted-foreground text-center">
          Read the diary, listen to the audio, and review the expressions.
          When ready, start the sentence practice!
        </p>
        <Button variant="glow" size="lg" className="w-full" onClick={handleStartPractice}>
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
