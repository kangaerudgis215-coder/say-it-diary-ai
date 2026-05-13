import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
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
  const isArchived = exp.status === 'archived';
  const SWIPE_THRESHOLD = 84;
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const lockedRef = useRef<'h' | 'v' | null>(null);
  const dxRef = useRef(0);
  const movedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const applyTransform = (val: number) => {
    if (cardRef.current) {
      cardRef.current.style.transform = `translate3d(${val}px,0,0)`;
    }
    if (overlayRef.current) {
      overlayRef.current.style.opacity = String(Math.min(1, Math.abs(val) / SWIPE_THRESHOLD));
    }
  };

  const resetCard = (animate: boolean) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (cardRef.current) {
      cardRef.current.style.transition = animate ? 'transform 0.22s ease-out' : 'none';
      cardRef.current.style.transform = 'translate3d(0,0,0)';
    }
    if (overlayRef.current) {
      overlayRef.current.style.transition = animate ? 'opacity 0.22s ease-out' : 'none';
      overlayRef.current.style.opacity = '0';
    }
    dxRef.current = 0;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    // Only handle primary pointer / touches
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    lockedRef.current = null;
    movedRef.current = false;
    dxRef.current = 0;
    if (cardRef.current) {
      cardRef.current.style.transition = 'none';
      try {
        cardRef.current.setPointerCapture(e.pointerId);
      } catch {}
    }
    if (overlayRef.current) overlayRef.current.style.transition = 'none';
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = startRef.current;
    if (!s) return;
    const ddx = e.clientX - s.x;
    const ddy = e.clientY - s.y;
    if (lockedRef.current === null) {
      if (Math.abs(ddx) < 6 && Math.abs(ddy) < 6) return;
      lockedRef.current = Math.abs(ddx) > Math.abs(ddy) ? 'h' : 'v';
    }
    if (lockedRef.current !== 'h') return;
    movedRef.current = true;
    // Clamp to one direction depending on archived state
    const clamped = isArchived ? Math.max(0, ddx) : Math.min(0, ddx);
    const next = Math.max(-180, Math.min(180, clamped));
    dxRef.current = next;
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        applyTransform(dxRef.current);
      });
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const final = dxRef.current;
    const s = startRef.current;
    const elapsed = s ? performance.now() - s.t : 0;
    const velocity = elapsed > 0 ? Math.abs(final) / elapsed : 0; // px/ms
    startRef.current = null;
    lockedRef.current = null;
    try {
      cardRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
    const passed =
      Math.abs(final) >= SWIPE_THRESHOLD || (Math.abs(final) > 36 && velocity > 0.6);
    if (passed) {
      if (!isArchived && final < 0) {
        // Slide off then commit
        if (cardRef.current) {
          cardRef.current.style.transition = 'transform 0.18s ease-out';
          cardRef.current.style.transform = 'translate3d(-110%,0,0)';
        }
        if (overlayRef.current) overlayRef.current.style.opacity = '1';
        setTimeout(() => onArchiveToggle(exp.id, 'archived'), 140);
        return;
      }
      if (isArchived && final > 0) {
        if (cardRef.current) {
          cardRef.current.style.transition = 'transform 0.18s ease-out';
          cardRef.current.style.transform = 'translate3d(110%,0,0)';
        }
        if (overlayRef.current) overlayRef.current.style.opacity = '1';
        setTimeout(() => onArchiveToggle(exp.id, 'active'), 140);
        return;
      }
    }
    resetCard(true);
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

  return (
    <div className="relative w-full overflow-hidden rounded-xl">
      {/* Action background revealed during swipe */}
      {!isArchived ? (
        <div
          ref={overlayRef}
          className="absolute inset-y-0 right-0 left-0 flex items-center justify-end pr-5 bg-destructive/15 text-destructive rounded-xl pointer-events-none"
          style={{ opacity: 0, willChange: 'opacity' }}
          aria-hidden
        >
          <Archive className="w-5 h-5 mr-1.5" />
          <span className="text-xs font-semibold">アーカイブ</span>
        </div>
      ) : (
        <div
          ref={overlayRef}
          className="absolute inset-y-0 right-0 left-0 flex items-center justify-start pl-5 bg-emerald-500/15 text-emerald-500 rounded-xl pointer-events-none"
          style={{ opacity: 0, willChange: 'opacity' }}
          aria-hidden
        >
          <ArchiveRestore className="w-5 h-5 mr-1.5" />
          <span className="text-xs font-semibold">復元</span>
        </div>
      )}
      <button
        ref={cardRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClickGuard}
        style={{
          touchAction: 'pan-y',
          willChange: 'transform',
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
