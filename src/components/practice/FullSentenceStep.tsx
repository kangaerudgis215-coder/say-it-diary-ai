import { useState, useCallback } from 'react';
import { Volume2, Mic, MicOff, Loader2, ChevronRight, Keyboard, ArrowLeft, Lightbulb, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useVocabularyLog } from '@/hooks/useVocabularyLog';
import { cn } from '@/lib/utils';
import { compareTokens } from '@/lib/textComparison';

interface FullSentenceStepProps {
  english: string;
  japanese: string;
  expressions: string[];
  onBack: () => void;
  onNext: () => void;
}

export function FullSentenceStep({
  english,
  japanese,
  expressions,
  onBack,
  onNext,
}: FullSentenceStepProps) {
  const [showTyping, setShowTyping] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<{ accuracy: number; passed: boolean } | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

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

  const handlePlayAudio = useCallback(() => {
    if (isPlayingAudio) {
      speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }
    setIsPlayingAudio(true);
    const u = new SpeechSynthesisUtterance(english);
    u.lang = 'en-US';
    u.rate = 0.9;
    u.onend = () => setIsPlayingAudio(false);
    u.onerror = () => setIsPlayingAudio(false);
    speechSynthesis.speak(u);
  }, [english, isPlayingAudio]);

  const handleCheck = useCallback(() => {
    if (!currentInput) return;
    setIsChecking(true);
    logSpokenWords(currentInput);

    const diff = compareTokens(currentInput, english);
    // Lenient: pass if accuracy >= 65%
    const passed = diff.accuracy >= 65;
    setResult({ accuracy: diff.accuracy, passed });
    setUserAnswer(currentInput);
    setIsChecking(false);
  }, [currentInput, english, logSpokenWords]);

  const handleRetry = useCallback(() => {
    setResult(null);
    setUserAnswer('');
    resetTranscript();
    setTypedInput('');
  }, [resetTranscript]);

  // Result view
  if (result) {
    return (
      <div className="flex flex-col h-full space-y-4">
        <div
          className={cn(
            'text-center py-3 px-4 rounded-xl border',
            result.passed ? 'bg-primary/10 border-primary/20' : 'bg-destructive/10 border-destructive/20'
          )}
        >
          <span className={cn('font-bold text-lg', result.passed ? 'text-primary' : 'text-destructive')}>
            {result.passed ? 'Great job! ◎' : 'Keep practicing'}
          </span>
          <p className="text-xs text-muted-foreground">
            {result.accuracy}% accuracy — {result.passed ? 'You captured the sentence well!' : 'Try reading the sentence aloud again.'}
          </p>
        </div>

        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Your answer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{userAnswer || <span className="italic text-muted-foreground">(empty)</span>}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Correct sentence</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{english}</p>
          </CardContent>
        </Card>

        <div className="mt-auto flex flex-col gap-2 pt-2">
          {result.passed && (
            <Button variant="glow" size="lg" className="w-full" onClick={onNext}>
              <ChevronRight className="w-5 h-5 mr-2" />
              Next
            </Button>
          )}
          <Button
            variant={result.passed ? 'ghost' : 'glow'}
            size={result.passed ? 'sm' : 'lg'}
            className="w-full"
            onClick={handleRetry}
          >
            Try again
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to cloze
          </Button>
        </div>
      </div>
    );
  }

  // Practice view
  return (
    <div className="flex flex-col h-full space-y-4">
      <p className="text-center text-sm text-muted-foreground">
        Say the <span className="text-primary font-medium">full sentence</span> in English from memory
      </p>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-base text-center font-japanese text-secondary-foreground">{japanese}</p>
        </CardContent>
      </Card>

      {/* Expressions reminder */}
      {expressions.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {expressions.map((e, i) => (
            <span key={i} className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/15">
              {e}
            </span>
          ))}
        </div>
      )}

      {/* Hint toggle */}
      <div className="flex justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShowHint(!showHint)}>
          {showHint ? <Eye className="w-4 h-4 mr-1" /> : <Lightbulb className="w-4 h-4 mr-1" />}
          {showHint ? 'Hide hint' : 'Show hint'}
        </Button>
        <Button variant="ghost" size="sm" onClick={handlePlayAudio}>
          {isPlayingAudio ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Volume2 className="w-4 h-4 mr-1" />}
          Listen
        </Button>
      </div>

      {showHint && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-3 text-center text-sm text-muted-foreground">
            First words: <span className="text-foreground">{english.split(' ').slice(0, 4).join(' ')}…</span>
          </CardContent>
        </Card>
      )}

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
          placeholder="Type the full sentence..."
          className="min-h-20"
        />
      ) : (
        <div className="flex flex-col items-center gap-3">
          {isSupported ? (
            <>
              <button
                onClick={handleMicClick}
                className={cn(
                  'w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300',
                  isListening ? 'bg-destructive/20 animate-pulse' : 'bg-primary/20 hover:bg-primary/30'
                )}
              >
                {isListening ? <MicOff className="w-6 h-6 text-destructive" /> : <Mic className="w-6 h-6 text-primary" />}
              </button>
              <p className="text-xs text-muted-foreground">{isListening ? 'Tap to stop' : 'Tap to speak'}</p>
            </>
          ) : (
            <p className="text-sm text-destructive">Speech not supported. Use typing instead.</p>
          )}

          {(transcript || interimTranscript) && (
            <div className="w-full p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Your response:</p>
              <p className="text-sm">
                {transcript}
                {interimTranscript && <span className="text-muted-foreground italic"> {interimTranscript}</span>}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <Button variant="glow" size="lg" className="w-full" onClick={handleCheck} disabled={!currentInput || isChecking}>
          {isChecking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Check Answer'}
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to cloze
        </Button>
      </div>
    </div>
  );
}
