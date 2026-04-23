import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isSameDay, isToday, addMonths, subMonths,
} from 'date-fns';

export interface StampEntry {
  date: string; // yyyy-MM-dd
  mastered?: boolean;
  reviewed?: boolean;
}

interface StampCalendarProps {
  entries: StampEntry[];
  onDateSelect: (date: Date) => void;
  selectedDate?: Date;
}

/**
 * Calendar grid with circular "stamp" markers on dates that have a diary entry.
 * Inspired by the iOS Diary app — sparse, bordered grid + filled disc stamps.
 */
export function StampCalendar({ entries, onDateSelect, selectedDate }: StampCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = monthStart.getDay();
  const endPadding = (7 - ((startPadding + days.length) % 7)) % 7;
  const paddedDays = [
    ...Array(startPadding).fill(null),
    ...days,
    ...Array(endPadding).fill(null),
  ];

  const entryFor = (date: Date) =>
    entries.find((e) => e.date === format(date, 'yyyy-MM-dd'));

  // Rainbow palette (HSL) — deterministic by date so each stamp has a stable hue.
  const RAINBOW_HUES = [0, 30, 50, 130, 200, 250, 290];
  const hueFor = (dateStr: string) => {
    let h = 0;
    for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
    return RAINBOW_HUES[h % RAINBOW_HUES.length];
  };

  const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="bg-card/40 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="px-4 py-1.5 rounded-full bg-muted/60 text-sm font-semibold">
          {format(currentMonth, 'yyyy年M月')}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              setCurrentMonth(new Date());
              onDateSelect(new Date());
            }}
          >
            今日
          </Button>
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-t border-border/60">
        {dayLabels.map((d, i) => (
          <div
            key={d}
            className={cn(
              'text-center text-[11px] font-medium py-1.5 bg-muted/30 border-r border-border/40 last:border-r-0',
              i === 0 && 'text-destructive/80',
              i === 6 && 'text-accent-foreground/80',
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid with bordered cells */}
      <div className="grid grid-cols-7 border-t border-border/40">
        {paddedDays.map((day, i) => {
          const isLastInRow = (i + 1) % 7 === 0;
          const rowIndex = Math.floor(i / 7);
          const totalRows = paddedDays.length / 7;
          const isLastRow = rowIndex === totalRows - 1;

          if (!day) {
            return (
              <div
                key={`pad-${i}`}
                className={cn(
                  'aspect-square border-border/40',
                  !isLastInRow && 'border-r',
                  !isLastRow && 'border-b',
                )}
              />
            );
          }

          const entry = entryFor(day);
          const hasEntry = !!entry;
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrent = isToday(day);
          const dim = !isSameMonth(day, currentMonth);
          const dow = day.getDay();

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={cn(
                'relative aspect-square flex items-center justify-center border-border/40 transition-colors',
                !isLastInRow && 'border-r',
                !isLastRow && 'border-b',
                'hover:bg-muted/40',
              )}
            >
              {/* Stamp disc */}
              {hasEntry && (
                <span
                  className={cn(
                    'absolute inset-1.5 rounded-full',
                    entry?.mastered
                      ? 'bg-primary/70'
                      : 'bg-muted-foreground/40',
                  )}
                />
              )}
              {/* Selected ring */}
              {isSelected && (
                <span className="absolute inset-1 rounded-md ring-2 ring-foreground/90 pointer-events-none" />
              )}
              {/* Today ring */}
              {isCurrent && !isSelected && (
                <span className="absolute inset-1 rounded-md ring-1 ring-primary/70 pointer-events-none" />
              )}
              <span
                className={cn(
                  'relative text-sm font-medium',
                  hasEntry ? 'text-foreground' : 'text-foreground/80',
                  dim && 'text-foreground/30',
                  !hasEntry && dow === 0 && 'text-destructive/80',
                  !hasEntry && dow === 6 && 'text-accent-foreground/80',
                )}
              >
                {format(day, 'd')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}