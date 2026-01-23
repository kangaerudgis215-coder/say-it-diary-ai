import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreakBadgeProps {
  streak: number;
  className?: string;
  showMessage?: boolean;
}

const encouragingMessages = [
  "You're just getting started! 🌱",
  "Nice! Keep it going! ✨",
  "Amazing streak! You're on fire! 🔥",
  "Incredible dedication! 💪",
  "You're a journaling master! 🏆",
  "Legendary commitment! 👑",
];

function getStreakMessage(streak: number): string {
  if (streak === 0) return "Start your journey today!";
  if (streak === 1) return encouragingMessages[0];
  if (streak <= 3) return encouragingMessages[1];
  if (streak <= 7) return encouragingMessages[2];
  if (streak <= 14) return encouragingMessages[3];
  if (streak <= 30) return encouragingMessages[4];
  return encouragingMessages[5];
}

export function StreakBadge({ streak, className, showMessage = true }: StreakBadgeProps) {
  const isActive = streak > 0;
  
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div 
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300",
          isActive 
            ? "bg-primary/20 text-primary streak-fire" 
            : "bg-muted text-muted-foreground"
        )}
      >
        <Flame 
          className={cn(
            "w-5 h-5 transition-all",
            isActive && "text-primary animate-pulse"
          )} 
        />
        <span className="font-bold text-lg">{streak}</span>
        <span className="text-sm font-medium">
          {streak === 1 ? 'day' : 'days'}
        </span>
      </div>
      
      {showMessage && (
        <p className="text-sm text-muted-foreground text-center animate-fade-in">
          {getStreakMessage(streak)}
        </p>
      )}
    </div>
  );
}
