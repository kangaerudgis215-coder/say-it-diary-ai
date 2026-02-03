import { ArrowLeft, Home, RotateCcw, Eye, Award, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThreeAxisEvaluation, ThreeAxisScores } from '@/components/ThreeAxisEvaluation';
import { cn } from '@/lib/utils';

interface RecallResultProps {
  score: number;
  feedback: string;
  usedExpressions: string[];
  missedExpressions: string[];
  threeAxis?: ThreeAxisScores;
  passed?: boolean;
  onTryAgain: () => void;
  onGoHome: () => void;
  onGoBack: () => void;
  isFromCalendar?: boolean;
}

export function RecallResult({
  score,
  feedback,
  usedExpressions,
  missedExpressions,
  threeAxis,
  passed,
  onTryAgain,
  onGoHome,
  onGoBack,
  isFromCalendar = false,
}: RecallResultProps) {
  const isPassed = passed ?? score >= 70;

  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onGoBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-xl">Recall Complete</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {threeAxis && (
          <ThreeAxisEvaluation scores={threeAxis} size="lg" />
        )}

        <div className="text-center max-w-sm">
          {isPassed ? (
            <>
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-xl font-bold mb-2">
                Excellent recall! 🎉
              </h2>
              <p className="text-muted-foreground">
                You remembered this diary well. Keep up the great work!
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-primary mb-2">
                Nice effort! 💪
              </h2>
              <p className="text-muted-foreground">
                {feedback}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Practice makes perfect. Try again when you're ready!
              </p>
            </>
          )}
        </div>

        {usedExpressions.length > 0 && (
          <div className="w-full max-w-sm">
            <p className="text-xs text-muted-foreground mb-2 uppercase">Expressions used ✓</p>
            <div className="flex flex-wrap gap-2">
              {usedExpressions.map((exp, i) => (
                <span key={i} className="text-xs bg-accent/20 text-accent px-3 py-1.5 rounded-full">
                  {exp}
                </span>
              ))}
            </div>
          </div>
        )}

        {missedExpressions.length > 0 && (
          <div className="w-full max-w-sm">
            <p className="text-xs text-muted-foreground mb-2 uppercase">Expressions to review</p>
            <div className="flex flex-wrap gap-2">
              {missedExpressions.map((exp, i) => (
                <span key={i} className="text-xs bg-muted text-muted-foreground px-3 py-1.5 rounded-full">
                  {exp}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 mt-6">
        {isPassed ? (
          <Button className="w-full btn-glow" size="lg" onClick={onGoHome}>
            <Home className="w-5 h-5 mr-2" />
            Back to Home
          </Button>
        ) : (
          <>
            <Button className="w-full btn-glow" size="lg" onClick={onTryAgain}>
              <RotateCcw className="w-5 h-5 mr-2" />
              Try Again
            </Button>
            <Button variant="outline" size="lg" className="w-full" onClick={onGoBack}>
              <Eye className="w-5 h-5 mr-2" />
              Review Diary
            </Button>
          </>
        )}
        
        {isFromCalendar && isPassed && (
          <Button variant="ghost" size="sm" className="w-full" onClick={onGoBack}>
            Back to Calendar
          </Button>
        )}
      </div>
    </div>
  );
}
