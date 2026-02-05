import { useMemo } from 'react';
import { Check, AlertTriangle, RotateCcw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { checkKeyExpressionsEnhanced, compareTokens } from '@/lib/textComparison';

type ExpressionCheck = ReturnType<typeof checkKeyExpressionsEnhanced>;

interface ExpressionOnlyResultScreenProps {
  userAnswer: string;
  correctSentence: string;
  keyExpressions: string[];
  expressionCheck: ExpressionCheck;
  onTryAgain: () => void;
  onNext: () => void;
  nextLabel?: string;
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightPhrases({ text, phrases }: { text: string; phrases: string[] }) {
  const cleaned = phrases.filter((p) => p.trim().length > 0);
  if (cleaned.length === 0) return <>{text}</>;

  // Prefer longer phrases so we don't highlight sub-phrases inside larger ones.
  const sorted = [...cleaned].sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${sorted.map(escapeRegExp).join('|')})`, 'gi');

  const parts = text.split(re);
  return (
    <>
      {parts.map((part, idx) => {
        const isMatch = sorted.some((p) => p.toLowerCase() === part.toLowerCase());
        if (!isMatch) return <span key={idx}>{part}</span>;
        return (
          <mark
            key={idx}
            className="rounded px-1 py-0.5 bg-primary/15 text-foreground"
          >
            {part}
          </mark>
        );
      })}
    </>
  );
}

export function ExpressionOnlyResultScreen({
  userAnswer,
  correctSentence,
  keyExpressions,
  expressionCheck,
  onTryAgain,
  onNext,
  nextLabel = 'Next',
}: ExpressionOnlyResultScreenProps) {
  const passed = expressionCheck.allPresent;
  const missed = expressionCheck.results.filter((r) => !r.present).map((r) => r.expression);

  const diff = useMemo(() => compareTokens(userAnswer, correctSentence), [userAnswer, correctSentence]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Key-expression-only header */}
      <div
        className={cn(
          'text-center py-3 px-4 rounded-xl border',
          passed
            ? 'bg-primary/10 border-primary/20'
            : 'bg-destructive/10 border-destructive/20'
        )}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          {passed ? (
            <Check className="w-5 h-5 text-primary" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-destructive" />
          )}
          <span className={cn('font-bold text-lg', passed ? 'text-primary' : 'text-destructive')}>
            {passed ? 'Key expression correct! ◎' : 'Key expression missing'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          To move on, please say the key expression(s). You can say only the expression.
        </p>
      </div>

      {/* Key expressions status */}
      {keyExpressions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Key expression(s) tested</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {expressionCheck.results.map((r, i) => (
                <span
                  key={`${r.expression}-${i}`}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium border',
                    r.present
                      ? 'bg-primary/10 border-primary/20 text-primary'
                      : 'bg-destructive/10 border-destructive/20 text-destructive'
                  )}
                >
                  {r.present ? '✓ ' : ''}
                  {r.expression}
                  {!r.present && r.confidence > 0 && (
                    <span className="text-xs opacity-70"> ({r.confidence}% matched)</span>
                  )}
                </span>
              ))}
            </div>

            {!passed && missed.length > 0 && (
              <div className="mt-3 text-sm">
                <div className="text-muted-foreground text-xs mb-1">Try saying:</div>
                <div className="flex flex-wrap gap-2">
                  {missed.map((expr) => (
                    <span
                      key={expr}
                      className="px-3 py-1.5 rounded-full text-sm font-medium bg-destructive/10 border border-destructive/20 text-destructive"
                    >
                      {expr}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Side-by-side */}
      <div className="grid gap-3">
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Your answer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">
              {diff.userTokens.map((t, i) => (
                <span
                  key={i}
                  className={cn(
                    t.status === 'correct' && 'text-foreground',
                    t.status === 'incorrect' && 'text-muted-foreground underline decoration-dotted',
                    t.status === 'extra' && 'text-muted-foreground line-through opacity-70'
                  )}
                >
                  {t.word}{' '}
                </span>
              ))}
              {diff.userTokens.length === 0 && (
                <span className="text-muted-foreground italic">(empty)</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Correct sentence (key highlighted)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">
              <HighlightPhrases text={correctSentence} phrases={keyExpressions} />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="mt-auto space-y-2 pt-2">
        {passed && (
          <Button variant="glow" size="lg" className="w-full" onClick={onNext}>
            <ChevronRight className="w-5 h-5 mr-2" />
            {nextLabel}
          </Button>
        )}

        <Button
          variant={passed ? 'ghost' : 'glow'}
          size={passed ? 'sm' : 'lg'}
          className={cn('w-full', !passed && 'bg-destructive/10 text-destructive hover:bg-destructive/15')}
          onClick={onTryAgain}
        >
          <RotateCcw className={cn(passed ? 'w-4 h-4 mr-1' : 'w-5 h-5 mr-2')} />
          {passed ? 'Practice again' : 'Try this expression again'}
        </Button>
      </div>
    </div>
  );
}
