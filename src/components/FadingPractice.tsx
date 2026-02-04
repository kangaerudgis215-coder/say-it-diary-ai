import { useState, useCallback, useMemo, useEffect } from 'react';
import { Volume2, Mic, MicOff, Loader2, ChevronRight, Keyboard, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { QuizResultScreen } from '@/components/QuizResultScreen';
import { ThreeAxisScores, calculatePassStatus } from '@/components/ThreeAxisEvaluation';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { cn } from '@/lib/utils';

interface FadingPracticeProps {
  englishSentence: string;
  japaneseSentence: string;
  keyExpressions?: string[];
  onComplete: (passed: boolean) => void;
  onEvaluate: (text: string, target: string) => Promise<{ 
    score: number; 
    threeAxis?: ThreeAxisScores; 
    passed?: boolean 
  }>;
}

type FadeLevel = 0 | 1 | 2 | 3; // 0 = fully visible, 3 = fully hidden

export function FadingPractice({ 
  englishSentence, 
  japaneseSentence, 
  keyExpressions = [],
  onComplete,
  onEvaluate 
}: FadingPracticeProps) {
  const [fadeLevel, setFadeLevel] = useState<FadeLevel>(0);
  const [successCount, setSuccessCount] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [lastScores, setLastScores] = useState<ThreeAxisScores | null>(null);
  const [lastUserAnswer, setLastUserAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

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

  const currentInput = showTyping ? typedInput : transcript;

  // Reset input when fade level changes
  useEffect(() => {
    resetTranscript();
    setTypedInput('');
  }, [fadeLevel, resetTranscript]);

  // Generate faded English text based on fade level
  const fadedEnglish = useMemo(() => {
    const words = englishSentence.split(/\s+/);
    
    if (fadeLevel === 0) {
      // Fully visible
      return { visible: englishSentence, hidden: false };
    }
    
    if (fadeLevel === 3) {
      // Fully hidden
      return { visible: '', hidden: true };
    }
    
    // Partial fade: hide progressively more words
    const hideRatio = fadeLevel === 1 ? 0.3 : 0.6;
    const wordsToShow = Math.ceil(words.length * (1 - hideRatio));
    
    const visiblePart = words.slice(0, wordsToShow).join(' ');
    return { 
      visible: visiblePart + ' ...', 
      hidden: false,
      opacity: fadeLevel === 1 ? 0.8 : 0.5,
    };
  }, [englishSentence, fadeLevel]);

  const handlePlayAudio = useCallback(() => {
    if (isPlayingAudio) {
      speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);
    const utterance = new SpeechSynthesisUtterance(englishSentence);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    speechSynthesis.speak(utterance);
  }, [englishSentence, isPlayingAudio]);

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
    if (!currentInput) return;
    
    setIsEvaluating(true);
    setLastUserAnswer(currentInput);
    
    try {
      const result = await onEvaluate(currentInput, englishSentence);
      
      const threeAxis = result.threeAxis || {
        meaning: result.score >= 85 ? 'excellent' : result.score >= 60 ? 'good' : 'needs_work',
        structure: result.score >= 85 ? 'excellent' : result.score >= 60 ? 'good' : 'needs_work',
        fluency: result.score >= 85 ? 'excellent' : result.score >= 60 ? 'good' : 'needs_work',
      } as ThreeAxisScores;
      
      const passed = result.passed !== undefined ? result.passed : calculatePassStatus(threeAxis).passed;
      
      setLastScores(threeAxis);
      
      if (passed) {
        playSuccess();
        const newSuccessCount = successCount + 1;
        setSuccessCount(newSuccessCount);
        
        // Progress fade level after each success
        if (fadeLevel < 3) {
          setTimeout(() => {
            setFadeLevel((fadeLevel + 1) as FadeLevel);
            resetTranscript();
            setTypedInput('');
          }, 600);
        } else {
          // Fully hidden and passed - complete!
          playBigSuccess();
          setTimeout(() => {
            setShowResult(true);
          }, 400);
        }
      } else {
        // Show result for review
        setShowResult(true);
      }
    } catch (error) {
      console.error('Evaluation error:', error);
    } finally {
      setIsEvaluating(false);
    }
  }, [currentInput, englishSentence, fadeLevel, successCount, onEvaluate, playSuccess, playBigSuccess, resetTranscript]);

  const handleTryAgain = useCallback(() => {
    // Reset to beginning of practice
    setFadeLevel(0);
    setSuccessCount(0);
    setShowResult(false);
    setLastScores(null);
    resetTranscript();
    setTypedInput('');
  }, [resetTranscript]);

  const handleComplete = useCallback(() => {
    const passed = lastScores ? calculatePassStatus(lastScores).passed : false;
    onComplete(passed);
  }, [lastScores, onComplete]);

  // Result screen
  if (showResult && lastScores) {
    return (
      <div className="flex flex-col h-full">
        <QuizResultScreen
          userAnswer={lastUserAnswer}
          correctAnswer={englishSentence}
          scores={lastScores}
          keyExpressions={keyExpressions}
          onTryAgain={handleTryAgain}
          onNext={handleComplete}
          nextLabel={calculatePassStatus(lastScores).passed ? "Continue" : "Skip for now"}
          showTryAgain={true}
        />
      </div>
    );
  }

  const getFadeLabel = () => {
    switch (fadeLevel) {
      case 0: return 'Read aloud with full text';
      case 1: return 'Some words hidden...';
      case 2: return 'Most words hidden...';
      case 3: return 'Say from memory (Japanese only)';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Progress indicator */}
      <div className="flex justify-center gap-2 mb-4">
        {[0, 1, 2, 3].map((level) => (
          <div
            key={level}
            className={cn(
              "w-8 h-1 rounded-full transition-colors",
              level <= fadeLevel ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Instruction */}
      <p className="text-sm text-muted-foreground text-center mb-4">
        {getFadeLabel()}
      </p>

      {/* English sentence (with fading) */}
      {!fadedEnglish.hidden && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <p 
              className="text-lg text-center leading-relaxed transition-opacity duration-300"
              style={{ opacity: fadedEnglish.opacity || 1 }}
            >
              {fadedEnglish.visible}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Japanese sentence (always visible) */}
      <Card className={cn("mb-4", fadedEnglish.hidden && "bg-secondary/30")}>
        <CardContent className="p-4">
          {fadedEnglish.hidden && (
            <p className="text-xs text-muted-foreground mb-2 text-center">
              Say the full sentence in English:
            </p>
          )}
          <p className="text-base text-center font-japanese text-secondary-foreground">
            {japaneseSentence}
          </p>
        </CardContent>
      </Card>

      {/* Key expressions hint */}
      {keyExpressions.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {keyExpressions.map((expr, i) => (
            <span key={i} className="px-2 py-1 bg-primary/20 rounded-full text-xs text-primary">
              {expr}
            </span>
          ))}
        </div>
      )}

      {/* Audio button */}
      <div className="flex justify-center mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePlayAudio}
          disabled={isPlayingAudio}
          className="gap-2"
        >
          {isPlayingAudio ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
          Listen
        </Button>
      </div>

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
    </div>
  );
}
