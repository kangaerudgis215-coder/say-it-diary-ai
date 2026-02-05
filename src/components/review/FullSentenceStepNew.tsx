/**
 * Step 2: Full sentence production - User produces the entire sentence
 * with lenient, meaning-focused evaluation and mini red-pen feedback
 */
import { useState, useCallback, useMemo } from 'react';
import { Volume2, Loader2, Lightbulb, Eye, Keyboard, Mic, MicOff, ChevronRight, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useVocabularyLog } from '@/hooks/useVocabularyLog';
import { cn } from '@/lib/utils';
import { compareTokens, normalizeForExpression } from '@/lib/textComparison';

interface FullSentenceStepNewProps {
  english: string;
  japanese: string;
  expressions: string[];
  onComplete: () => void;
  onBackToCloze: () => void;
  sentenceNumber: number;
  totalSentences: number;
  isLastSentence: boolean;
  /** If false, hide the "Back to cloze" button */
  hasClozeStep: boolean;
}

interface EvaluationResult {
  passed: boolean;
  accuracy: number;
  expressionsUsed: string[];
  expressionsMissed: string[];
  feedback: string;
}

function evaluateAnswer(userAnswer: string, target: string, expressions: string[]): EvaluationResult {
  const answerNorm = normalizeForExpression(userAnswer);
  const targetNorm = normalizeForExpression(target);

  // Check which expressions are present
  const expressionsUsed: string[] = [];
  const expressionsMissed: string[] = [];
  for (const expr of expressions) {
    if (answerNorm.includes(normalizeForExpression(expr))) {
      expressionsUsed.push(expr);
    } else {
      expressionsMissed.push(expr);
    }
  }

  // Token comparison for accuracy
  const diff = compareTokens(userAnswer, target);

  // Lenient pass: at least 60% accuracy OR all key expressions present
  const allExpressionsPresent = expressions.length === 0 || expressionsMissed.length === 0;
  const passed = diff.accuracy >= 60 || allExpressionsPresent;

  // Generate feedback
  let feedback = '';
  if (passed) {
    if (expressionsUsed.length > 0) {
      feedback = `Great! You used "${expressionsUsed.join('", "')}" correctly.`;
    } else {
      feedback = 'Good job capturing the meaning!';
    }
  } else {
    if (expressionsMissed.length > 0) {
      feedback = `Try using "${expressionsMissed[0]}" to match your diary.`;
    } else {
      feedback = 'Try to match the sentence structure more closely.';
    }
  }

  return { passed, accuracy: diff.accuracy, expressionsUsed, expressionsMissed, feedback };
}

export function FullSentenceStepNew({
  english,
  japanese,
  expressions,
  onComplete,
  onBackToCloze,
  sentenceNumber,
  totalSentences,
  isLastSentence,
  hasClozeStep,
}: FullSentenceStepNewProps) {
  const [showTyping, setShowTyping] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const { isListening, transcript, interimTranscript, isSupported, startListening, stopListening, resetTranscript } =
    useSpeechRecognition();
  const { logSpokenWords } = useVocabularyLog();

  const currentInput = showTyping ? typedInput : transcript;

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
    if (!currentInput) return;
    setIsChecking(true);
    logSpokenWords(currentInput);
    setUserAnswer(currentInput);

    const evaluation = evaluateAnswer(currentInput, english, expressions);
    setResult(evaluation);
    setIsChecking(false);
  }, [currentInput, english, expressions, logSpokenWords]);

  const handleRetry = useCallback(() => {
    setResult(null);
    setUserAnswer('');
    resetTranscript();
    setTypedInput('');
  }, [resetTranscript]);

  // Result view with mini red-pen feedback
  if (result) {
    return (
      <div className="flex flex-col h-full space-y-4 p-4">
        <p className="text-xs text-muted-foreground text-center">
          Sentence {sentenceNumber} of {totalSentences} — Step 2: Full sentence
        </p>

        {/* Pass/Fail indicator */}
        <div
          className={cn(
            'text-center py-3 px-4 rounded-xl border',
            result.passed ? 'bg-primary/10 border-primary/20' : 'bg-muted border-border'
          )}
        >
          <div className="flex items-center justify-center gap-2">
            {result.passed ? (
              <CheckCircle className="w-5 h-5 text-primary" />
            ) : (
              <XCircle className="w-5 h-5 text-muted-foreground" />
            )}
            <span className={cn('font-bold text-lg', result.passed ? 'text-primary' : 'text-muted-foreground')}>
              {result.passed ? 'Good enough! ◎' : 'Keep practicing'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{result.accuracy}% match</p>
        </div>

        {/* Comparison: User vs Correct */}
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

        {/* Expressions feedback */}
        {(result.expressionsUsed.length > 0 || result.expressionsMissed.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {result.expressionsUsed.map((e, i) => (
              <span key={`used-${i}`} className="px-2 py-1 rounded-full text-xs bg-primary/20 text-primary">
                ✓ {e}
              </span>
            ))}
            {result.expressionsMissed.map((e, i) => (
              <span key={`missed-${i}`} className="px-2 py-1 rounded-full text-xs bg-destructive/20 text-destructive">
                ✗ {e}
              </span>
            ))}
          </div>
        )}

        {/* Feedback comment */}
        <div className="text-center py-2 px-4 bg-muted/50 rounded-lg">
          <p className="text-sm">{result.feedback}</p>
        </div>

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-2">
          {result.passed ? (
            <Button variant="glow" size="lg" className="w-full" onClick={onComplete}>
              <ChevronRight className="w-5 h-5 mr-2" />
              {isLastSentence ? 'Complete loop!' : 'Next sentence'}
            </Button>
          ) : (
            <Button variant="glow" size="lg" className="w-full" onClick={handleRetry}>
              Try again
            </Button>
          )}
          {!result.passed && (
            <Button variant="ghost" size="sm" className="w-full" onClick={onComplete}>
              Continue anyway →
            </Button>
          )}
          {hasClozeStep && (
            <Button variant="ghost" size="sm" className="w-full" onClick={onBackToCloze}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to cloze
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Practice view
  return (
    <div className="flex flex-col h-full space-y-4 p-4">
      <p className="text-xs text-muted-foreground text-center">
        Sentence {sentenceNumber} of {totalSentences} — Step 2: Say the whole sentence
      </p>

      {/* Japanese prompt */}
      <Card>
        <CardContent className="p-4">
          <p className="text-base text-center font-japanese text-secondary-foreground">{japanese}</p>
        </CardContent>
      </Card>

      {/* Key expressions reminder */}
      {expressions.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {expressions.map((e, i) => (
            <span key={i} className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/15">
              {e}
            </span>
          ))}
        </div>
      )}

      {/* Hint / Audio buttons */}
      <div className="flex justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShowHint(!showHint)}>
          {showHint ? <Eye className="w-4 h-4 mr-1" /> : <Lightbulb className="w-4 h-4 mr-1" />}
          {showHint ? 'Hide hint' : 'Hint'}
        </Button>
        <Button variant="ghost" size="sm" onClick={handlePlayAudio}>
          {isPlayingAudio ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Volume2 className="w-4 h-4 mr-1" />}
          Listen
        </Button>
      </div>

      {/* Hint: first few words */}
      {showHint && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-3 text-center text-sm text-muted-foreground">
            First words: <span className="text-foreground">{english.split(' ').slice(0, 3).join(' ')}…</span>
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
        {hasClozeStep && (
          <Button variant="ghost" size="sm" className="w-full" onClick={onBackToCloze}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to cloze
          </Button>
        )}
      </div>
    </div>
  );
}
