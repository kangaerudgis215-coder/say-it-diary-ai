import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Home, BookOpen, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SelectableText } from '@/components/SelectableText';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { SentencePracticeFlow } from '@/components/practice/SentencePracticeFlow';
import { RecallResult } from '@/components/RecallResult';
import { ThreeAxisScores } from '@/components/ThreeAxisEvaluation';
import { format } from 'date-fns';
import {
  buildPracticeSentences,
  persistDiarySentences,
  loadDiarySentences,
  PracticeSentence,
} from '@/lib/practiceBuilder';
import {
  cleanupInvalidDiaryLinkedExpressions,
  partitionExpressionsForText,
} from '@/lib/expressionValidation';

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
  const [practiceSentences, setPracticeSentences] = useState<PracticeSentence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sourceMode, setSourceMode] = useState<'latest' | 'calendar' | 'random'>('latest');
  const [phase, setPhase] = useState<RecallPhase>('study');
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [didGlobalCleanup, setDidGlobalCleanup] = useState(false);

  useEffect(() => {
    fetchDiaryForRecall();
  }, [user, diaryIdFromUrl, modeFromUrl]);

  const fetchDiaryForRecall = async () => {
    if (!user) return;
    setIsLoading(true);
    setDiaryEntry(null);
    setExpressions([]);
    setPracticeSentences([]);
    setEvaluationResult(null);

    // One-time global cleanup: unlink any expression that is not actually present in its diary text.
    if (!didGlobalCleanup) {
      await cleanupInvalidDiaryLinkedExpressions(supabase, user.id);
      setDidGlobalCleanup(true);
    }

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

      // Strict validation: show/use only expressions that actually exist in the diary English text.
      const { valid, invalid } = partitionExpressionsForText(exprList, entry.content || '');
      if (invalid.length > 0) {
        console.warn(
          `[expression-validation] Found ${invalid.length} invalid expression(s) for diary ${entry.id}. Unlinking them.`
        );
        await supabase
          .from('expressions')
          .update({ diary_entry_id: null })
          .in(
            'id',
            invalid.map((x: any) => x.id)
          )
          .eq('user_id', user.id);
      }

      setDiaryEntry(entry);
      setExpressions(valid);

      const exprStrings = valid.map((e: any) => e.expression);
      const important = entry.important_sentences as any[] | null;
      const rebuilt = buildPracticeSentences(entry.content, entry.japanese_summary, exprStrings, important);

      // Canonical sentences: load if present, but repair/rebuild if needed.
      let sentences = await loadDiarySentences(supabase, user.id, entry.id);
      const needsPersist = !sentences || JSON.stringify(sentences) !== JSON.stringify(rebuilt);
      if (needsPersist) {
        await persistDiarySentences(supabase, user.id, entry.id, rebuilt);
        sentences = rebuilt;
      }

      setPracticeSentences(sentences);
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

  // Handle practice completion from the unified flow
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

        // Save recall session
        await supabase.from('recall_sessions').insert({
          user_id: user.id,
          diary_entry_id: diaryEntry.id,
          user_attempt: userAttempt,
          hints_used: ['sentence_practice_3step'],
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
            next_review_date: format(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
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
          {sourceMode === 'calendar' ? 'No diary for this date' : 'No past diaries yet'}
        </h2>
        <p className="text-muted-foreground mb-6 max-w-xs">
          {sourceMode === 'calendar'
            ? 'There is no diary entry for this date. Try selecting a different day.'
            : "You don't have any past diaries yet. Please complete today's diary first! 💪"}
        </p>
        {sourceMode === 'latest' && (
          <Button variant="glow" onClick={() => navigate('/chat')}>
            Start today's diary
          </Button>
        )}
        <Button variant="ghost" onClick={handleGoBack} className="mt-3">
          {sourceMode !== 'latest' ? 'Back to calendar' : 'Go back home'}
        </Button>
      </div>
    );
  }

  const recallingDateLabel = format(new Date(diaryEntry.date), 'MMMM d, yyyy');
  const getModeLabel = () => {
    switch (sourceMode) {
      case 'random':
        return ' (random)';
      case 'latest':
        return ' (most recent)';
      default:
        return '';
    }
  };

  // Practice Phase - unified 3-step flow
  if (phase === 'practice') {
    return (
      <SentencePracticeFlow
        sentences={practiceSentences}
        japaneseSummary={diaryEntry.japanese_summary || ''}
        englishDiary={diaryEntry.content || ''}
        onComplete={handlePracticeComplete}
        onBack={handleBackToStudy}
        title="Recall Practice"
        subtitle={`${recallingDateLabel}${getModeLabel()}`}
      />
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
                  <Volume2 className="w-4 h-4" />
                )}
                <span className="ml-1 text-xs">{isPlayingAudio ? 'Stop' : 'Listen'}</span>
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
              <CardTitle className="text-base">💡 Key Expressions ({expressions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expressions.map((exp) => (
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

        {/* Practice sentences preview */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📋 Practice coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {practiceSentences.length} sentence{practiceSentences.length !== 1 ? 's' : ''} ×{' '}
              {practiceSentences.reduce((c, s) => c + (s.expressions?.length || 0), 0)} expression
              {practiceSentences.reduce((c, s) => c + (s.expressions?.length || 0), 0) !== 1
                ? 's'
                : ''}{' '}
              to practice
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 space-y-3">
        <p className="text-xs text-muted-foreground text-center">
          Review the diary briefly, then start the 3-step sentence practice.
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
