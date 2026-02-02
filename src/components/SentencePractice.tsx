import { useState, useEffect, useCallback } from 'react';
import { Volume2, Mic, MicOff, Loader2, Check, RotateCcw, ChevronRight, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { ThreeAxisEvaluation, ThreeAxisScores, calculatePassStatus } from '@/components/ThreeAxisEvaluation';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSentencePractice } from '@/hooks/useSentencePractice';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { cn } from '@/lib/utils';

interface SentencePracticeProps {
  diaryContent: string;
  japaneseSummary: string | null;
  importantSentences?: Array<{ english: string; japanese: string; expressions?: string[] }>;
  onComplete: (transcript: string, score: number, passed: boolean) => void;
  onEvaluate: (text: string, target: string) => Promise<{ score: number; threeAxis?: ThreeAxisScores; passed?: boolean }>;
}

export function SentencePractice({ 
  diaryContent, 
  japaneseSummary,
  importantSentences,
  onComplete,
  onEvaluate 
}: SentencePracticeProps) {
  const {
    sentences,
    currentSentence,
    currentSentenceIndex,
    currentStep,
    repeatCount,
    totalRepeatSteps,
    phase,
    progress,
    totalSentences,
    recordRepeat,
    markSentenceCleared,
    retryCurrentSentence,
    markComplete,
    getStepInstruction,
    isFinalQuiz
  } = useSentencePractice(
    diaryContent, 
    japaneseSummary,
    importantSentences
  );

  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  const { playSuccess, playBigSuccess } = useSuccessSound();

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [showTyping, setShowTyping] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastScores, setLastScores] = useState<ThreeAxisScores | null>(null);
  const [lastPassed, setLastPassed] = useState<boolean | null>(null);
  const [showLowScoreOption, setShowLowScoreOption] = useState(false);
  const [finalAttemptText, setFinalAttemptText] = useState('');

  // Combined input (speech or typed)
  const currentInput = showTyping ? typedInput : transcript;

  // Reset state when step or sentence changes
  useEffect(() => {
    resetTranscript();
    setTypedInput('');
    setLastScores(null);
    setLastPassed(null);
    setShowLowScoreOption(false);
  }, [currentSentenceIndex, currentStep, resetTranscript]);

  const handlePlayAudio = useCallback(() => {
    if (isPlayingAudio) {
      speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    const text = currentSentence?.english || '';
    if (!text) return;

    setIsPlayingAudio(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    
    speechSynthesis.speak(utterance);
  }, [currentSentence, isPlayingAudio]);

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      setTypedInput('');
      startListening();
    }
  }, [isListening, stopListening, resetTranscript, startListening]);

  const handleRepeatNext = useCallback(() => {
    recordRepeat();
    resetTranscript();
    setTypedInput('');
  }, [recordRepeat, resetTranscript]);

  const handleCheckRecall = useCallback(async () => {
    if (!currentSentence || !currentInput) return;
    
    setIsEvaluating(true);
    try {
      const result = await onEvaluate(currentInput, currentSentence.english);
      
      const threeAxis = result.threeAxis || {
        meaning: result.score >= 85 ? 'excellent' : result.score >= 60 ? 'good' : 'needs_work',
        structure: result.score >= 85 ? 'excellent' : result.score >= 60 ? 'good' : 'needs_work',
        fluency: result.score >= 85 ? 'excellent' : result.score >= 60 ? 'good' : 'needs_work',
      } as ThreeAxisScores;
      
      const passed = result.passed !== undefined ? result.passed : calculatePassStatus(threeAxis).passed;
      
      setLastScores(threeAxis);
      setLastPassed(passed);
      
      if (passed) {
        playSuccess();
        // Small delay before moving on
        setTimeout(() => {
          markSentenceCleared();
        }, 800);
      } else {
        setShowLowScoreOption(true);
      }
    } catch (error) {
      console.error('Evaluation error:', error);
      // On error, be generous and let them continue
      markSentenceCleared();
    } finally {
      setIsEvaluating(false);
    }
  }, [currentSentence, currentInput, onEvaluate, playSuccess, markSentenceCleared]);

  const handleFinalCheck = useCallback(async () => {
    setIsEvaluating(true);
    const attemptText = showTyping ? typedInput : transcript;
    setFinalAttemptText(attemptText);
    
    try {
      const result = await onEvaluate(attemptText, diaryContent);
      
      const threeAxis = result.threeAxis || {
        meaning: result.score >= 85 ? 'excellent' : result.score >= 60 ? 'good' : 'needs_work',
        structure: result.score >= 85 ? 'excellent' : result.score >= 60 ? 'good' : 'needs_work',
        fluency: result.score >= 85 ? 'excellent' : result.score >= 60 ? 'good' : 'needs_work',
      } as ThreeAxisScores;
      
      const passed = result.passed !== undefined ? result.passed : calculatePassStatus(threeAxis).passed;
      
      setLastScores(threeAxis);
      setLastPassed(passed);
      
      if (passed) {
        playBigSuccess();
        setTimeout(() => {
          markComplete();
          onComplete(attemptText, result.score, true);
        }, 800);
      } else {
        setShowLowScoreOption(true);
      }
    } catch (error) {
      console.error('Evaluation error:', error);
      onComplete(attemptText, 0, false);
    } finally {
      setIsEvaluating(false);
    }
  }, [showTyping, typedInput, transcript, diaryContent, onEvaluate, playBigSuccess, markComplete, onComplete]);

  const handleRetryFromRepeat = useCallback(() => {
    retryCurrentSentence();
    setShowLowScoreOption(false);
    setLastScores(null);
    setLastPassed(null);
  }, [retryCurrentSentence]);

  const handleTryFinalAgain = useCallback(() => {
    resetTranscript();
    setTypedInput('');
    setLastScores(null);
    setLastPassed(null);
    setShowLowScoreOption(false);
  }, [resetTranscript]);

  // Final Quiz Phase
  if (isFinalQuiz) {
    return (
      <div className="flex flex-col h-full">
        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Final Memory Test
            </span>
            <span className="text-xs text-muted-foreground">
              {progress}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Japanese hints for all sentences */}
        <Card className="mb-4 bg-secondary/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
              Say the diary in English:
            </p>
            {sentences.map((s, i) => (
              <p key={i} className="text-sm font-japanese text-secondary-foreground mb-1">
                {i + 1}. {s.japanese || '(Japanese not available)'}
              </p>
            ))}
          </CardContent>
        </Card>

        {/* Three-axis evaluation display */}
        {lastScores && (
          <div className="mb-4">
            <ThreeAxisEvaluation scores={lastScores} size="md" />
          </div>
        )}

        {/* Input area */}
        {!showLowScoreOption && (
          <>
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-muted-foreground">
                {getStepInstruction()}
              </p>
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

            {showTyping ? (
              <Textarea
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                placeholder="Type the diary in English..."
                className="min-h-32 mb-4"
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
          </>
        )}

        {/* Action buttons */}
        <div className="mt-auto space-y-2">
          {showLowScoreOption ? (
            <>
              <Button
                variant="glow"
                size="lg"
                className="w-full"
                onClick={handleTryFinalAgain}
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Try Again
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => onComplete(finalAttemptText, 0, false)}
              >
                Finish Anyway
              </Button>
            </>
          ) : (
            <Button
              variant="glow"
              size="lg"
              className="w-full"
              onClick={handleFinalCheck}
              disabled={!currentInput || isEvaluating}
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
          )}
        </div>
      </div>
    );
  }

  // Sentence Practice Phase
  return (
    <div className="flex flex-col h-full">
      {/* Progress Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            Sentence {currentSentenceIndex + 1} of {totalSentences}
          </span>
          <span className="text-xs text-muted-foreground">
            {progress}%
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Instruction */}
      <p className="text-sm text-muted-foreground text-center mb-3">
        {getStepInstruction()}
      </p>

      {/* Current sentence display */}
      <Card className="mb-4">
        <CardContent className="p-4">
          {currentStep === 'repeat' ? (
            // Show English during repeat phase
            <p className="text-lg text-center leading-relaxed">
              {currentSentence?.english}
            </p>
          ) : (
            // Show Japanese during recall phase
            <>
              <p className="text-xs text-muted-foreground mb-2 text-center">
                Japanese hint:
              </p>
              <p className="text-lg text-center font-japanese text-secondary-foreground">
                {currentSentence?.japanese || '(Japanese not available)'}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Three-axis evaluation display */}
      {lastScores && (
        <div className="mb-4">
          <ThreeAxisEvaluation scores={lastScores} size="sm" />
        </div>
      )}

      {/* Audio button for repeat step */}
      {currentStep === 'repeat' && !showLowScoreOption && !lastScores && (
        <div className="flex justify-center mb-4">
          <Button
            variant="default"
            size="lg"
            onClick={handlePlayAudio}
            disabled={isPlayingAudio}
            className="gap-2"
          >
            {isPlayingAudio ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
            {isPlayingAudio ? 'Playing...' : 'Listen'}
          </Button>
        </div>
      )}

      {/* Input toggle */}
      {!showLowScoreOption && !lastScores && (
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
      )}

      {/* Input area */}
      {!showLowScoreOption && !lastScores && (
        showTyping ? (
          <Textarea
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            placeholder="Type the sentence..."
            className="min-h-20 mb-4"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 mb-4">
            {isSupported ? (
              <>
                <button
                  onClick={handleMicClick}
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300",
                    isListening
                      ? "bg-destructive/20 animate-pulse"
                      : "bg-primary/20 hover:bg-primary/30"
                  )}
                >
                  {isListening ? (
                    <MicOff className="w-6 h-6 text-destructive" />
                  ) : (
                    <Mic className="w-6 h-6 text-primary" />
                  )}
                </button>
                <p className="text-xs text-muted-foreground">
                  {isListening ? "Tap to stop" : "Tap to speak"}
                </p>
              </>
            ) : (
              <p className="text-sm text-destructive">Speech not supported</p>
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
        )
      )}

      {/* Action buttons */}
      <div className="mt-auto space-y-2">
        {showLowScoreOption ? (
          <>
            <Button
              variant="glow"
              size="lg"
              className="w-full"
              onClick={handleRetryFromRepeat}
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Review & Try Again
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={markSentenceCleared}
            >
              Continue Anyway
            </Button>
          </>
        ) : currentStep === 'repeat' ? (
          <Button
            variant="glow"
            size="lg"
            className="w-full"
            onClick={handleRepeatNext}
          >
            <ChevronRight className="w-5 h-5 mr-2" />
            {repeatCount < totalRepeatSteps - 1 
              ? `Next (${repeatCount + 2}/${totalRepeatSteps})`
              : 'Done Repeating'
            }
          </Button>
        ) : (
          <Button
            variant="glow"
            size="lg"
            className="w-full"
            onClick={handleCheckRecall}
            disabled={!currentInput || isEvaluating}
          >
            {isEvaluating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                Check Recall
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
