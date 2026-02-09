/**
 * Celebration screen shown when Full Diary Challenge is completed successfully
 */
import { Trophy, PartyPopper, Eye, RotateCcw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

interface CelebrationScreenProps {
  diaryDate: string;
  usedExpressionsCount: number;
  totalExpressionsCount: number;
  attemptNumber: number;
  onSeeCorrections: () => void;
  onTryAgain: () => void;
  onBackToCalendar: () => void;
}

export function CelebrationScreen({
  diaryDate,
  usedExpressionsCount,
  totalExpressionsCount,
  attemptNumber,
  onSeeCorrections,
  onTryAgain,
  onBackToCalendar,
}: CelebrationScreenProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Trigger confetti animation after mount
    const t = setTimeout(() => setShowConfetti(true), 100);
    return () => clearTimeout(t);
  }, []);

  const ratio = totalExpressionsCount > 0 ? usedExpressionsCount / totalExpressionsCount : 1;
  const rating = ratio >= 0.8 ? 'Great' : ratio >= 0.5 ? 'Good' : 'Needs work';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      {/* Confetti dots */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 60}%`,
                backgroundColor: ['hsl(var(--primary))', 'hsl(var(--accent))', '#f59e0b', '#10b981', '#ec4899'][i % 5],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1.5 + Math.random() * 2}s`,
                opacity: 0.7,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 space-y-6 max-w-sm">
        {/* Trophy icon */}
        <div className="mx-auto w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
          <Trophy className="w-12 h-12 text-primary" />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            {rating === 'Great' ? '🎉 Amazing job!' : rating === 'Good' ? '👏 Well done!' : '💪 Keep it up!'}
          </h1>
          <p className="text-muted-foreground">
            You said the whole diary in English!
          </p>
        </div>

        {/* Stats */}
        <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">{diaryDate}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Key expressions used</span>
            <span className="font-medium">{usedExpressionsCount} / {totalExpressionsCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Attempt</span>
            <span className="font-medium">#{attemptNumber}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Rating</span>
            <span className={`font-bold ${rating === 'Great' ? 'text-primary' : rating === 'Good' ? 'text-accent-foreground' : 'text-muted-foreground'}`}>
              {rating}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <Button variant="glow" size="lg" className="w-full gap-2" onClick={onSeeCorrections}>
            <Eye className="w-5 h-5" />
            See detailed corrections
          </Button>
          <Button variant="outline" className="w-full gap-2" onClick={onTryAgain}>
            <RotateCcw className="w-4 h-4" />
            Try again
          </Button>
          <Button variant="ghost" className="w-full gap-2" onClick={onBackToCalendar}>
            <ArrowLeft className="w-4 h-4" />
            Back to calendar
          </Button>
        </div>
      </div>
    </div>
  );
}
