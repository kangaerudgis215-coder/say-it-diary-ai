import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Mic, MicOff, Loader2, ChevronRight, Keyboard, Eye, EyeOff, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { QuizResultScreen } from '@/components/QuizResultScreen';
import { FadingPractice } from '@/components/FadingPractice';
import { ThreeAxisScores, calculatePassStatus } from '@/components/ThreeAxisEvaluation';
import { useInstantComposition } from '@/hooks/useInstantComposition';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type Phase = 'start' | 'test' | 'result' | 'practice';

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
  const [lastUserAnswer, setLastUserAnswer] = useState('');

  const currentInput = showTyping ? typedInput : transcript;

  const handleStartPractice = useCallback(() => {
    pickRandomSentence();
    setPhase('test');
    setEvaluationResult(null);
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
    setLastUserAnswer(currentInput);
    
    try {
      // Call evaluate-recall for similarity score
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
    setPhase('test');
    setEvaluationResult(null);
    resetTranscript();
    setTypedInput('');
    setLastUserAnswer('');
  }, [nextSentence, resetTranscript]);

  const handleTryAgain = useCallback(() => {
    setPhase('test');
    setEvaluationResult(null);
    resetTranscript();
    setTypedInput('');
  }, [resetTranscript]);

  const handleEnterPracticeMode = useCallback(() => {
    setPhase('practice');
    resetTranscript();
    setTypedInput('');
  }, [resetTranscript]);

  const handlePracticeComplete = useCallback((passed: boolean) => {
    if (passed) {
      handleNextSentence();
    } else {
      // Go back to test phase
      setPhase('test');
      setEvaluationResult(null);
      resetTranscript();
      setTypedInput('');
    }
  }, [handleNextSentence, resetTranscript]);

  const handleEvaluateForPractice = useCallback(async (text: string, target: string) => {
    const { data } = await supabase.functions.invoke('evaluate-recall', {
      body: {
        originalText: target,
        recallText: text,
        expressions: currentSentence?.sentence.expressions || [],
      },
    });

    const score = data?.score || 50;
    const threeAxis = data?.threeAxis || {
      meaning: score >= 85 ? 'excellent' : score >= 60 ? 'good' : 'needs_work',
      structure: score >= 85 ? 'excellent' : score >= 60 ? 'good' : 'needs_work',
      fluency: score >= 85 ? 'excellent' : score >= 60 ? 'good' : 'needs_work',
    } as ThreeAxisScores;

    return {
      score,
      threeAxis,
      passed: calculatePassStatus(threeAxis).passed,
    };
  }, [currentSentence]);

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

          <h2 className="text-xl font-bold mb-3">Quick Composition Practice</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            See a Japanese sentence from your past diaries. 
            Instantly compose the English version by speaking or typing.
          </p>

          {hasAnySentences ? (
            <>
              <div className="bg-muted rounded-xl p-4 mb-8 text-sm">
                <p className="text-muted-foreground">
                  Today: <span className="text-foreground font-medium">{stats.practiced}</span> practiced, 
                  <span className="text-green-400 font-medium ml-1">{stats.passed}</span> passed
                </p>
              </div>

              <Button variant="glow" size="lg" onClick={handleStartPractice}>
                <Zap className="w-5 h-5 mr-2" />
                Start Practice
              </Button>
            </>
          ) : (
            <div className="bg-muted rounded-xl p-6 text-center">
              <p className="text-muted-foreground mb-4">
                No past diaries yet. Complete a few daily diaries first to unlock this practice mode.
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

  // Practice mode with fading English
  if (phase === 'practice' && currentSentence) {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setPhase('start')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-lg flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Practice Mode
            </h1>
            <p className="text-xs text-muted-foreground">
              Master this sentence with fading support
            </p>
          </div>
        </header>

        <FadingPractice
          englishSentence={currentSentence.sentence.english}
          japaneseSentence={currentSentence.sentence.japanese}
          keyExpressions={currentSentence.sentence.expressions}
          onComplete={handlePracticeComplete}
          onEvaluate={handleEvaluateForPractice}
        />
      </div>
    );
  }

  // Result screen
  if (phase === 'result' && evaluationResult && currentSentence) {
    const { passed } = evaluationResult;
    
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setPhase('start')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-xl">Result</h1>
        </header>

        <div className="flex-1">
          <QuizResultScreen
            userAnswer={lastUserAnswer}
            correctAnswer={currentSentence.sentence.english}
            scores={evaluationResult.scores}
            keyExpressions={currentSentence.sentence.expressions}
            onTryAgain={handleTryAgain}
            onNext={handleNextSentence}
            nextLabel="Next Sentence"
            showTryAgain={!passed}
          />
        </div>

        {/* Practice mode option when failed */}
        {!passed && (
          <div className="mt-4">
            <Button
              variant="secondary"
              size="lg"
              className="w-full gap-2"
              onClick={handleEnterPracticeMode}
            >
              <GraduationCap className="w-5 h-5" />
              Enter Practice Mode
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Practice with gradually fading English text
            </p>
          </div>
        )}

        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full mt-4" 
          onClick={() => setPhase('start')}
        >
          End Practice
        </Button>
      </div>
    );
  }

  // Test screen (Japanese only, user tries to produce English)
  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setPhase('start')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-lg">Compose in English</h1>
          <p className="text-xs text-muted-foreground">
            Practiced today: {stats.practiced}
          </p>
        </div>
      </header>

      {/* Japanese sentence to translate */}
      <Card className="mb-6 bg-secondary/30">
        <CardContent className="py-6">
          <p className="text-xs text-muted-foreground mb-2 text-center uppercase tracking-wide">
            Say this in English:
          </p>
          <p className="text-lg text-center font-japanese text-secondary-foreground leading-relaxed">
            {currentSentence?.sentence.japanese || 'Loading...'}
          </p>
        </CardContent>
      </Card>

      {/* Key expressions hint */}
      {currentSentence?.sentence.expressions && currentSentence.sentence.expressions.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {currentSentence.sentence.expressions.map((expr, i) => (
            <span key={i} className="px-2 py-1 bg-primary/20 rounded-full text-xs text-primary">
              {expr}
            </span>
          ))}
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
                      ? "bg-destructive/20 animate-pulse"
                      : "bg-primary/20 hover:bg-primary/30"
                  )}
                >
                  {isListening ? (
                    <MicOff className="w-8 h-8 text-destructive" />
                  ) : (
                    <Mic className="w-8 h-8 text-primary" />
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
              <div className="w-full p-3 rounded-lg bg-muted/50 border border-border">
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
        variant="glow"
        size="lg"
        className="w-full"
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
