/**
 * Red-pen style feedback screen for Full Diary Challenge
 * Shows side-by-side comparison with highlighting and comments
 */
import { useMemo } from 'react';
import { CheckCircle, XCircle, RotateCcw, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { normalizeForExpression } from '@/lib/textComparison';
import { ReviewSentence } from './types';

interface RedPenFeedbackProps {
  sentences: ReviewSentence[];
  userAttempt: string;
  onTryAgain: () => void;
  onBackToSentences: () => void;
  onDone: () => void;
}

interface SentenceFeedback {
  target: string;
  userMatch: string;
  expressionsUsed: string[];
  expressionsMissed: string[];
  comment: string;
}

function splitIntoSentences(text: string): string[] {
  // First normalize: replace newlines with spaces, then split on sentence boundaries
  const normalized = text.replace(/[\r\n]+/g, ' ').trim();
  
  // Split on sentence-ending punctuation followed by space OR end of string
  // This handles: "Sentence one. Sentence two." and "Sentence one.Sentence two."
  const sentences: string[] = [];
  let current = '';
  
  for (let i = 0; i < normalized.length; i++) {
    current += normalized[i];
    
    // Check if we hit sentence-ending punctuation
    if (/[.!?]/.test(normalized[i])) {
      // Look ahead - if next char is space, quote, or end, it's likely end of sentence
      const nextChar = normalized[i + 1];
      if (!nextChar || /\s/.test(nextChar) || /["']/.test(nextChar)) {
        const trimmed = current.trim();
        if (trimmed) {
          sentences.push(trimmed);
        }
        current = '';
      }
    }
  }
  
  // Add any remaining text
  const remaining = current.trim();
  if (remaining) {
    sentences.push(remaining);
  }
  
  return sentences;
}

function alignUserAttemptToSentences(userAttempt: string, sentences: ReviewSentence[]): SentenceFeedback[] {
  // Split user attempt into sentences (handles periods, newlines, etc.)
  const userSentences = splitIntoSentences(userAttempt);
  const result: SentenceFeedback[] = [];

  // Align user sentences to target sentences
  // If user wrote fewer sentences, later ones show as "not captured"
  // If user wrote more, extra ones are ignored (could be merged with last)
  for (let i = 0; i < sentences.length; i++) {
    const target = sentences[i];
    let userMatch = userSentences[i] || '';
    
    // If this is the last target sentence and user has extra sentences, merge them
    if (i === sentences.length - 1 && userSentences.length > sentences.length) {
      userMatch = userSentences.slice(i).join(' ');
    }
    
    const userNorm = normalizeForExpression(userMatch);

    const expressionsUsed: string[] = [];
    const expressionsMissed: string[] = [];

    for (const expr of target.expressions) {
      if (userNorm.includes(normalizeForExpression(expr))) {
        expressionsUsed.push(expr);
      } else {
        expressionsMissed.push(expr);
      }
    }

    // Generate a short comment
    let comment = '';
    if (!userMatch) {
      comment = 'This sentence was not captured in your response.';
    } else if (expressionsUsed.length > 0 && expressionsMissed.length === 0) {
      comment = `Great! You used "${expressionsUsed[0]}" correctly.`;
    } else if (expressionsMissed.length > 0) {
      comment = `Try adding "${expressionsMissed[0]}" here to match your diary.`;
    } else {
      comment = 'Good effort on this sentence!';
    }

    result.push({
      target: target.english,
      userMatch,
      expressionsUsed,
      expressionsMissed,
      comment,
    });
  }

  return result;
}

export function RedPenFeedback({ sentences, userAttempt, onTryAgain, onBackToSentences, onDone }: RedPenFeedbackProps) {
  const feedback = useMemo(() => alignUserAttemptToSentences(userAttempt, sentences), [userAttempt, sentences]);

  // Calculate summary stats
  const allExpressions = sentences.flatMap((s) => s.expressions);
  const usedCount = feedback.reduce((sum, f) => sum + f.expressionsUsed.length, 0);

  return (
    <div className="flex flex-col h-full space-y-4 p-4 overflow-y-auto">
      <div className="text-center">
        <h2 className="font-bold text-lg">📝 Correction Log</h2>
        <p className="text-sm text-muted-foreground">
          You used {usedCount} / {allExpressions.length} key expressions
        </p>
      </div>

      {/* Per-sentence feedback */}
      <div className="space-y-4">
        {feedback.map((f, i) => (
          <Card key={i} className={cn(f.expressionsMissed.length === 0 && f.userMatch ? 'border-primary/30' : '')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {f.expressionsMissed.length === 0 && f.userMatch ? (
                  <CheckCircle className="w-4 h-4 text-primary" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                )}
                Sentence {i + 1}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Target */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Correct:</p>
                <p className="text-sm leading-relaxed">{f.target}</p>
              </div>

              {/* User attempt */}
              <div className="border-t border-border pt-2">
                <p className="text-xs text-muted-foreground mb-1">You said:</p>
                <p className="text-sm leading-relaxed">
                  {f.userMatch || <span className="italic text-muted-foreground">(not captured)</span>}
                </p>
              </div>

              {/* Expression badges */}
              {(f.expressionsUsed.length > 0 || f.expressionsMissed.length > 0) && (
                <div className="flex flex-wrap gap-2">
                  {f.expressionsUsed.map((e, j) => (
                    <span key={`used-${j}`} className="px-2 py-1 rounded-full text-xs bg-primary/20 text-primary">
                      ✓ {e}
                    </span>
                  ))}
                  {f.expressionsMissed.map((e, j) => (
                    <span key={`missed-${j}`} className="px-2 py-1 rounded-full text-xs bg-destructive/20 text-destructive">
                      ✗ {e}
                    </span>
                  ))}
                </div>
              )}

              {/* Comment */}
              {f.comment && (
                <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">{f.comment}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-col gap-2 pt-4 sticky bottom-0 bg-background pb-2">
        <Button variant="glow" size="lg" className="w-full" onClick={onDone}>
          <Home className="w-5 h-5 mr-2" />
          Done
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onTryAgain}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Try again
          </Button>
          <Button variant="ghost" size="sm" className="flex-1" onClick={onBackToSentences}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Sentences
          </Button>
        </div>
      </div>
    </div>
  );
}
