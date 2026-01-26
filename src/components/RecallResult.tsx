import { CheckCircle, XCircle, Trophy, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RecallResultProps {
  score: number;
  feedback: string;
  usedExpressions: string[];
  missedExpressions: string[];
  onTryAgain: () => void;
  onGoHome: () => void;
  onGoBack: () => void;
  isFromCalendar: boolean;
}

export function RecallResult({
  score,
  feedback,
  usedExpressions,
  missedExpressions,
  onTryAgain,
  onGoHome,
  onGoBack,
  isFromCalendar,
}: RecallResultProps) {
  const getScoreColor = () => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getScoreEmoji = () => {
    if (score >= 80) return '🌟';
    if (score >= 60) return '💪';
    if (score >= 40) return '📚';
    return '🌱';
  };

  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onGoBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-xl">Recall Results</h1>
      </header>

      {/* Score Display */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-40 h-40 rounded-full bg-card border-4 border-border flex items-center justify-center">
            <div className="text-center">
              <Trophy className={cn("w-8 h-8 mx-auto mb-1", getScoreColor())} />
              <span className={cn("text-5xl font-bold", getScoreColor())}>
                {score}
              </span>
              <span className={cn("text-xl", getScoreColor())}>%</span>
            </div>
          </div>
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-3xl">
            {getScoreEmoji()}
          </span>
        </div>

        <p className="text-center text-muted-foreground max-w-xs leading-relaxed">
          {feedback}
        </p>

        {/* Expressions Used */}
        {usedExpressions.length > 0 && (
          <div className="w-full max-w-md bg-green-500/10 border border-green-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <p className="text-sm font-medium text-green-400">
                Expressions you used ({usedExpressions.length})
              </p>
            </div>
            <div className="space-y-1">
              {usedExpressions.map((exp, i) => (
                <p key={i} className="text-sm text-green-300/80">
                  • {exp}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Expressions Missed */}
        {missedExpressions.length > 0 && (
          <div className="w-full max-w-md bg-muted/50 border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                Try using next time ({missedExpressions.length})
              </p>
            </div>
            <div className="space-y-1">
              {missedExpressions.slice(0, 5).map((exp, i) => (
                <p key={i} className="text-sm text-muted-foreground">
                  • {exp}
                </p>
              ))}
              {missedExpressions.length > 5 && (
                <p className="text-xs text-muted-foreground/70 mt-2">
                  +{missedExpressions.length - 5} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 mt-6">
        <Button variant="glow" className="w-full" onClick={onTryAgain}>
          Try Again
        </Button>
        <Button 
          variant="outline" 
          className="w-full gap-2" 
          onClick={isFromCalendar ? onGoBack : onGoHome}
        >
          <Home className="w-4 h-4" />
          {isFromCalendar ? 'Back to Calendar' : 'Back to Home'}
        </Button>
      </div>
    </div>
  );
}
