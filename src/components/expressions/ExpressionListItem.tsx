import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Calendar, Star, Archive, ArchiveRestore, Repeat2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ExpressionDetail } from '@/components/ExpressionDetail';
import { posLabelJa } from '@/lib/mastery';

interface ExpressionListItemProps {
  expression: {
    id: string;
    expression: string;
    meaning: string | null;
    scene_or_context: string | null;
    pos_or_type: string | null;
    is_user_added?: boolean;
    diary_date?: string | null;
    diary_entry_id: string | null;
    status: string;
    review_count: number;
    mastery_level: number;
    example_sentence: string | null;
    correct_streak: number;
    last_reviewed_at: string | null;
  };
  /** Total number of times a *similar* expression appears across the user's history (>=1). */
  usageCount?: number;
  /** All diary dates (deduped, sorted desc) for the cluster this card represents. */
  relatedDiaryDates?: string[];
  isSelected: boolean;
  onSelect: () => void;
  onArchiveToggle: (id: string, newStatus: string) => void;
  onNavigateToDiary: (date?: string) => void;
  onDeleted: () => void;
}

export function ExpressionListItem({
  expression: exp,
  usageCount,
  relatedDiaryDates,
  isSelected,
  onSelect,
  onArchiveToggle,
  onNavigateToDiary,
  onDeleted,
}: ExpressionListItemProps) {
  const formatDiaryDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown date';
    return format(new Date(dateStr), 'MMM d, yyyy');
  };

  // Swipe-to-archive (left for active → archive, right for archived → restore).
  const [dx, setDx] = useState(0);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lockedRef = useRef<'h' | 'v' | null>(null);
  const movedRef = useRef(false);
  const isArchived = exp.status === 'archived';
  // Active rows: only allow left swipe. Archived rows: only right swipe.
  const SWIPE_THRESHOLD = 96;

  const onPointerDown = (e: ReactPointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    lockedRef.current = null;
    movedRef.current = false;
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const s = startRef.current;
    if (!s) return;
    const ddx = e.clientX - s.x;
    const ddy = e.clientY - s.y;
    if (lockedRef.current === null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
      lockedRef.current = Math.abs(ddx) > Math.abs(ddy) * 1.2 ? 'h' : 'v';
    }
    if (lockedRef.current !== 'h') return;
    movedRef.current = true;
    // Clamp to one direction depending on archived state
    const clamped = isArchived ? Math.max(0, ddx) : Math.min(0, ddx);
    setDx(Math.max(-160, Math.min(160, clamped)));
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const final = dx;
    startRef.current = null;
    lockedRef.current = null;
    setDx(0);
    if (Math.abs(final) >= SWIPE_THRESHOLD) {
      if (!isArchived && final < 0) {
        e.preventDefault();
        onArchiveToggle(exp.id, 'archived');
        return;
      }
      if (isArchived && final > 0) {
        e.preventDefault();
        onArchiveToggle(exp.id, 'active');
        return;
      }
    }
  };
  const onClickGuard = (e: React.MouseEvent) => {
    if (movedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      movedRef.current = false;
      return;
    }
    onSelect();
  };

  const swipeProgress = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD);

  return (
    <div className="relative w-full overflow-hidden rounded-xl">
      {/* Action background revealed during swipe */}
      {!isArchived && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-5 bg-destructive/15 text-destructive transition-opacity"
          style={{ opacity: swipeProgress }}
          aria-hidden
        >
          <Archive className="w-5 h-5 mr-1.5" />
          <span className="text-xs font-semibold">アーカイブ</span>
        </div>
      )}
      {isArchived && (
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-start pl-5 bg-emerald-500/15 text-emerald-500 transition-opacity"
          style={{ opacity: swipeProgress }}
          aria-hidden
        >
          <ArchiveRestore className="w-5 h-5 mr-1.5" />
          <span className="text-xs font-semibold">復元</span>
        </div>
      )}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClickGuard}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dx === 0 ? 'transform 0.2s ease-out' : 'none',
          touchAction: 'pan-y',
        }}
        className={cn(
          "relative w-full text-left bg-card rounded-xl p-4 border border-border transition-colors",
          "hover:border-primary/30",
          isSelected && "border-primary ring-1 ring-primary/20",
          isArchived && "opacity-60"
        )}
      >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className="font-medium text-primary block truncate">{exp.expression}</span>
          {exp.meaning && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">{exp.meaning}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {exp.status === 'archived' && (
              <Badge variant="outline" className="text-xs border-muted-foreground/30">
                <Archive className="w-3 h-3 mr-0.5" />
                Archived
              </Badge>
            )}
            {exp.scene_or_context && (
              <Badge variant="outline" className="text-xs">{exp.scene_or_context}</Badge>
            )}
            {exp.pos_or_type && (
              <Badge variant="secondary" className="text-xs">{posLabelJa(exp.pos_or_type) ?? exp.pos_or_type}</Badge>
            )}
            {exp.is_user_added && (
              <Badge variant="default" className="text-xs bg-amber-500/20 text-amber-500 border-amber-500/30">
                <Star className="w-3 h-3 mr-0.5" />
                User
              </Badge>
            )}
            {typeof usageCount === 'number' && usageCount > 1 && (
              <Badge
                variant="default"
                className="text-xs bg-amber-500/15 text-amber-300 border-amber-400/30"
                title={`${usageCount} 回 似た表現として使用`}
              >
                <Repeat2 className="w-3 h-3 mr-0.5" />
                ×{usageCount}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {exp.diary_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>{formatDiaryDate(exp.diary_date)}</span>
            </div>
          )}
          <span className="text-[10px] text-muted-foreground/70 italic">
            {isArchived ? '右にスワイプで復元' : '左にスワイプでアーカイブ'}
          </span>
        </div>
      </div>

      {/* Inline detail on mobile when selected */}
      {isSelected && (
        <div className="lg:hidden mt-4 pt-4 border-t border-border">
          <ExpressionDetail
            expression={exp}
            onNavigateToDiary={onNavigateToDiary}
            onDeleted={onDeleted}
            onArchiveToggle={onArchiveToggle}
            relatedDiaryDates={relatedDiaryDates}
          />
        </div>
      )}
      </button>
    </div>
  );
}
