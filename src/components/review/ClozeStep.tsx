/**
 * Step 1: Cloze (key expression) - User fills in blanked expressions
 */
import { useState, useCallback, useMemo } from 'react';
import { Volume2, Loader2, Eye, Lightbulb, Keyboard, Mic, MicOff, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { cn } from '@/lib/utils';
import { normalizeForExpression } from '@/lib/textComparison';

interface ClozeStepProps {
  english: string;
  japanese: string;
  expressions: string[];
  onComplete: () => void;
  sentenceNumber: number;
  totalSentences: number;
}

function generateClozeWithBlanks(sentence: string, expressions: string[]): { cloze: string; blanks: string[] } {
  if (!expressions || expressions.length === 0) {
    // Fallback: blank the last word
    const words = sentence.split(/\s+/);
    const lastWord = words[words.length - 1].replace(/[.,!?;:]$/, '');
    return { cloze: words.slice(0, -1).join(' ') + ' ____', blanks: [lastWord] };
  }

  let cloze = sentence;
  const blanks: string[] = [];

  for (const expr of expressions) {
    if (!expr?.trim()) continue;
    const escaped = expr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    if (regex.test(cloze)) {
      blanks.push(expr);
      cloze = cloze.replace(regex, '____');
    }
  }

  if (blanks.length === 0) {
    // Fallback
    const words = sentence.split(/\s+/);
    const lastWord = words[words.length - 1].replace(/[.,!?;:]$/, '');
    return { cloze: words.slice(0, -1).join(' ') + ' ____', blanks: [lastWord] };
  }

  return { cloze, blanks };
}

export function ClozeStep({
  english,
  japanese,
  expressions,
  onComplete,
  sentenceNumber,
  totalSentences,
}: ClozeStepProps) {
  const [showTyping, setShowTyping] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const { isListening, transcript, interimTranscript, isSupported, startListening, stopListening, resetTranscript } =
    useSpeechRecognition();

  const currentInput = showTyping ? typedInput : transcript;

  const { cloze, blanks } = useMemo(() => generateClozeWithBlanks(english, expressions), [english, expressions]);

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
    const inputNorm = normalizeForExpression(currentInput);
    // Check if all blanks are present in user's input
    const allPresent = blanks.every((b) => inputNorm.includes(normalizeForExpression(b)));
    setIsCorrect(allPresent);
    setIsChecked(true);
  }, [currentInput, blanks]);

  const handleShowAnswer = useCallback(() => {
    setShowAnswer(true);
    setIsChecked(true);
    setIsCorrect(false);
  }, []);

  const handleRetry = useCallback(() => {
    setIsChecked(false);
    setIsCorrect(false);
    setShowAnswer(false);
    resetTranscript();
    setTypedInput('');
  }, [resetTranscript]);

  // Result view
  if (isChecked) {
    return (
      <div className="flex flex-col h-full space-y-4 p-4">
        <p className="text-xs text-muted-foreground text-center">
          Sentence {sentenceNumber} of {totalSentences} — Step 1: Cloze
        </p>

        <div
          className={cn(
            'text-center py-3 px-4 rounded-xl border',
            isCorrect ? 'bg-primary/10 border-primary/20' : 'bg-muted border-border'
          )}
        >
          <span className={cn('font-bold text-lg', isCorrect ? 'text-primary' : 'text-muted-foreground')}>
            {isCorrect ? '✓ Good, you remembered this phrase!' : showAnswer ? 'Answer revealed' : 'Not quite…'}
          </span>
        </div>

        {/* Show the blanked expressions */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">Key expression(s):</p>
            <div className="flex flex-wrap gap-2">
              {blanks.map((b, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-primary/20 text-primary font-medium">
                  {b}
                </span>
              ))}
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-sm leading-relaxed">{english}</p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-auto flex flex-col gap-2">
          {isCorrect ? (
            <Button variant="glow" size="lg" className="w-full" onClick={onComplete}>
              <ChevronRight className="w-5 h-5 mr-2" />
              Next: Say the whole sentence
            </Button>
          ) : (
            <>
              <Button variant="glow" size="lg" className="w-full" onClick={handleRetry}>
                Try again
              </Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={onComplete}>
                Continue anyway →
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Practice view
  return (
    <div className="flex flex-col h-full space-y-4 p-4">
      <p className="text-xs text-muted-foreground text-center">
        Sentence {sentenceNumber} of {totalSentences} — Step 1: Fill the blank(s)
      </p>

      {/* Cloze sentence */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-lg text-center leading-relaxed">
            {cloze.split('____').map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && <span className="inline-block w-20 border-b-2 border-primary mx-1" />}
              </span>
            ))}
          </p>
          <div className="border-t border-border pt-3">
            <p className="text-base text-center font-japanese text-muted-foreground">{japanese}</p>
          </div>
        </CardContent>
      </Card>

      {/* Hint / Show answer buttons */}
      <div className="flex justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShowHint(!showHint)}>
          {showHint ? <Eye className="w-4 h-4 mr-1" /> : <Lightbulb className="w-4 h-4 mr-1" />}
          {showHint ? 'Hide hint' : 'Hint'}
        </Button>
        <Button variant="ghost" size="sm" onClick={handlePlayAudio}>
          {isPlayingAudio ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Volume2 className="w-4 h-4 mr-1" />}
          Listen
        </Button>
        <Button variant="ghost" size="sm" onClick={handleShowAnswer}>
          Show answer
        </Button>
      </div>

      {/* Hint display */}
      {showHint && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-3 text-center text-sm text-muted-foreground">
            First letter(s):{' '}
            <span className="text-foreground font-medium">
              {blanks.map((b) => b.split(' ').map((w) => w[0]?.toUpperCase() || '').join(' ')).join(', ')}
            </span>
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

      {/* Input area */}
      {showTyping ? (
        <Input
          value={typedInput}
          onChange={(e) => setTypedInput(e.target.value)}
          placeholder="Type the missing expression(s)..."
          className="h-12"
          onKeyDown={(e) => e.key === 'Enter' && currentInput && handleCheck()}
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

      <div className="mt-auto">
        <Button variant="glow" size="lg" className="w-full" onClick={handleCheck} disabled={!currentInput}>
          Check
        </Button>
      </div>
    </div>
  );
}
