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
 * Streak-style calendar: rows of cells get connected with a continuous
 * primary-colored "pill" wherever consecutive days have entries.
 * Mastered days get a vivid filled disc, reviewed/recorded days get a soft fill.
 * Random sparkle dots animate over active streak runs for delight.
 */
export function StampCalendar({ entries, onDateSelect, selectedDate }: StampCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = monthStart.getDay();
  const endPadding = (7 - ((startPadding + days.length) % 7)) % 7;
  const paddedDays: (Date | null)[] = [
    ...Array(startPadding).fill(null),
    ...days,
    ...Array(endPadding).fill(null),
  ];

  const entryMap = new Map(entries.map((e) => [e.date, e]));
  const entryFor = (date: Date) => entryMap.get(format(date, 'yyyy-MM-dd'));

  const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const rows: (Date | null)[][] = [];
  for (let i = 0; i < paddedDays.length; i += 7) rows.push(paddedDays.slice(i, i + 7));

  // Stats for the month
  const daysWithEntry = days.filter((d) => entryFor(d)).length;

  return (
    <div className="rounded-3xl bg-card/50 border border-border/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-base font-semibold tracking-wide">
          {format(currentMonth, 'MMMM yyyy')}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs"
            onClick={() => { setCurrentMonth(new Date()); onDateSelect(new Date()); }}>
            Today
          </Button>
        </div>
      </div>

      {/* Month stats */}
      <div className="px-4 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 text-primary text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          {daysWithEntry} days journaled
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 px-2">
        {dayLabels.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium py-1.5 text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Rows with streak pills */}
      <div className="px-2 pb-3 space-y-1.5">
        {rows.map((row, rIdx) => (
          <CalendarRow
            key={rIdx}
            row={row}
            entryFor={entryFor}
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            onDateSelect={onDateSelect}
          />
        ))}
      </div>
    </div>
  );
}

function CalendarRow({
  row, entryFor, currentMonth, selectedDate, onDateSelect,
}: {
  row: (Date | null)[];
  entryFor: (d: Date) => StampEntry | undefined;
  currentMonth: Date;
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
}) {
  // Compute contiguous streak segments of cells with an entry within this row.
  type Seg = { start: number; end: number };
  const segs: Seg[] = [];
  let cur: Seg | null = null;
  row.forEach((d, idx) => {
    const has = d ? !!entryFor(d) : false;
    if (has) {
      if (!cur) cur = { start: idx, end: idx };
      else cur.end = idx;
    } else {
      if (cur) { segs.push(cur); cur = null; }
    }
  });
  if (cur) segs.push(cur);

  return (
    <div className="relative grid grid-cols-7 gap-1 h-11">
      {/* Streak pill backgrounds */}
      {segs.map((s, i) => {
        const left = (s.start / 7) * 100;
        const width = ((s.end - s.start + 1) / 7) * 100;
        return (
          <div
            key={i}
            className="absolute top-0 h-11 rounded-full bg-primary/15 border border-primary/25 pointer-events-none"
            style={{ left: `calc(${left}% + 2px)`, width: `calc(${width}% - 4px)` }}
          >
            {/* sparkles */}
            {[0.25, 0.65].map((p, k) => (
              <span
                key={k}
                className="absolute top-1 sparkle-dot text-primary text-[10px]"
                style={{ left: `${p * 100}%`, animationDelay: `${(i + k) * 0.7}s` }}
              >
                ✦
              </span>
            ))}
          </div>
        );
      })}

      {/* Day cells */}
      {row.map((day, idx) => {
        if (!day) return <div key={`pad-${idx}`} />;
        const entry = entryFor(day);
        const hasEntry = !!entry;
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const isCurrent = isToday(day);
        const dim = !isSameMonth(day, currentMonth);

        return (
          <button
            key={day.toISOString()}
            onClick={() => onDateSelect(day)}
            className="relative flex items-center justify-center h-11"
          >
            {/* Disc for entry-day */}
            {hasEntry && (
              <span
                className={cn(
                  'absolute inset-1 rounded-full',
                  entry?.mastered
                    ? 'bg-primary shadow-[0_2px_10px_hsl(var(--primary)/0.45)]'
                    : entry?.reviewed
                      ? 'bg-primary/70'
                      : 'bg-primary/40',
                )}
              />
            )}
            {/* Selected outline */}
            {isSelected && (
              <span className="absolute inset-0.5 rounded-full ring-2 ring-foreground/90 pointer-events-none" />
            )}
            {/* Today subtle ring (only when no selection) */}
            {isCurrent && !isSelected && (
              <span className="absolute inset-0.5 rounded-full ring-1 ring-primary/70 pointer-events-none" />
            )}
            <span
              className={cn(
                'relative text-xs font-semibold',
                hasEntry ? 'text-primary-foreground' : 'text-foreground/80',
                dim && !hasEntry && 'text-foreground/30',
              )}
            >
              {format(day, 'd')}
            </span>
          </button>
        );
      })}
    </div>
  );
}
