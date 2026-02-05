import { useMemo } from 'react';
import { CheckCircle, XCircle, RotateCcw, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PracticeSentence } from '@/lib/practiceBuilder';
import { compareTokens, checkExpressionPresentEnhanced } from '@/lib/textComparison';

interface CorrectionLogProps {
  sentences: PracticeSentence[];
  userAttempt: string;
  usedExpressions: string[];
  missedExpressions: string[];
  accuracy: number;
  onRetry: () => void;
  onBackToSentences: () => void;
  onDone: () => void;
}

function splitUserAttemptToSentences(attempt: string, sentenceCount: number): string[] {
  // Simple heuristic: split on . ! ?
  const raw = attempt.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  // Pad / trim to match sentence count
  const result: string[] = [];
  for (let i = 0; i < sentenceCount; i++) {
    result.push(raw[i] ?? '');
  }
  return result;
}

export function CorrectionLog({
  sentences,
  userAttempt,
  usedExpressions,
  missedExpressions,
  accuracy,
  onRetry,
  onBackToSentences,
  onDone,
}: CorrectionLogProps) {
  const userSegments = useMemo(() => splitUserAttemptToSentences(userAttempt, sentences.length), [userAttempt, sentences.length]);

  return (
    <div className="flex flex-col h-full space-y-4 overflow-y-auto pb-20">
      {/* Summary header */}
      <div className="text-center py-3 px-4 rounded-xl border bg-muted/30">
        <p className="font-bold text-lg">{accuracy}% overall</p>
        <p className="text-xs text-muted-foreground">Expressions: {usedExpressions.length} used, {missedExpressions.length} missed</p>
      </div>

      {/* Expression summary */}
      {usedExpressions.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1 text-primary">
              <CheckCircle className="w-4 h-4" /> Expressions you used
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {usedExpressions.map((e, i) => (
              <span key={i} className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">{e}</span>
            ))}
          </CardContent>
        </Card>
      )}

      {missedExpressions.length > 0 && (
        <Card className="border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1 text-destructive">
              <XCircle className="w-4 h-4" /> Expressions to practice
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {missedExpressions.map((e, i) => (
              <span key={i} className="px-2 py-1 rounded-full text-xs bg-destructive/10 text-destructive">{e}</span>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Per-sentence breakdown */}
      <div className="space-y-3">
        {sentences.map((sent, idx) => {
          const userSeg = userSegments[idx] || '';
          const diff = compareTokens(userSeg, sent.english);
          const exprResults = (sent.expressions || []).map((expr) => ({
            expr,
            ...checkExpressionPresentEnhanced(userSeg, expr),
          }));

          return (
            <Card key={idx} className="bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">Sentence {idx + 1}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Your version:</p>
                  <p className="text-sm">{userSeg || <span className="italic text-muted-foreground">(missing)</span>}</p>
                </div>
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground">Correct:</p>
                  <p className="text-sm">{sent.english}</p>
                </div>
                {exprResults.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {exprResults.map((r, i) => (
                      <span
                        key={i}
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs',
                          r.present ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                        )}
                      >
                        {r.present ? '✓' : '✗'} {r.expr}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions (sticky bottom) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 border-t space-y-2">
        <Button variant="glow" size="lg" className="w-full" onClick={onRetry}>
          <RotateCcw className="w-5 h-5 mr-2" />
          Retry full diary
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1" onClick={onBackToSentences}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to sentences
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onDone}>
            <Home className="w-4 h-4 mr-1" /> Done
          </Button>
        </div>
      </div>
    </div>
  );
}
