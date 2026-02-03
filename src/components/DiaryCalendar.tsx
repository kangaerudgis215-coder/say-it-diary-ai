import { useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns';

interface DiaryCalendarProps {
  entries: { date: string; hasEntry: boolean }[];
  onDateSelect: (date: Date) => void;
  selectedDate?: Date;
}

export function DiaryCalendar({ entries, onDateSelect, selectedDate }: DiaryCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const startPadding = monthStart.getDay();
  const paddedDays = [...Array(startPadding).fill(null), ...days];
  
  const hasEntryOnDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return entries.some(e => e.date === dateStr && e.hasEntry);
  };

  return (
    <div className="card-elevated p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        
        <h3 className="font-semibold">
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
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentDay = isToday(day);
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={cn(
                "aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all",
                "hover:bg-muted text-sm font-medium",
                !isSameMonth(day, currentMonth) && "text-muted-foreground/30",
                isCurrentDay && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                hasEntry && !isSelected && "text-primary"
              )}
            >
              <span>{format(day, 'd')}</span>
              {hasEntry && (
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isSelected ? "bg-primary-foreground" : "bg-primary"
                )} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
