/**
 * Main Review Hub - Unified review page for diary practice
 * Handles per-sentence flow, loop tracking, and full diary challenge
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Volume2, Loader2, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { buildPracticeSentences, loadDiarySentences, persistDiarySentences, PracticeSentence } from '@/lib/practiceBuilder';
import { cleanupInvalidDiaryLinkedExpressions, partitionExpressionsForText } from '@/lib/expressionValidation';
import { ReviewSentence, ReviewStep, DiaryProgress, SentenceProgress } from './types';
import { ClozeStep } from './ClozeStep';
import { FullSentenceStepNew } from './FullSentenceStepNew';
import { FullDiaryChallenge } from './FullDiaryChallenge';
import { RedPenFeedback } from './RedPenFeedback';

type ReviewPhase = 'overview' | 'cloze' | 'full_sentence' | 'full_diary' | 'red_pen';

const LOOPS_TO_UNLOCK = 2;

export function ReviewHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const diaryId = searchParams.get('diaryId');
  const diaryDateParam = searchParams.get('date');

  const [diaryEntry, setDiaryEntry] = useState<any>(null);
  const [sentences, setSentences] = useState<ReviewSentence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [phase, setPhase] = useState<ReviewPhase>('overview');
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [diaryProgress, setDiaryProgress] = useState<DiaryProgress>({
    sentenceProgress: {},
    loopsCompleted: 0,
    fullDiaryChallengeUnlocked: false,
  });
  const [isEnglishExpanded, setIsEnglishExpanded] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [userDiaryAttempt, setUserDiaryAttempt] = useState('');

  // Load diary and sentences
  useEffect(() => {
    if (user && diaryId) {
      loadDiary();
    }
  }, [user, diaryId]);

  const loadDiary = async () => {
    if (!user || !diaryId) return;
    setIsLoading(true);

    // Cleanup invalid expressions
    await cleanupInvalidDiaryLinkedExpressions(supabase, user.id);

    const { data: entry } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('id', diaryId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!entry) {
      setIsLoading(false);
      return;
    }

    setDiaryEntry(entry);

    // Load expressions
    const { data: exprs } = await supabase.from('expressions').select('*').eq('diary_entry_id', entry.id);
    const { valid } = partitionExpressionsForText(exprs || [], entry.content || '');
    const exprStrings = valid.map((e: any) => e.expression);

    // Build or load sentences
    const important = entry.important_sentences as any[] | null;
    const rebuilt = buildPracticeSentences(entry.content, entry.japanese_summary, exprStrings, important);

    let loaded = await loadDiarySentences(supabase, user.id, entry.id);
    if (!loaded || JSON.stringify(loaded) !== JSON.stringify(rebuilt)) {
      await persistDiarySentences(supabase, user.id, entry.id, rebuilt);
      loaded = rebuilt;
    }

    const reviewSentences: ReviewSentence[] = loaded.map((s, i) => ({
      english: s.english,
      japanese: s.japanese,
      expressions: s.expressions,
      index: i,
      hasExpressions: s.expressions.length > 0,
    }));

    setSentences(reviewSentences);

    // Initialize progress
    const initialProgress: Record<number, SentenceProgress> = {};
    for (let i = 0; i < reviewSentences.length; i++) {
      initialProgress[i] = { clozeCompleted: false, fullSentenceCompleted: false, completionCount: 0 };
    }
    setDiaryProgress({
      sentenceProgress: initialProgress,
      loopsCompleted: 0,
      fullDiaryChallengeUnlocked: false,
    });

    setIsLoading(false);
  };

  const currentSentence = sentences[currentSentenceIndex];

  // Calculate loops completed
  const calculateLoops = useCallback((progress: DiaryProgress) => {
    if (sentences.length === 0) return 0;
    const counts = Object.values(progress.sentenceProgress).map((p) => p.completionCount);
    return Math.min(...counts);
  }, [sentences.length]);

  // Handle cloze completion (only called for sentences with expressions)
  const handleClozeComplete = useCallback(() => {
    setDiaryProgress((prev) => {
      const updated = { ...prev };
      updated.sentenceProgress = { ...prev.sentenceProgress };
      updated.sentenceProgress[currentSentenceIndex] = {
        ...prev.sentenceProgress[currentSentenceIndex],
        clozeCompleted: true,
      };
      return updated;
    });
    setPhase('full_sentence');
  }, [currentSentenceIndex]);

  // Move to next sentence helper
  const moveToNextSentence = useCallback(() => {
    if (currentSentenceIndex < sentences.length - 1) {
      const nextIndex = currentSentenceIndex + 1;
      setCurrentSentenceIndex(nextIndex);
      // Check if next sentence has expressions
      const nextSentence = sentences[nextIndex];
      if (nextSentence && !nextSentence.hasExpressions) {
        setPhase('full_sentence'); // Skip cloze
      } else {
        setPhase('cloze');
      }
    } else {
      // Loop complete - go back to overview
      setPhase('overview');
    }
  }, [currentSentenceIndex, sentences]);

  // Handle full sentence completion
  const handleFullSentenceComplete = useCallback(() => {
    setDiaryProgress((prev) => {
      const updated = { ...prev };
      updated.sentenceProgress = { ...prev.sentenceProgress };
      const current = prev.sentenceProgress[currentSentenceIndex];
      updated.sentenceProgress[currentSentenceIndex] = {
        ...current,
        fullSentenceCompleted: true,
        completionCount: current.completionCount + 1,
      };

      // Check if loop completed
      const newLoops = calculateLoops(updated);
      if (newLoops > prev.loopsCompleted) {
        updated.loopsCompleted = newLoops;
        updated.fullDiaryChallengeUnlocked = newLoops >= LOOPS_TO_UNLOCK;
      }

      return updated;
    });

    // Move to next sentence or back to overview
    moveToNextSentence();
  }, [currentSentenceIndex, calculateLoops, moveToNextSentence]);

  const handleBackToCloze = useCallback(() => {
    setPhase('cloze');
  }, []);

  const handleStartPractice = useCallback(() => {
    setCurrentSentenceIndex(0);
    // If first sentence has no expressions, skip to full sentence
    const firstSentence = sentences[0];
    if (firstSentence && !firstSentence.hasExpressions) {
      setPhase('full_sentence');
    } else {
      setPhase('cloze');
    }
  }, [sentences]);

  const handleStartFullDiary = useCallback(() => {
    setPhase('full_diary');
  }, []);

  const handleFullDiaryComplete = useCallback((attempt: string) => {
    setUserDiaryAttempt(attempt);
    setPhase('red_pen');
  }, []);

  const handleTryDiaryAgain = useCallback(() => {
    setUserDiaryAttempt('');
    setPhase('full_diary');
  }, []);

  const handleBackToSentences = useCallback(() => {
    setCurrentSentenceIndex(0);
    setPhase('overview');
  }, []);

  const handleDone = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handlePlayAudio = useCallback(() => {
    if (!diaryEntry?.content || isPlayingAudio) return;
    setIsPlayingAudio(true);
    const u = new SpeechSynthesisUtterance(diaryEntry.content);
    u.lang = 'en-US';
    u.rate = 0.9;
    u.onend = () => setIsPlayingAudio(false);
    u.onerror = () => setIsPlayingAudio(false);
    speechSynthesis.speak(u);
  }, [diaryEntry, isPlayingAudio]);

  const handleStopAudio = useCallback(() => {
    speechSynthesis.cancel();
    setIsPlayingAudio(false);
  }, []);

  const dateLabel = diaryDateParam ? format(new Date(diaryDateParam), 'MMMM d, yyyy') : 'Today';

  // Progress calculation
  const overallProgress = useMemo(() => {
    if (sentences.length === 0) return 0;
    const completedSteps = Object.values(diaryProgress.sentenceProgress).filter((p) => p.fullSentenceCompleted).length;
    return Math.round((completedSteps / sentences.length) * 100);
  }, [sentences.length, diaryProgress.sentenceProgress]);

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

  // Red-pen feedback phase
  if (phase === 'red_pen') {
    return (
      <div className="min-h-screen flex flex-col safe-bottom">
        <header className="sticky top-0 z-10 glass border-b border-border p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBackToSentences}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-bold text-lg">Correction Log</h1>
              <p className="text-xs text-muted-foreground">{dateLabel}</p>
            </div>
          </div>
        </header>
        <div className="flex-1">
          <RedPenFeedback
            sentences={sentences}
            userAttempt={userDiaryAttempt}
            onTryAgain={handleTryDiaryAgain}
            onBackToSentences={handleBackToSentences}
            onDone={handleDone}
          />
        </div>
      </div>
    );
  }

  // Full diary challenge phase
  if (phase === 'full_diary') {
    return (
      <div className="min-h-screen flex flex-col safe-bottom">
        <header className="sticky top-0 z-10 glass border-b border-border p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBackToSentences}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-bold text-lg">Full Diary Challenge</h1>
              <p className="text-xs text-muted-foreground">{dateLabel}</p>
            </div>
          </div>
        </header>
        <div className="flex-1">
          <FullDiaryChallenge
            sentences={sentences}
            japaneseSummary={diaryEntry.japanese_summary || ''}
            onComplete={handleFullDiaryComplete}
            onBack={handleBackToSentences}
          />
        </div>
      </div>
    );
  }

  // Cloze step
  if (phase === 'cloze' && currentSentence) {
    return (
      <div className="min-h-screen flex flex-col safe-bottom">
        <header className="sticky top-0 z-10 glass border-b border-border p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBackToSentences}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="font-bold text-lg">Step 1: Cloze</h1>
              <p className="text-xs text-muted-foreground">{dateLabel}</p>
            </div>
          </div>
          <div className="mt-2">
            <Progress value={overallProgress} className="h-1" />
          </div>
        </header>
        <div className="flex-1">
          <ClozeStep
            english={currentSentence.english}
            japanese={currentSentence.japanese}
            expressions={currentSentence.expressions}
            onComplete={handleClozeComplete}
            sentenceNumber={currentSentenceIndex + 1}
            totalSentences={sentences.length}
          />
        </div>
      </div>
    );
  }

  // Full sentence step
  if (phase === 'full_sentence' && currentSentence) {
    const stepLabel = currentSentence.hasExpressions ? 'Step 2: Full Sentence' : 'Full Sentence';
    const handleBack = currentSentence.hasExpressions ? handleBackToCloze : handleBackToSentences;
    
    return (
      <div className="min-h-screen flex flex-col safe-bottom">
        <header className="sticky top-0 z-10 glass border-b border-border p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="font-bold text-lg">{stepLabel}</h1>
              <p className="text-xs text-muted-foreground">{dateLabel}</p>
            </div>
          </div>
          <div className="mt-2">
            <Progress value={overallProgress} className="h-1" />
          </div>
        </header>
        <div className="flex-1">
          <FullSentenceStepNew
            english={currentSentence.english}
            japanese={currentSentence.japanese}
            expressions={currentSentence.expressions}
            onComplete={handleFullSentenceComplete}
            onBackToCloze={handleBackToCloze}
            sentenceNumber={currentSentenceIndex + 1}
            totalSentences={sentences.length}
            isLastSentence={currentSentenceIndex === sentences.length - 1}
            hasClozeStep={currentSentence.hasExpressions}
          />
        </div>
      </div>
    );
  }

  // Overview phase (default)
  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-xl">Review Diary</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* Japanese summary */}
        {diaryEntry.japanese_summary && (
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">🇯🇵 What this diary was about</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-japanese">{diaryEntry.japanese_summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Collapsible English diary */}
        <Collapsible open={isEnglishExpanded} onOpenChange={setIsEnglishExpanded}>
          <Card>
            <CardHeader className="pb-2">
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full">
                  <CardTitle className="text-sm flex items-center gap-2">
                    📝 English Diary (Review)
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        isPlayingAudio ? handleStopAudio() : handlePlayAudio();
                      }}
                    >
                      {isPlayingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                  </CardTitle>
                  {isEnglishExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <p className="text-sm leading-relaxed">{diaryEntry.content}</p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Progress stats */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-xs text-muted-foreground">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2 mb-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{sentences.length} sentences</span>
              <span>
                Loops: {diaryProgress.loopsCompleted} / {LOOPS_TO_UNLOCK}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Key expressions */}
        {sentences.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">💡 Key Expressions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {sentences.flatMap((s) => s.expressions).filter((e, i, arr) => arr.indexOf(e) === i).map((expr, i) => (
                  <span key={i} className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/15">
                    {expr}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Full diary challenge unlock */}
        {diaryProgress.fullDiaryChallengeUnlocked && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Trophy className="w-6 h-6 text-primary" />
                <div>
                  <p className="font-medium text-sm">Full Diary Challenge Unlocked!</p>
                  <p className="text-xs text-muted-foreground">
                    You completed {LOOPS_TO_UNLOCK} loops. Ready for the ultimate test?
                  </p>
                </div>
              </div>
              <Button variant="glow" size="sm" className="w-full" onClick={handleStartFullDiary}>
                Try saying the whole diary
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-6 space-y-3">
        <Button variant="glow" size="lg" className="w-full" onClick={handleStartPractice}>
          {overallProgress > 0 ? 'Continue Practice' : 'Start Sentence Practice'}
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={handleDone}>
          Back to Home
        </Button>
      </div>
    </div>
  );
}

export default ReviewHub;
