import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Volume2, Loader2, BookOpen, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SelectableText } from '@/components/SelectableText';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { SentencePracticeFlow } from '@/components/practice/SentencePracticeFlow';
import { ThreeAxisEvaluation, ThreeAxisScores } from '@/components/ThreeAxisEvaluation';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  buildPracticeSentences,
  persistDiarySentences,
  loadDiarySentences,
  PracticeSentence,
} from '@/lib/practiceBuilder';

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
  const [practiceSentences, setPracticeSentences] = useState<PracticeSentence[]>([]);
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

      const { data: exprs } = await supabase.from('expressions').select('*').eq('diary_entry_id', entry.id);

      const exprList = exprs || [];
      setExpressions(exprList);

      // Load or build canonical sentences
      let sentences = await loadDiarySentences(supabase, user.id, entry.id);

      if (!sentences || sentences.length === 0) {
        const exprStrings = exprList.map((e) => e.expression);
        const important = entry.important_sentences as any[] | null;
        sentences = buildPracticeSentences(entry.content, entry.japanese_summary, exprStrings, important);
        await persistDiarySentences(supabase, user.id, entry.id, sentences);
      }

      setPracticeSentences(sentences);
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

  // Handle practice completion
  const handlePracticeComplete = useCallback(
    async (userAttempt: string, accuracy: number, usedExprs: string[], missedExprs: string[]) => {
      if (!user || !diaryEntry) return;

      try {
        const result: EvaluationResult = {
          score: accuracy,
          feedback:
            usedExprs.length > 0
              ? `You used ${usedExprs.length} key expression${usedExprs.length > 1 ? 's' : ''}!`
              : 'Great effort!',
          usedExpressions: usedExprs,
          missedExpressions: missedExprs,
          passed: accuracy >= 60,
        };

        // Save the session
        await supabase.from('recall_sessions').insert({
          user_id: user.id,
          diary_entry_id: diaryEntry.id,
          user_attempt: userAttempt,
          hints_used: ['today_memory_test_3step'],
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
    },
    [user, diaryEntry, toast]
  );

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
    const isPassed = evaluationResult.passed ?? evaluationResult.score >= 60;

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
          {evaluationResult.threeAxis && <ThreeAxisEvaluation scores={evaluationResult.threeAxis} size="lg" />}

          {/* Feedback */}
          <div className="text-center max-w-sm">
            {isPassed ? (
              <>
                <h2 className="text-xl font-bold text-primary mb-2">🎉 Great job!</h2>
                <p className="text-muted-foreground">
                  You remembered today's diary very well. Today's memorization is complete!
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-primary mb-2">Nice try! 💪</h2>
                <p className="text-muted-foreground">{evaluationResult.feedback}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  You've done great practice! Try the full recall again when you're ready.
                </p>
              </>
            )}
          </div>

          {/* Expressions Used/Missed */}
          {evaluationResult.usedExpressions.length > 0 && (
            <div className="w-full max-w-sm bg-primary/10 rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-2 uppercase">Expressions you used ✓</p>
              <div className="flex flex-wrap gap-2">
                {evaluationResult.usedExpressions.map((exp, i) => (
                  <span key={i} className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
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
                  <span
                    key={i}
                    className="text-xs bg-muted-foreground/20 text-muted-foreground px-2 py-1 rounded"
                  >
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
                Practice Again
              </Button>
              <Button variant="outline" size="lg" className="w-full" onClick={handleBackToStudy}>
                Review Diary Again
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Practice Phase - unified 3-step flow
  if (phase === 'practice') {
    return (
      <SentencePracticeFlow
        sentences={practiceSentences}
        japaneseSummary={diaryEntry.japanese_summary || ''}
        englishDiary={diaryEntry.content || ''}
        onComplete={handlePracticeComplete}
        onBack={handleBackToStudy}
        title="Sentence Practice"
        subtitle={dateLabel}
      />
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
                {isPlayingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                <span className="ml-1 text-xs">{isPlayingAudio ? 'Stop' : 'Listen'}</span>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SelectableText
              text={diaryEntry.content}
              diaryEntryId={diaryEntry.id}
              className="text-sm leading-relaxed"
              onExpressionSaved={fetchDiaryEntry}
            />
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
              <CardTitle className="text-base">💡 Key Expressions ({expressions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {expressions.map((exp) => (
                  <div key={exp.id} className="bg-muted rounded-lg p-3">
                    <p className="font-medium text-sm text-primary">{exp.expression}</p>
                    {exp.meaning && <p className="text-xs text-muted-foreground mt-1">{exp.meaning}</p>}
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

        {/* Practice coverage */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📋 Practice coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {practiceSentences.length} sentence{practiceSentences.length !== 1 ? 's' : ''} ×{' '}
              {practiceSentences.reduce((c, s) => c + (s.expressions?.length || 0), 0)} expression
              {practiceSentences.reduce((c, s) => c + (s.expressions?.length || 0), 0) !== 1 ? 's' : ''} to
              practice
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 space-y-3">
        <p className="text-xs text-muted-foreground text-center">
          Read the diary, listen to the audio, and review the expressions. When ready, start the sentence
          practice!
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
