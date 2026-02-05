import { useState, useEffect, useCallback, useMemo } from 'react';
import { Volume2, Mic, MicOff, Loader2, ChevronRight, Keyboard, Lightbulb, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { QuizResultScreen } from '@/components/QuizResultScreen';
import { ThreeAxisScores, calculatePassStatus } from '@/components/ThreeAxisEvaluation';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { cn } from '@/lib/utils';

interface PracticeSentence {
  english: string;
  japanese: string;
  expressions?: string[];
}

type QuizStep = 'show' | 'partial_cloze' | 'full_cloze' | 'result';

interface ClozeQuizProps {
  sentences: PracticeSentence[];
  onComplete: (attemptText: string, score: number, passed: boolean) => void;
  onEvaluate: (text: string, target: string) => Promise<{ 
    score: number; 
    threeAxis?: ThreeAxisScores; 
    passed?: boolean 
  }>;
}

// Generate a cloze (gap-fill) version of a sentence
function generateCloze(sentence: string, expressions?: string[]): string {
  const words = sentence.split(/\s+/);
  if (words.length <= 3) {
    // Very short sentence - just hide the last word
    const lastWord = words[words.length - 1];
    return words.slice(0, -1).join(' ') + ' ____';
  }

  // Prefer to hide key expressions if available
  let cloze = sentence;
  let hiddenCount = 0;
  const targetHides = Math.min(3, Math.ceil(words.length / 3));

  if (expressions && expressions.length > 0) {
    for (const expr of expressions) {
      if (cloze.toLowerCase().includes(expr.toLowerCase()) && hiddenCount < targetHides) {
        const regex = new RegExp(`\\b${expr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        cloze = cloze.replace(regex, '____');
        hiddenCount++;
      }
    }
  }

  // If we didn't hide enough, hide some other words
  if (hiddenCount < targetHides) {
    const wordsToHide = targetHides - hiddenCount;
    const clozeWords = cloze.split(/\s+/);
    const indices: number[] = [];
    
    // Pick random content words (skip short words and already hidden)
    for (let i = 0; i < clozeWords.length && indices.length < wordsToHide; i++) {
      if (clozeWords[i].length > 3 && clozeWords[i] !== '____') {
        indices.push(i);
      }
    }
    
    // Shuffle and pick
    indices.sort(() => Math.random() - 0.5);
    const toHide = indices.slice(0, wordsToHide);
    
    cloze = clozeWords.map((w, i) => toHide.includes(i) ? '____' : w).join(' ');
  }

  return cloze;
}

export function ClozeQuiz({ sentences, onComplete, onEvaluate }: ClozeQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<QuizStep>('show');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [showTyping, setShowTyping] = useState(false);
  const [lastScores, setLastScores] = useState<ThreeAxisScores | null>(null);
  const [lastUserAnswer, setLastUserAnswer] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [completedSentences, setCompletedSentences] = useState<Set<number>>(new Set());

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
      const result = await onEvaluate(currentInput, currentSentence.english);
      
      const threeAxis = result.threeAxis || {
        meaning: result.score >= 85 ? 'excellent' : result.score >= 60 ? 'good' : 'needs_work',
        structure: result.score >= 85 ? 'excellent' : result.score >= 60 ? 'good' : 'needs_work',
        fluency: result.score >= 85 ? 'excellent' : result.score >= 60 ? 'good' : 'needs_work',
      } as ThreeAxisScores;
      
      const passed = result.passed !== undefined ? result.passed : calculatePassStatus(threeAxis).passed;
      
      setLastScores(threeAxis);
      
      if (passed) {
        if (step === 'partial_cloze') {
          playSuccess();
          // Move to full cloze
          setTimeout(() => {
            setStep('full_cloze');
            resetTranscript();
            setTypedInput('');
          }, 600);
        } else if (step === 'full_cloze') {
          playSuccess();
          // Show result screen with success
          setTimeout(() => {
            setStep('result');
          }, 400);
        }
      }
      // Always show result screen for feedback
      setStep('result');
    } catch (error) {
      console.error('Evaluation error:', error);
    } finally {
      setIsEvaluating(false);
    }
  }, [currentSentence, currentInput, step, onEvaluate, playSuccess, resetTranscript]);

  const handleTryAgain = useCallback(() => {
    // Go back to partial cloze for this sentence
    setStep('partial_cloze');
    setLastScores(null);
    resetTranscript();
    setTypedInput('');
  }, [resetTranscript]);

  const handleNext = useCallback(() => {
    // Mark current as completed
    setCompletedSentences(prev => new Set([...prev, currentIndex]));
    
    if (currentIndex < sentences.length - 1) {
      // Move to next sentence - reset state first, then advance
      const nextIndex = currentIndex + 1;
      setLastScores(null);
      setLastUserAnswer('');
      setStep('show');
      setCurrentIndex(nextIndex);
    } else {
      // All sentences done
      playBigSuccess();
      onComplete(lastUserAnswer, 90, true);
    }
  }, [currentIndex, sentences.length, lastUserAnswer, playBigSuccess, onComplete]);

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
    const hasScores = lastScores !== null;
    const passed = hasScores ? calculatePassStatus(lastScores).passed : false;
    
    if (!hasScores) {
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

        <QuizResultScreen
          userAnswer={lastUserAnswer}
          correctAnswer={currentSentence.english}
          scores={lastScores}
          keyExpressions={currentSentence.expressions}
          onTryAgain={handleTryAgain}
          onNext={handleNext}
          nextLabel={currentIndex < sentences.length - 1 ? 'Next Sentence' : 'Complete!'}
          showTryAgain={!passed}
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
                    Key expressions: {currentSentence.expressions?.join(', ') || 'None'}
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
