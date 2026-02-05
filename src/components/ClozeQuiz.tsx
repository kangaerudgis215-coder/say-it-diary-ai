import { useState, useEffect, useCallback, useMemo } from 'react';
import { Volume2, Mic, MicOff, Loader2, ChevronRight, Keyboard, Lightbulb, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { ExpressionOnlyResultScreen } from '@/components/expressionPractice/ExpressionOnlyResultScreen';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { useVocabularyLog } from '@/hooks/useVocabularyLog';
import { cn } from '@/lib/utils';
import { checkKeyExpressionsEnhanced, normalizeForExpression } from '@/lib/textComparison';

interface PracticeSentence {
  english: string;
  japanese: string;
  expressions?: string[];
}

type QuizStep = 'show' | 'partial_cloze' | 'full_cloze' | 'result';

interface ClozeQuizProps {
  sentences: PracticeSentence[];
  onComplete: (attemptText: string, score: number, passed: boolean) => void;
  // Legacy prop (kept to avoid breaking callers) — cloze mode is expression-only.
  onEvaluate?: (text: string, target: string) => Promise<any>;
}

// Generate a cloze (gap-fill) version of a sentence
function generateCloze(sentence: string, expressions?: string[]): string {
  const words = sentence.split(/\s+/);
  if (words.length <= 3) {
    // Very short sentence - just hide the last word
    const lastWord = words[words.length - 1];
    return words.slice(0, -1).join(' ') + ' ____';
  }

  // Expression-focused cloze: ONLY hide key expressions (no random extra blanks)
  if (expressions && expressions.length > 0) {
    let cloze = sentence;
    for (const expr of expressions) {
      if (!expr?.trim()) continue;
      // Replace the exact phrase (case-insensitive). We intentionally don't use word boundaries
      // because many expressions include punctuation/hyphens.
      const escaped = expr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      cloze = cloze.replace(regex, '____');
    }

    // If nothing was hidden (mismatch), fall back to hiding the last word.
    if (!cloze.includes('____')) {
      const lastWord = words[words.length - 1];
      return words.slice(0, -1).join(' ') + ' ____';
    }
    return cloze;
  }

  // No expressions: simple fallback
  const lastWord = words[words.length - 1];
  return words.slice(0, -1).join(' ') + ' ____';
}

export function ClozeQuiz({ sentences, onComplete, onEvaluate }: ClozeQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<QuizStep>('show');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [showTyping, setShowTyping] = useState(false);
  const [lastUserAnswer, setLastUserAnswer] = useState('');
  const [lastExpressionCheck, setLastExpressionCheck] = useState<ReturnType<typeof checkKeyExpressionsEnhanced> | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [completedSentences, setCompletedSentences] = useState<Set<number>>(new Set());
  const [attemptLog, setAttemptLog] = useState<string[]>([]);

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
  const { logSpokenWords } = useVocabularyLog();

  const currentSentence = sentences[currentIndex];
  const currentInput = showTyping ? typedInput : transcript;
  const totalSentences = sentences.length;
  
  const progress = useMemo(() => {
    const baseProgress = (completedSentences.size / totalSentences) * 100;
    const stepBonus = step === 'partial_cloze' ? 2 : step === 'full_cloze' ? 4 : step === 'result' ? 5 : 0;
    return Math.min(100, baseProgress + (stepBonus / totalSentences));
  }, [completedSentences.size, totalSentences, step]);

  const clozeText = useMemo(() => {
    if (!currentSentence) return '';
    return generateCloze(currentSentence.english, currentSentence.expressions);
  }, [currentSentence]);

  const keyExpressions = useMemo(() => {
    const exprs = currentSentence?.expressions ?? [];
    // Final safety: only keep expressions that actually appear in the target sentence.
    const sentNorm = normalizeForExpression(currentSentence?.english ?? '');
    return exprs.filter((e) => sentNorm.includes(normalizeForExpression(e)));
  }, [currentSentence]);

  // Reset state when sentence changes
  useEffect(() => {
    resetTranscript();
    setTypedInput('');
    setShowHint(false);
  }, [currentIndex, resetTranscript]);

  const handlePlayAudio = useCallback(() => {
    if (isPlayingAudio) {
      speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }
    if (!currentSentence) return;

    setIsPlayingAudio(true);
    const utterance = new SpeechSynthesisUtterance(currentSentence.english);
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

  const handleReadyToPractice = useCallback(() => {
    setStep('partial_cloze');
  }, []);

  const handleCheckAnswer = useCallback(async () => {
    if (!currentSentence || !currentInput) return;
    
    setIsEvaluating(true);
    setLastUserAnswer(currentInput);
    
    try {
      // Log spoken vocabulary
      logSpokenWords(currentInput);
      
      // Expression-only grading: PASS iff all key expressions are present.
      const expressionCheck = checkKeyExpressionsEnhanced(currentInput, keyExpressions);
      setLastExpressionCheck(expressionCheck);

      if (expressionCheck.allPresent) playSuccess();

      // Always show result screen for feedback — user controls when to retry/advance.
      setStep('result');
    } catch (error) {
      console.error('Evaluation error:', error);
    } finally {
      setIsEvaluating(false);
    }
  }, [currentSentence, currentInput, keyExpressions, playSuccess, logSpokenWords]);

  const handleTryAgain = useCallback(() => {
    // Go back to the previous cloze step for this sentence
    setStep('partial_cloze');
    setLastExpressionCheck(null);
    resetTranscript();
    setTypedInput('');
    setLastUserAnswer('');
  }, [resetTranscript]);

  const handleNext = useCallback(() => {
    // Mark current as completed
    setCompletedSentences(prev => new Set([...prev, currentIndex]));

    // Record this attempt for the session transcript
    setAttemptLog((prev) => {
      const next = [...prev];
      next[currentIndex] = lastUserAnswer;
      return next;
    });
    
    if (currentIndex < sentences.length - 1) {
      // Move to next sentence - reset state first, then advance
      const nextIndex = currentIndex + 1;
      setLastUserAnswer('');
      setLastExpressionCheck(null);
      setStep('show');
      setCurrentIndex(nextIndex);
    } else {
      // All sentences done
      playBigSuccess();

      const finalLog = [...attemptLog];
      finalLog[currentIndex] = lastUserAnswer;
      const transcript = finalLog.filter(Boolean).join('\n');

      // Expression-only practice: if they reached here, all key expressions were cleared.
      onComplete(transcript, 100, true);
    }
  }, [attemptLog, currentIndex, sentences.length, lastUserAnswer, playBigSuccess, onComplete]);

  const getStepLabel = () => {
    switch (step) {
      case 'show': return 'Read & understand';
      case 'partial_cloze': return 'Fill the gaps';
      case 'full_cloze': return 'Say it from memory';
      case 'result': return 'Result';
    }
  };

  if (!currentSentence) {
    return <div className="text-center text-muted-foreground">No sentences to practice</div>;
  }

  // Result screen - always show when we have scores
  if (step === 'result') {
    const expressionCheck = lastExpressionCheck ?? checkKeyExpressionsEnhanced(lastUserAnswer, keyExpressions);

    if (!lastExpressionCheck && !lastUserAnswer) {
      // Safety fallback - should not happen but handle gracefully
      return (
        <div className="flex flex-col h-full items-center justify-center">
          <p className="text-muted-foreground">Loading result...</p>
          <Button variant="ghost" onClick={handleNext} className="mt-4">
            Continue
          </Button>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col h-full">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Sentence {currentIndex + 1} of {totalSentences}
            </span>
            <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <ExpressionOnlyResultScreen
          userAnswer={lastUserAnswer}
          correctSentence={currentSentence.english}
          keyExpressions={keyExpressions}
          expressionCheck={expressionCheck}
          onTryAgain={handleTryAgain}
          onNext={handleNext}
          nextLabel={currentIndex < sentences.length - 1 ? 'Next Sentence' : 'Complete!'}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            Sentence {currentIndex + 1} of {totalSentences} — {getStepLabel()}
          </span>
          <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step indicator */}
      <div className="flex justify-center gap-2 mb-4">
        {['show', 'partial_cloze', 'full_cloze'].map((s, i) => (
          <div
            key={s}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              s === step ? "bg-primary" : 
              (s === 'show' && step !== 'show') || 
              (s === 'partial_cloze' && step === 'full_cloze') 
                ? "bg-primary/40" : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Content based on step */}
      {step === 'show' && (
        <>
          {/* Full English + Japanese */}
          <Card className="mb-4">
            <CardContent className="p-4 space-y-3">
              <p className="text-lg text-center leading-relaxed">
                {currentSentence.english}
              </p>
              <div className="border-t border-border pt-3">
                <p className="text-sm text-center font-japanese text-muted-foreground">
                  {currentSentence.japanese}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Key expressions */}
          {currentSentence.expressions && currentSentence.expressions.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {currentSentence.expressions.map((expr, i) => (
                <span key={i} className="px-2 py-1 bg-primary/20 rounded-full text-xs text-primary">
                  {expr}
                </span>
              ))}
            </div>
          )}

          {/* Audio button */}
          <div className="flex justify-center mb-6">
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

          {/* Ready button */}
          <div className="mt-auto">
            <Button variant="glow" size="lg" className="w-full" onClick={handleReadyToPractice}>
              <ChevronRight className="w-5 h-5 mr-2" />
              Ready to practice
            </Button>
          </div>
        </>
      )}

      {(step === 'partial_cloze' || step === 'full_cloze') && (
        <>
          {/* Key-expression-only indicator */}
          {keyExpressions.length > 0 && (
            <div className="mb-3 rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-2">
                Key expression(s) being tested:
              </p>
              <div className="flex flex-wrap gap-2">
                {keyExpressions.map((expr, i) => (
                  <span key={`${expr}-${i}`} className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/15">
                    {expr}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sentence display */}
          <Card className="mb-4">
            <CardContent className="p-4 space-y-3">
              {step === 'partial_cloze' ? (
                // Cloze version
                <p className="text-lg text-center leading-relaxed">
                  {clozeText.split('____').map((part, i, arr) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span className="inline-block w-16 border-b-2 border-primary mx-1" />
                      )}
                    </span>
                  ))}
                </p>
              ) : (
                // Full cloze - only Japanese
                <p className="text-xs text-muted-foreground text-center mb-2">
                  Say the full sentence in English:
                </p>
              )}
              
              <div className={cn(
                "border-t border-border pt-3",
                step === 'full_cloze' && "border-t-0 pt-0"
              )}>
                <p className="text-base text-center font-japanese text-secondary-foreground">
                  {currentSentence.japanese}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Hint button */}
          <div className="flex justify-center gap-2 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHint(!showHint)}
              className="gap-1"
            >
              {showHint ? <Eye className="w-4 h-4" /> : <Lightbulb className="w-4 h-4" />}
              {showHint ? 'Hide hint' : 'Show hint'}
            </Button>
          </div>

          {/* Hint display */}
          {showHint && (
            <Card className="mb-4 bg-muted/30 border-dashed">
              <CardContent className="py-3">
                {step === 'full_cloze' ? (
                  <p className="text-sm text-muted-foreground text-center">
                    First words: <span className="text-foreground">{currentSentence.english.split(' ').slice(0, 3).join(' ')}...</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground text-center">
                    Key expressions: {keyExpressions.join(', ') || 'None'}
                  </p>
                )}
              </CardContent>
            </Card>
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
          {showTyping ? (
            <Textarea
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder="Type the full English sentence..."
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

          {/* Check button */}
          <div className="mt-auto">
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
                  <ChevronRight className="w-5 h-5 mr-2" />
                  Check Answer
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
