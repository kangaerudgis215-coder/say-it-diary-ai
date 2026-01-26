import { format } from 'date-fns';
import { History, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecallAttempt {
  id: string;
  score: number | null;
  created_at: string;
}

interface RecallHistoryProps {
  attempts: RecallAttempt[];
}

export function RecallHistory({ attempts }: RecallHistoryProps) {
  if (attempts.length === 0) {
    return null;
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-yellow-400';
    return 'text-orange-400';
  };

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">
          Recall History ({attempts.length})
        </p>
      </div>
      <div className="space-y-2">
        {attempts.slice(0, 5).map((attempt) => (
          <div 
            key={attempt.id} 
            className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2"
          >
            <span className="text-muted-foreground">
              {format(new Date(attempt.created_at), 'MMM d, yyyy')}
            </span>
            <div className="flex items-center gap-1">
              <Trophy className={cn("w-3 h-3", getScoreColor(attempt.score))} />
              <span className={cn("font-medium", getScoreColor(attempt.score))}>
                {attempt.score !== null ? `${attempt.score}%` : '—'}
              </span>
            </div>
          </div>
        ))}
        {attempts.length > 5 && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            +{attempts.length - 5} more attempts
          </p>
        )}
      </div>
    </div>
  );
}
