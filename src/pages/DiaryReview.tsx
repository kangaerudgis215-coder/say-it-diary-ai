import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Volume2, Check, Mic, MicOff, Loader2, Eye, RotateCcw, BookOpen, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { StepUpPractice } from '@/components/StepUpPractice';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface EvaluationResult {
  score: number;
  feedback: string;
  usedExpressions: string[];
  missedExpressions: string[];
}

type ReviewPhase = 'study' | 'practice' | 'test' | 'result';

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
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [finalTranscript, setFinalTranscript] = useState('');

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

  const handleSkipToTest = () => {
    resetTranscript();
    setPhase('test');
  };

  const handlePracticeComplete = useCallback((practiceTranscript: string) => {
    setFinalTranscript(practiceTranscript);
    if (practiceTranscript) {
      // Auto-evaluate if we have transcript from practice
      evaluateRecall(practiceTranscript);
    } else {
      setPhase('test');
    }
  }, []);

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const evaluateRecall = async (recallText: string) => {
    if (!user || !diaryEntry) return;

    setIsEvaluating(true);

    try {
      const expressionTexts = expressions.map(e => e.expression);

      const { data: evalData, error: evalError } = await supabase.functions.invoke('evaluate-recall', {
        body: {
          originalText: diaryEntry.content,
          recallText: recallText,
          expressions: expressionTexts,
        },
      });

      if (evalError) {
        throw evalError;
      }

      // Apply a more generous scoring curve for step-up practice
      // If user went through practice, boost score slightly
      const rawScore = evalData.score;
      const boostedScore = phase === 'practice' ? Math.min(100, rawScore + 5) : rawScore;

      const result: EvaluationResult = {
        score: boostedScore,
        feedback: evalData.feedback,
        usedExpressions: evalData.usedExpressions || [],
        missedExpressions: evalData.missedExpressions || [],
      };

      // Save the memory test session
      await supabase.from('recall_sessions').insert({
        user_id: user.id,
        diary_entry_id: diaryEntry.id,
        user_attempt: recallText,
        hints_used: ['today_memory_test'],
        completed: true,
        score: result.score,
        used_expressions: result.usedExpressions,
        missed_expressions: result.missedExpressions,
      });

      setEvaluationResult(result);
      setPhase('result');

    } catch (error) {
      console.error('Evaluation error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to evaluate your memory test.',
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSubmitTest = async () => {
    if (!transcript) return;
    await evaluateRecall(transcript);
  };

  const handleTryAgain = () => {
    resetTranscript();
    setFinalTranscript('');
    setPhase('practice');
    setEvaluationResult(null);
  };

  const handleBackToStudy = () => {
    resetTranscript();
    setFinalTranscript('');
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
    const isPassed = evaluationResult.score >= 90;

    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={handleBackToStudy}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-xl">Memory Test Result</h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {/* Score Circle */}
          <div className={cn(
            "w-32 h-32 rounded-full flex items-center justify-center",
            isPassed ? "bg-green-500/20" : "bg-primary/20"
          )}>
            <span className={cn(
              "text-4xl font-bold",
              isPassed ? "text-green-500" : "text-primary"
            )}>
              {evaluationResult.score}%
            </span>
          </div>

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
              <Check className="w-5 h-5 mr-2" />
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

  // Practice Phase (Step-up memorization)
  if (phase === 'practice') {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom relative">
        <header className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={handleBackToStudy}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-xl">Step-by-Step Practice</h1>
            <p className="text-sm text-muted-foreground">{dateLabel}</p>
          </div>
        </header>

        <StepUpPractice 
          diaryContent={diaryEntry.content}
          onComplete={handlePracticeComplete}
          onSkipToTest={handleSkipToTest}
        />
      </div>
    );
  }

  // Test Phase (Direct recall without step-up)
  if (phase === 'test') {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={handleBackToStudy}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-xl">Memory Test</h1>
            <p className="text-sm text-muted-foreground">{dateLabel}</p>
          </div>
        </header>

        {/* Instructions */}
        <Card className="mb-6 bg-card/50">
          <CardContent className="p-4">
            <p className="text-sm text-center text-muted-foreground">
              Say today's diary in English from memory.
              Try to reach 90% accuracy! 🎯
            </p>
          </CardContent>
        </Card>

        {/* Recording Area */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
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

          {/* Transcript Display */}
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

        {/* Submit Button */}
        <Button
          variant="glow"
          size="lg"
          className="w-full mt-6"
          onClick={handleSubmitTest}
          disabled={!transcript || isEvaluating}
        >
          {isEvaluating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Check className="w-5 h-5 mr-2" />
              Check My Answer
            </>
          )}
        </Button>

        {!transcript && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Speak something to check your memory
          </p>
        )}
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
          When ready, start the step-by-step practice!
        </p>
        <Button variant="glow" size="lg" className="w-full" onClick={handleStartPractice}>
          <BookOpen className="w-5 h-5 mr-2" />
          Start Step-by-Step Practice
        </Button>
        <Button variant="outline" size="lg" className="w-full" onClick={handleSkipToTest}>
          <Target className="w-5 h-5 mr-2" />
          Skip to Memory Test
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/')}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
