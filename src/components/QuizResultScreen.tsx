import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThreeAxisEvaluation, ThreeAxisScores, calculatePassStatus } from '@/components/ThreeAxisEvaluation';
import { RotateCcw, ChevronRight, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuizResultScreenProps {
  userAnswer: string;
  correctAnswer: string;
  scores: ThreeAxisScores;
  keyExpressions?: string[];
  onTryAgain: () => void;
  onNext: () => void;
  nextLabel?: string;
  showTryAgain?: boolean;
}

// Simple word-level diff for highlighting differences
function computeDiff(userText: string, targetText: string): {
  userWords: Array<{ word: string; status: 'correct' | 'incorrect' | 'extra' }>;
  targetWords: Array<{ word: string; status: 'matched' | 'missing' }>;
} {
  const userWords = userText.split(/\s+/).filter(w => w.length > 0);
  const targetWords = targetText.split(/\s+/).filter(w => w.length > 0);
  
  // Normalize for comparison
  const normalize = (w: string) => w.toLowerCase().replace(/[.,!?;:'"]/g, '');
  
  // Track which target words have been matched
  const targetMatched = new Set<number>();
  
  // For each user word, find if it matches any target word
  const userResult = userWords.map(word => {
    const normalizedWord = normalize(word);
    const matchIndex = targetWords.findIndex((tw, idx) => 
      !targetMatched.has(idx) && normalize(tw) === normalizedWord
    );
    
    if (matchIndex !== -1) {
      targetMatched.add(matchIndex);
      return { word, status: 'correct' as const };
    }
    
    // Check if similar (partial match)
    const partialMatch = targetWords.findIndex((tw, idx) => 
      !targetMatched.has(idx) && (
        normalize(tw).includes(normalizedWord) || 
        normalizedWord.includes(normalize(tw))
      )
    );
    
    if (partialMatch !== -1 && normalizedWord.length > 2) {
      targetMatched.add(partialMatch);
      return { word, status: 'incorrect' as const };
    }
    
    return { word, status: 'extra' as const };
  });
  
  // Mark target words as matched or missing
  const targetResult = targetWords.map((word, idx) => ({
    word,
    status: targetMatched.has(idx) ? 'matched' as const : 'missing' as const,
  }));
  
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
}: QuizResultScreenProps) {
  const { passed } = calculatePassStatus(scores);
  const [diff, setDiff] = useState<ReturnType<typeof computeDiff> | null>(null);
  
  useEffect(() => {
    setDiff(computeDiff(userAnswer, correctAnswer));
  }, [userAnswer, correctAnswer]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Pass/Fail header */}
      <div className={cn(
        "text-center py-3 px-4 rounded-xl",
        passed ? "bg-green-500/20 border border-green-500/30" : "bg-muted"
      )}>
        <div className="flex items-center justify-center gap-2 mb-1">
          {passed ? (
            <Check className="w-5 h-5 text-green-400" />
          ) : (
            <RotateCcw className="w-5 h-5 text-muted-foreground" />
          )}
          <span className={cn(
            "font-bold text-lg",
            passed ? "text-green-400" : "text-muted-foreground"
          )}>
            {passed ? "Pass!" : "Keep practicing!"}
          </span>
        </div>
      </div>

      {/* Three-axis scores */}
      <ThreeAxisEvaluation scores={scores} size="md" />

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
        <Button
          variant="glow"
          size="lg"
          className="w-full"
          onClick={onNext}
        >
          <ChevronRight className="w-5 h-5 mr-2" />
          {nextLabel}
        </Button>
        
        {showTryAgain && !passed && (
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
      </div>
    </div>
  );
}
