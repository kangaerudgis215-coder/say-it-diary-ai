import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Mic, MicOff, Loader2, ChevronRight, Keyboard, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ThreeAxisEvaluation, ThreeAxisScores } from '@/components/ThreeAxisEvaluation';
import { useInstantComposition } from '@/hooks/useInstantComposition';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type Phase = 'start' | 'practice' | 'result';

export default function InstantComposition() {
  const navigate = useNavigate();
  const {
    isLoading,
    currentSentence,
    hasAnySentences,
    stats,
    pickRandomSentence,
    evaluateAnswer,
    nextSentence,
  } = useInstantComposition();

  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  const { playSuccess } = useSuccessSound();

  const [phase, setPhase] = useState<Phase>('start');
  const [showTyping, setShowTyping] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{ scores: ThreeAxisScores; passed: boolean } | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const currentInput = showTyping ? typedInput : transcript;

  const handleStartPractice = useCallback(() => {
    pickRandomSentence();
    setPhase('practice');
    setEvaluationResult(null);
    setShowAnswer(false);
    resetTranscript();
    setTypedInput('');
  }, [pickRandomSentence, resetTranscript]);

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      setTypedInput('');
      startListening();
    }
  }, [isListening, stopListening, resetTranscript, startListening]);

  const handleCheckAnswer = useCallback(async () => {
    if (!currentSentence || !currentInput) return;

    setIsEvaluating(true);
    try {
      const { data } = await supabase.functions.invoke('evaluate-recall', {
        body: {
          originalText: currentSentence.sentence.english,
          recallText: currentInput,
          expressions: currentSentence.sentence.expressions || [],
        },
      });

      const similarityScore = data?.score || 50;
      const result = await evaluateAnswer(currentInput, similarityScore);
      
      setEvaluationResult(result);
      setPhase('result');

      if (result.passed) {
        playSuccess();
      }
    } catch (error) {
      console.error('Evaluation error:', error);
    } finally {
      setIsEvaluating(false);
    }
  }, [currentSentence, currentInput, evaluateAnswer, playSuccess]);

  const handleNextSentence = useCallback(() => {
    nextSentence();
    setPhase('practice');
    setEvaluationResult(null);
    setShowAnswer(false);
    resetTranscript();
    setTypedInput('');
  }, [nextSentence, resetTranscript]);

  const handleTryAgain = useCallback(() => {
    setPhase('practice');
    setEvaluationResult(null);
    resetTranscript();
    setTypedInput('');
  }, [resetTranscript]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading sentences...</p>
      </div>
    );
  }

  // Start screen
  if (phase === 'start') {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-xl">Instant English</h1>
            <p className="text-sm text-muted-foreground">瞬間英作文</p>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
            <Zap className="w-10 h-10 text-primary" />
          </div>

          <h2 className="text-xl font-bold mb-3">Quick Composition</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            See a Japanese sentence from your past diaries. 
            Instantly compose the English version.
          </p>

          {hasAnySentences ? (
            <>
              <div className="card-elevated p-4 mb-8">
                <p className="text-sm text-muted-foreground">
                  Today: <span className="text-foreground font-semibold">{stats.practiced}</span> practiced, 
                  <span className="text-accent font-semibold ml-1">{stats.passed}</span> passed
                </p>
              </div>

              <Button className="btn-glow" size="lg" onClick={handleStartPractice}>
                <Zap className="w-5 h-5 mr-2" />
                Start Practice
              </Button>
            </>
          ) : (
            <div className="card-elevated p-6 text-center">
              <p className="text-muted-foreground mb-4">
                Complete a few daily diaries first to unlock this mode.
              </p>
              <Button variant="outline" onClick={() => navigate('/chat')}>
                Start today's diary
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Result screen
  if (phase === 'result' && evaluationResult && currentSentence) {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setPhase('start')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-xl">Result</h1>
        </header>

        <div className="flex-1 space-y-4">
          <ThreeAxisEvaluation scores={evaluationResult.scores} size="lg" />

          {/* Your answer */}
          <div className="card-elevated p-4">
            <p className="text-xs text-muted-foreground mb-2 uppercase">Your answer</p>
            <p className="text-sm">{currentInput}</p>
          </div>

          {/* Correct answer */}
          <div className="card-elevated p-4 bg-accent/10 border-accent/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase">Correct answer</p>
              {currentSentence.sentence.expressions && currentSentence.sentence.expressions.length > 0 && (
                <span className="text-xs text-primary">
                  Key: {currentSentence.sentence.expressions.join(', ')}
                </span>
              )}
            </div>
            <p className="text-sm text-accent">{currentSentence.sentence.english}</p>
          </div>

          {/* Japanese reference */}
          <div className="card-subtle p-4">
            <p className="text-sm font-japanese text-muted-foreground">
              {currentSentence.sentence.japanese}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <Button className="w-full btn-glow" size="lg" onClick={handleNextSentence}>
            <ChevronRight className="w-5 h-5 mr-2" />
            Next Sentence
          </Button>
          {!evaluationResult.passed && (
            <Button variant="outline" size="lg" className="w-full" onClick={handleTryAgain}>
              Try This One Again
            </Button>
          )}
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setPhase('start')}>
            End Practice
          </Button>
        </div>
      </div>
    );
  }

  // Practice screen
  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setPhase('start')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-lg">Compose in English</h1>
          <p className="text-xs text-muted-foreground">
            Practiced: {stats.practiced}
          </p>
        </div>
      </header>

      {/* Japanese sentence to translate */}
      <div className="card-elevated p-6 mb-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <p className="text-xs text-muted-foreground mb-3 text-center uppercase tracking-wide">
          Say this in English
        </p>
        <p className="text-lg text-center font-japanese leading-relaxed">
          {currentSentence?.sentence.japanese || 'Loading...'}
        </p>
      </div>

      {/* Peek at answer button */}
      <div className="flex justify-center mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAnswer(!showAnswer)}
          className="gap-2 text-muted-foreground"
        >
          {showAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showAnswer ? 'Hide answer' : 'Peek at answer'}
        </Button>
      </div>

      {showAnswer && currentSentence && (
        <div className="card-subtle p-4 mb-4 border border-dashed border-border">
          <p className="text-sm text-muted-foreground italic text-center">
            {currentSentence.sentence.english}
          </p>
        </div>
      )}

      {/* Input toggle */}
      <div className="flex justify-end mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTyping(!showTyping)}
          className="gap-1"
        >
          <Keyboard className="w-4 h-4" />
          {showTyping ? 'Use mic' : 'Type'}
        </Button>
      </div>

      {/* Input area */}
      <div className="flex-1">
        {showTyping ? (
          <Textarea
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            placeholder="Type the English sentence..."
            className="min-h-24 mb-4"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 mb-4">
            {isSupported ? (
              <>
                <button
                  onClick={handleMicClick}
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300",
                    isListening
                      ? "bg-destructive text-destructive-foreground pulse-gentle"
                      : "bg-primary text-primary-foreground shadow-glow hover:shadow-glow-lg hover:scale-105"
                  )}
                >
                  {isListening ? (
                    <MicOff className="w-8 h-8" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </button>
                <p className="text-xs text-muted-foreground">
                  {isListening ? "Tap to stop" : "Tap to speak"}
                </p>
              </>
            ) : (
              <p className="text-sm text-destructive">Speech not supported. Use typing instead.</p>
            )}

            {(transcript || interimTranscript) && (
              <div className="w-full card-elevated p-4">
                <p className="text-xs text-muted-foreground mb-1">Your response:</p>
                <p className="text-sm">
                  {transcript}
                  {interimTranscript && (
                    <span className="text-muted-foreground italic"> {interimTranscript}</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Check button */}
      <Button
        className="w-full btn-glow"
        size="lg"
        onClick={handleCheckAnswer}
        disabled={!currentInput || isEvaluating}
      >
        {isEvaluating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Zap className="w-5 h-5 mr-2" />
            Check Answer
          </>
        )}
      </Button>
    </div>
  );
}
