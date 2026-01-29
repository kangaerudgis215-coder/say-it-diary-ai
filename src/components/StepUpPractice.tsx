import { useState, useEffect } from 'react';
import { Volume2, Mic, MicOff, Loader2, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useStepUpMemorization, PracticePhase } from '@/hooks/useStepUpMemorization';
import { cn } from '@/lib/utils';

interface StepUpPracticeProps {
  diaryContent: string;
  onComplete: (transcript: string) => void;
  onSkipToTest: () => void;
}

export function StepUpPractice({ diaryContent, onComplete, onSkipToTest }: StepUpPracticeProps) {
  const {
    sentences,
    currentPhase,
    currentStep,
    overallProgress,
    getCurrentText,
    getCurrentSentence,
    advanceToNextStep,
    getPhaseLabel,
    getStepInstruction,
    getEncouragingMessage,
    isComplete
  } = useStepUpMemorization(diaryContent);

  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [hasListened, setHasListened] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [showEncouragement, setShowEncouragement] = useState(false);
  const [encouragementMessage, setEncouragementMessage] = useState('');

  // Reset state when step changes
  useEffect(() => {
    setHasListened(false);
    setHasSpoken(false);
    setShowEncouragement(false);
    resetTranscript();
  }, [currentStep, resetTranscript]);

  // Handle completion
  useEffect(() => {
    if (isComplete) {
      onComplete(transcript);
    }
  }, [isComplete, transcript, onComplete]);

  const handlePlayAudio = () => {
    if (isPlayingAudio) {
      speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    const text = getCurrentText();
    if (!text) return;

    setIsPlayingAudio(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = currentStep.type === 'chunk' ? 0.85 : 0.9;
    utterance.onend = () => {
      setIsPlayingAudio(false);
      setHasListened(true);
    };
    utterance.onerror = () => {
      setIsPlayingAudio(false);
    };
    
    speechSynthesis.speak(utterance);
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
      if (transcript || interimTranscript) {
        setHasSpoken(true);
      }
    } else {
      resetTranscript();
      startListening();
    }
  };

  const handleNext = () => {
    // Show encouragement briefly
    setEncouragementMessage(getEncouragingMessage());
    setShowEncouragement(true);
    
    setTimeout(() => {
      setShowEncouragement(false);
      advanceToNextStep();
    }, 800);
  };

  const currentText = getCurrentText();
  const currentSentence = getCurrentSentence();

  // Get phase indicator
  const getPhaseIndex = (phase: PracticePhase): number => {
    switch (phase) {
      case 'chunks': return 0;
      case 'sentences': return 1;
      case 'combinations': return 2;
      case 'full_recall': return 3;
      case 'complete': return 4;
    }
  };

  const phases: { key: PracticePhase; label: string }[] = [
    { key: 'chunks', label: 'Chunks' },
    { key: 'sentences', label: 'Sentences' },
    { key: 'combinations', label: 'Combine' },
    { key: 'full_recall', label: 'Full Recall' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Progress Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {getPhaseLabel()}
          </span>
          <span className="text-xs text-muted-foreground">
            {overallProgress}% complete
          </span>
        </div>
        <Progress value={overallProgress} className="h-2" />
        
        {/* Phase indicators */}
        <div className="flex justify-between mt-3 px-1">
          {phases.map((phase, idx) => (
            <div 
              key={phase.key}
              className={cn(
                "flex flex-col items-center",
                getPhaseIndex(currentPhase) >= idx ? "text-primary" : "text-muted-foreground/40"
              )}
            >
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1",
                getPhaseIndex(currentPhase) > idx 
                  ? "bg-primary text-primary-foreground" 
                  : getPhaseIndex(currentPhase) === idx
                    ? "bg-primary/20 text-primary border border-primary"
                    : "bg-muted text-muted-foreground"
              )}>
                {getPhaseIndex(currentPhase) > idx ? <Check className="w-3 h-3" /> : idx + 1}
              </div>
              <span className="text-[10px] hidden sm:block">{phase.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Encouragement Toast */}
      {showEncouragement && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-in fade-in zoom-in duration-200">
          <div className="bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg">
            <span className="font-medium">{encouragementMessage}</span>
          </div>
        </div>
      )}

      {/* Main Practice Area */}
      <div className="flex-1 flex flex-col">
        {/* Instruction */}
        <p className="text-sm text-muted-foreground text-center mb-4">
          {getStepInstruction()}
        </p>

        {/* Sentence Context (for chunks) */}
        {currentStep.type === 'chunk' && currentSentence && (
          <Card className="mb-3 bg-muted/30">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1">Full sentence:</p>
              <p className="text-sm">
                {currentSentence.chunks.map((chunk, idx) => (
                  <span 
                    key={idx}
                    className={cn(
                      idx === currentStep.chunkIndex 
                        ? "text-primary font-medium" 
                        : "text-muted-foreground"
                    )}
                  >
                    {chunk.text}
                    {idx < currentSentence.chunks.length - 1 ? ' ' : ''}
                  </span>
                ))}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Current Text to Practice */}
        <Card className={cn(
          "mb-4",
          currentStep.type === 'full_recall' && "bg-muted/10"
        )}>
          <CardContent className="p-4">
            <p className={cn(
              "text-center leading-relaxed",
              currentStep.type === 'chunk' ? "text-xl font-medium text-primary" :
              currentStep.type === 'sentence' ? "text-lg" :
              "text-base"
            )}>
              {currentStep.type === 'full_recall' ? (
                <span className="text-muted-foreground italic">
                  (Try to recall from memory)
                </span>
              ) : (
                currentText
              )}
            </p>
          </CardContent>
        </Card>

        {/* Audio Button */}
        {currentStep.type !== 'full_recall' && (
          <div className="flex justify-center mb-4">
            <Button
              variant={hasListened ? "outline" : "default"}
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
              {isPlayingAudio ? 'Playing...' : hasListened ? 'Listen Again' : 'Listen'}
            </Button>
          </div>
        )}

        {/* Recording Area */}
        <div className="flex flex-col items-center gap-4">
          {!isSupported ? (
            <div className="text-center p-4 bg-destructive/10 rounded-xl">
              <p className="text-sm text-destructive">
                Speech recognition not supported. Try Chrome or Edge.
              </p>
            </div>
          ) : (
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
          )}

          {/* Transcript */}
          {(transcript || interimTranscript) && (
            <div className="w-full max-w-md p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Your response:</p>
              <p className="text-sm">
                {transcript}
                {interimTranscript && (
                  <span className="text-muted-foreground italic">
                    {transcript ? ' ' : ''}{interimTranscript}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 space-y-2">
        {currentStep.type === 'full_recall' ? (
          <Button
            variant="glow"
            size="lg"
            className="w-full"
            onClick={() => onComplete(transcript)}
            disabled={!transcript}
          >
            <Check className="w-5 h-5 mr-2" />
            Check My Answer
          </Button>
        ) : (
          <Button
            variant="glow"
            size="lg"
            className="w-full"
            onClick={handleNext}
            disabled={!hasSpoken && !transcript}
          >
            <ChevronRight className="w-5 h-5 mr-2" />
            {transcript ? 'Next' : 'Skip & Continue'}
          </Button>
        )}
        
        {currentPhase !== 'full_recall' && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={onSkipToTest}
          >
            Skip practice, go straight to test
          </Button>
        )}
      </div>
    </div>
  );
}
