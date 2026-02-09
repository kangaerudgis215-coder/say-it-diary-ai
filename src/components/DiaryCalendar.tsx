import { useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, CheckCircle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns';

interface DiaryCalendarEntry {
  date: string;
  hasEntry: boolean;
  sentencesReviewCompleted?: boolean;
  fullDiaryChallengeCompleted?: boolean;
}

interface DiaryCalendarProps {
  entries: DiaryCalendarEntry[];
  onDateSelect: (date: Date) => void;
  selectedDate?: Date;
}

export function DiaryCalendar({ entries, onDateSelect, selectedDate }: DiaryCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Pad the start to align with the correct day of week
  const startPadding = monthStart.getDay();
  const paddedDays = [...Array(startPadding).fill(null), ...days];
  
  const getEntryState = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return entries.find(e => e.date === dateStr && e.hasEntry);
  };

  const hasEntryOnDate = (date: Date) => !!getEntryState(date);

  return (
    <div className="bg-card rounded-2xl p-4 border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        
        <h3 className="font-bold text-lg">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
      
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-center text-xs text-muted-foreground font-medium py-1">
            {day}
          </div>
        ))}
      </div>
      
      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {paddedDays.map((day, i) => {
          if (!day) {
            return <div key={`pad-${i}`} className="aspect-square" />;
          }
          
          const hasEntry = hasEntryOnDate(day);
          const entryState = getEntryState(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentDay = isToday(day);
          
          // Determine icon
          let EntryIcon = hasEntry ? BookOpen : null;
          let iconColor = isSelected ? "text-primary-foreground" : "text-primary";
          if (entryState?.fullDiaryChallengeCompleted) {
            EntryIcon = Star;
            iconColor = isSelected ? "text-primary-foreground" : "text-yellow-500";
          } else if (entryState?.sentencesReviewCompleted) {
            EntryIcon = CheckCircle;
          }
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all",
                "hover:bg-muted text-sm font-medium",
                !isSameMonth(day, currentMonth) && "text-muted-foreground/30",
                isCurrentDay && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                hasEntry && !isSelected && "text-primary"
              )}
            >
              <span>{format(day, 'd')}</span>
              {EntryIcon && (
                <EntryIcon className={cn("w-3 h-3", iconColor)} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
