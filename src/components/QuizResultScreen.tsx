import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThreeAxisEvaluation, ThreeAxisScores, calculatePassStatus } from '@/components/ThreeAxisEvaluation';
import { RotateCcw, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compareTokens, checkKeyExpressionsEnhanced } from '@/lib/textComparison';

interface QuizResultScreenProps {
  userAnswer: string;
  correctAnswer: string;
  scores: ThreeAxisScores;
  keyExpressions?: string[];
  onTryAgain: () => void;
  onNext: () => void;
  nextLabel?: string;
  showTryAgain?: boolean;
  requireKeyExpressions?: boolean;
}

// Simple word-level diff for highlighting differences
function computeDiff(userText: string, targetText: string): {
  userWords: Array<{ word: string; status: 'correct' | 'incorrect' | 'extra' }>;
  targetWords: Array<{ word: string; status: 'matched' | 'missing' }>;
} {
  // Use the improved token comparison with normalization
  const comparison = compareTokens(userText, targetText);
  
  // Map back to original words for display (preserve case/punctuation)
  const userWords = userText.split(/\s+/).filter(w => w.length > 0);
  const targetWords = targetText.split(/\s+/).filter(w => w.length > 0);
  
  const userResult = userWords.map((word, idx) => {
    const tokenStatus = comparison.userTokens[idx];
    return {
      word,
      status: tokenStatus?.status || 'extra' as const,
    };
  });
  
  const targetResult = targetWords.map((word, idx) => {
    const tokenStatus = comparison.targetTokens[idx];
    return {
      word,
      status: tokenStatus?.status || 'missing' as const,
    };
  });
  
  return { userWords: userResult, targetWords: targetResult };
}

export function QuizResultScreen({
  userAnswer,
  correctAnswer,
  scores,
  keyExpressions = [],
  onTryAgain,
  onNext,
  nextLabel = 'Next',
  showTryAgain = true,
  requireKeyExpressions = false,
}: QuizResultScreenProps) {
  const { passed } = calculatePassStatus(scores);
  const [diff, setDiff] = useState<ReturnType<typeof computeDiff> | null>(null);
  const [expressionCheck, setExpressionCheck] = useState<ReturnType<typeof checkKeyExpressionsEnhanced> | null>(null);
  
  useEffect(() => {
    setDiff(computeDiff(userAnswer, correctAnswer));
    if (keyExpressions && keyExpressions.length > 0) {
      setExpressionCheck(checkKeyExpressionsEnhanced(userAnswer, keyExpressions));
    }
  }, [userAnswer, correctAnswer]);

  // For cloze mode: ONLY the key expression matters for advancement
  // If requireKeyExpressions is true, we ONLY check if expressions are present
  const keyExpressionsMissing = requireKeyExpressions && keyExpressions.length > 0 && expressionCheck && !expressionCheck.allPresent;
  
  // Can advance if: 
  // 1. No key expressions required -> use standard pass check
  // 2. Key expressions required -> ONLY check if expressions are present (ignore other scoring)
  const canAdvance = requireKeyExpressions 
    ? (expressionCheck?.allPresent ?? false) 
    : passed;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Pass/Fail header */}
      <div className={cn(
        "text-center py-3 px-4 rounded-xl",
        canAdvance ? "bg-green-500/20 border border-green-500/30" : 
        keyExpressionsMissing ? "bg-yellow-500/20 border border-yellow-500/30" : "bg-muted"
      )}>
        <div className="flex items-center justify-center gap-2 mb-1">
          {canAdvance ? (
            <Check className="w-5 h-5 text-green-400" />
          ) : keyExpressionsMissing ? (
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          ) : (
            <RotateCcw className="w-5 h-5 text-muted-foreground" />
          )}
          <span className={cn(
            "font-bold text-lg",
            canAdvance ? "text-green-400" : 
            keyExpressionsMissing ? "text-yellow-400" : "text-muted-foreground"
          )}>
            {canAdvance ? "Key expression correct! ◎" : 
             keyExpressionsMissing ? "Key expression missing!" : "Keep practicing!"}
          </span>
        </div>
        {keyExpressionsMissing && (
          <p className="text-xs text-yellow-400/80 mt-1">
            Say the key expression correctly to continue
          </p>
        )}
        {canAdvance && requireKeyExpressions && (
          <p className="text-xs text-green-400/80 mt-1">
            You correctly used the key expression!
          </p>
        )}
      </div>

      {/* Three-axis scores */}
      <ThreeAxisEvaluation scores={scores} size="md" />

      {/* Missing key expressions alert */}
      {keyExpressionsMissing && expressionCheck && (
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="py-3">
            <p className="text-xs text-yellow-400 mb-2 font-medium">
              Try saying this expression:
            </p>
            <div className="flex flex-wrap gap-2">
              {expressionCheck.results.map((r, i) => (
                <span 
                  key={i}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium",
                    r.present 
                      ? "bg-green-500/20 text-green-400" 
                      : "bg-yellow-500/20 text-yellow-400"
                  )}
                >
                  {r.present ? '✓ ' : ''}{r.expression}
                  {!r.present && r.confidence > 0 && (
                    <span className="text-xs opacity-70"> ({r.confidence}% matched)</span>
                  )}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Tip: You can say just the expression by itself, or the full sentence.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Show key expressions when passed */}
      {canAdvance && keyExpressions.length > 0 && (
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="py-3">
            <p className="text-xs text-green-400 mb-2 font-medium">
              Key expression mastered:
            </p>
            <div className="flex flex-wrap gap-2">
              {keyExpressions.map((expr, i) => (
                <span 
                  key={i}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-green-500/20 text-green-400"
                >
                  ✓ {expr}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Side-by-side comparison */}
      <div className="grid gap-3">
        {/* User's answer */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-muted-foreground">Your answer</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">
              {diff?.userWords.map((item, i) => (
                <span
                  key={i}
                  className={cn(
                    item.status === 'correct' && 'text-foreground',
                    item.status === 'incorrect' && 'text-yellow-400 underline decoration-wavy',
                    item.status === 'extra' && 'text-destructive line-through opacity-70',
                  )}
                >
                  {item.word}{' '}
                </span>
              ))}
              {(!diff || diff.userWords.length === 0) && (
                <span className="text-muted-foreground italic">(empty)</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Correct answer */}
        <Card className="bg-green-500/10 border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="text-green-400">Correct answer</span>
              {keyExpressions.length > 0 && (
                <span className="text-xs text-primary font-normal">
                  Key: {keyExpressions.join(', ')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">
              {diff?.targetWords.map((item, i) => (
                <span
                  key={i}
                  className={cn(
                    item.status === 'matched' && 'text-green-300',
                    item.status === 'missing' && 'text-green-400 font-semibold bg-green-500/20 px-1 rounded',
                  )}
                >
                  {item.word}{' '}
                </span>
              ))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="mt-auto space-y-2 pt-4">
        {/* Only show Next if can advance */}
        {canAdvance && (
        <Button
          variant="glow"
          size="lg"
          className="w-full"
          onClick={onNext}
        >
          <ChevronRight className="w-5 h-5 mr-2" />
          {nextLabel}
        </Button>
        )}
        
        {/* Force retry if key expressions missing */}
        {keyExpressionsMissing && (
          <Button
            variant="glow"
            size="lg"
            className="w-full bg-yellow-500 hover:bg-yellow-600"
            onClick={onTryAgain}
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Try the key expression again
          </Button>
        )}
        
        {showTryAgain && !canAdvance && !keyExpressionsMissing && (
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={onTryAgain}
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Try Again
        </Button>
      )}
      
      {/* Always show try again for passed answers too if showTryAgain is true */}
      {showTryAgain && canAdvance && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={onTryAgain}
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Practice again
        </Button>
        )}
      </div>
    </div>
  );
}
