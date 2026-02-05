import { useState, useCallback } from 'react';
import { Mic, MicOff, Loader2, ChevronRight, Keyboard, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useVocabularyLog } from '@/hooks/useVocabularyLog';
import { cn } from '@/lib/utils';
import { compareTokens, checkKeyExpressionsEnhanced } from '@/lib/textComparison';

interface FullDiaryStepProps {
  japaneseSummary: string;
  englishDiary: string;
  expressions: string[];
  onBack: () => void;
  onComplete: (userAttempt: string, accuracy: number, usedExprs: string[], missedExprs: string[]) => void;
}

export function FullDiaryStep({ japaneseSummary, englishDiary, expressions, onBack, onComplete }: FullDiaryStepProps) {
  const [showTyping, setShowTyping] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const { isListening, transcript, interimTranscript, isSupported, startListening, stopListening, resetTranscript } =
    useSpeechRecognition();
  const { logSpokenWords } = useVocabularyLog();

  const currentInput = showTyping ? typedInput : transcript;

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      setTypedInput('');
      startListening();
    }
  }, [isListening, stopListening, resetTranscript, startListening]);

  const handleCheck = useCallback(() => {
    if (!currentInput) return;
    setIsChecking(true);
    logSpokenWords(currentInput);

    const diff = compareTokens(currentInput, englishDiary);
    const exprCheck = checkKeyExpressionsEnhanced(currentInput, expressions);
    const used = exprCheck.results.filter((r) => r.present).map((r) => r.expression);
    const missed = exprCheck.results.filter((r) => !r.present).map((r) => r.expression);

    setIsChecking(false);
    onComplete(currentInput, diff.accuracy, used, missed);
  }, [currentInput, englishDiary, expressions, logSpokenWords, onComplete]);

  return (
    <div className="flex flex-col h-full space-y-4">
      <p className="text-center text-sm text-muted-foreground">
        Say the <span className="text-primary font-medium">entire diary</span> in English
      </p>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">🇯🇵 Japanese summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-japanese text-secondary-foreground leading-relaxed">{japaneseSummary || '—'}</p>
        </CardContent>
      </Card>

      {/* Input toggle */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setShowTyping(!showTyping)}>
          <Keyboard className="w-4 h-4 mr-1" />
          {showTyping ? 'Use mic' : 'Type'}
        </Button>
      </div>

      {showTyping ? (
        <Textarea
          value={typedInput}
          onChange={(e) => setTypedInput(e.target.value)}
          placeholder="Type the full diary..."
          className="min-h-32 flex-1"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 flex-1">
          {isSupported ? (
            <>
              <button
                onClick={handleMicClick}
                className={cn(
                  'w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300',
                  isListening ? 'bg-destructive/20 animate-pulse' : 'bg-primary/20 hover:bg-primary/30'
                )}
              >
                {isListening ? <MicOff className="w-8 h-8 text-destructive" /> : <Mic className="w-8 h-8 text-primary" />}
              </button>
              <p className="text-xs text-muted-foreground">{isListening ? 'Tap to stop' : 'Tap to speak'}</p>
            </>
          ) : (
            <p className="text-sm text-destructive">Speech not supported. Use typing instead.</p>
          )}

          {(transcript || interimTranscript) && (
            <div className="w-full p-3 rounded-lg bg-muted/50 border border-border flex-1 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-1">Your response:</p>
              <p className="text-sm whitespace-pre-wrap">
                {transcript}
                {interimTranscript && <span className="text-muted-foreground italic"> {interimTranscript}</span>}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <Button variant="glow" size="lg" className="w-full" onClick={handleCheck} disabled={!currentInput || isChecking}>
          {isChecking ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <>
              <ChevronRight className="w-5 h-5 mr-2" />
              Finish
            </>
          )}
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to sentences
        </Button>
      </div>
    </div>
  );
}
