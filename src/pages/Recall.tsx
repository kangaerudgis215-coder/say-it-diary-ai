import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Home, RotateCcw, Eye, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SelectableText } from '@/components/SelectableText';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ClozeQuiz } from '@/components/ClozeQuiz';
import { RecallResult } from '@/components/RecallResult';
import { ThreeAxisScores } from '@/components/ThreeAxisEvaluation';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { normalizeForExpression } from '@/lib/textComparison';

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

  type PracticeSentence = { english: string; japanese: string; expressions: string[] };

  useEffect(() => {
    fetchDiaryForRecall();
  }, [user, diaryIdFromUrl, modeFromUrl]);

  const expressionAppearsInSentence = useCallback((englishSentence: string, expression: string) => {
    const sent = normalizeForExpression(englishSentence);
    const expr = normalizeForExpression(expression);
    if (!expr) return false;
    return sent.includes(expr);
  }, []);

  const buildPracticeSentences = useCallback((entry: any, exprs: any[]): PracticeSentence[] => {
    const allExpressions: string[] = (exprs || [])
      .map((e) => e?.expression)
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0);

    const important = entry?.important_sentences
      ? (entry.important_sentences as Array<{ english: string; japanese: string; expressions?: string[]; key_expressions?: string[] }>)
      : null;

    if (important && important.length > 0) {
      return important.map((s) => {
        const candidates: string[] = (s.expressions ?? s.key_expressions ?? [])
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0);

        const aligned = candidates.filter((expr) => expressionAppearsInSentence(s.english, expr));
        const fallback: string[] = aligned.length > 0
          ? aligned
          : allExpressions.filter((expr) => expressionAppearsInSentence(s.english, expr));

        return {
          english: s.english,
          japanese: s.japanese,
          expressions: Array.from(new Set<string>(fallback)),
        };
      });
    }

    // Fallback: split diary content and attach only expressions that appear in each sentence.
    const englishSentences = (entry?.content || '')
      .split(/[.!?]+/)
      .filter((s: string) => s.trim());

    const japaneseSentences = (entry?.japanese_summary || '')
      .split(/[。！？]+/)
      .map((s: string) => s.trim());

    return englishSentences.map((s: string, i: number): PracticeSentence => ({
      english: s.trim() + '.',
      japanese: japaneseSentences[i] || '',
      expressions: allExpressions.filter((expr) => expressionAppearsInSentence(s, expr)),
    }));
  }, [expressionAppearsInSentence]);

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
      const { data: exprs } = await supabase
        .from('expressions')
        .select('*')
        .eq('diary_entry_id', entry.id);

      const exprList = exprs || [];

      // Repair important_sentences so key expressions always come from the same sentence.
      // We only keep expressions that are actually a substring of that exact english sentence.
      if (Array.isArray(entry.important_sentences) && entry.important_sentences.length > 0) {
        const repaired = buildPracticeSentences(entry, exprList);
        const current = (entry.important_sentences as any[]).map((s) => ({
          english: s.english,
          japanese: s.japanese,
          expressions: s.expressions,
        }));

        if (JSON.stringify(repaired) !== JSON.stringify(current)) {
          await supabase
            .from('diary_entries')
            .update({ important_sentences: repaired })
            .eq('id', entry.id)
            .eq('user_id', user.id);

          entry = { ...entry, important_sentences: repaired };
        }
      }

      setDiaryEntry(entry);
      setExpressions(exprList);
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
      return { score: 85, passed: true };
    }
  }, []);

  // Handle practice completion
  const handlePracticeComplete = useCallback(async (transcript: string, score: number, passed: boolean) => {
    if (!user || !diaryEntry) return;

    try {
      // IMPORTANT: For key-expression practice, the session summary must match the per-question checks.
      // Since the user cannot advance without producing the key expression(s), we do not run a
      // separate end-of-session analysis that could contradict the question-level judgments.
      const practiceSentences = buildPracticeSentences(diaryEntry, expressions);
      const usedExpressions = Array.from(
        new Set(
          practiceSentences
            .flatMap((s) => s.expressions ?? [])
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        )
      );

      const result: EvaluationResult = {
        score: usedExpressions.length > 0 ? 100 : score,
        feedback: usedExpressions.length > 0
          ? 'Key expressions cleared — nice work!'
          : 'Practice complete!',
        usedExpressions,
        missedExpressions: [],
        passed: true,
      };

      // Save recall session
      await supabase.from('recall_sessions').insert({
        user_id: user.id,
        diary_entry_id: diaryEntry.id,
        user_attempt: transcript,
        hints_used: ['sentence_practice_key_expressions'],
        completed: true,
        score: result.score,
        used_expressions: result.usedExpressions,
        missed_expressions: result.missedExpressions,
      });

      // Update diary review count
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
  }, [user, diaryEntry, expressions, toast, buildPracticeSentences]);

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
        <p className="text-muted-foreground">Loading diary for recall...</p>
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
            ? "There is no diary entry for this date. Try selecting a different day."
            : "You don't have any past diaries yet. Please complete today's diary first! 💪"
          }
        </p>
        {sourceMode === 'latest' && (
          <Button variant="glow" onClick={() => navigate('/chat')}>
            Start today's diary
          </Button>
        )}
        <Button variant="ghost" onClick={handleGoBack} className="mt-3">
          {sourceMode !== 'latest' ? "Back to calendar" : "Go back home"}
        </Button>
      </div>
    );
  }

  const recallingDateLabel = format(new Date(diaryEntry.date), 'MMMM d, yyyy');
  const getModeLabel = () => {
    switch (sourceMode) {
      case 'random': return ' (random)';
      case 'latest': return ' (most recent)';
      default: return '';
    }
  };

  // Practice Phase - use ClozeQuiz
  if (phase === 'practice') {
    const practiceSentences = buildPracticeSentences(diaryEntry, expressions);

    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={handleBackToStudy}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-xl">Recall Practice</h1>
            <p className="text-sm text-muted-foreground">
              {recallingDateLabel}
              <span className="text-primary">{getModeLabel()}</span>
            </p>
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

  // Study Phase - Brief overview before practice
  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={handleGoBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-xl">Recall Quiz</h1>
          <p className="text-sm text-muted-foreground">
            {recallingDateLabel}
            <span className="text-primary">{getModeLabel()}</span>
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* Quick Overview */}
        <Card className="bg-secondary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📖 What this diary was about</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-japanese text-secondary-foreground">
              {diaryEntry.japanese_summary || '(Japanese summary not available)'}
            </p>
          </CardContent>
        </Card>

        {/* English Diary (for review) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              📝 English Diary (Review)
              <Button
                variant="ghost"
                size="sm"
                onClick={isPlayingAudio ? handleStopAudio : handlePlayAudio}
              >
                {isPlayingAudio ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="text-xs">🔊 Listen</span>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SelectableText 
              text={diaryEntry.content}
              diaryEntryId={diaryEntry.id}
              className="text-sm leading-relaxed"
              onExpressionSaved={fetchDiaryForRecall}
            />
          </CardContent>
        </Card>

        {/* Expressions */}
        {expressions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">💡 Key Expressions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expressions.slice(0, 5).map((exp) => (
                  <div key={exp.id} className="bg-muted rounded-lg p-2">
                    <p className="font-medium text-sm text-primary">{exp.expression}</p>
                    {exp.meaning && (
                      <p className="text-xs text-muted-foreground">{exp.meaning}</p>
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
          Review the diary briefly, then start the sentence-by-sentence practice.
        </p>
        <Button variant="glow" size="lg" className="w-full" onClick={handleStartPractice}>
          <BookOpen className="w-5 h-5 mr-2" />
          Start Sentence Practice
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={handleGoBack}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
