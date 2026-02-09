import { Calendar, Star, Archive, ArchiveRestore } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ExpressionDetail } from '@/components/ExpressionDetail';

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
  isSelected: boolean;
  onSelect: () => void;
  onArchiveToggle: (id: string, newStatus: string) => void;
  onNavigateToDiary: () => void;
  onDeleted: () => void;
}

export function ExpressionListItem({
  expression: exp,
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

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left bg-card rounded-xl p-4 border border-border transition-all",
        "hover:border-primary/30",
        isSelected && "border-primary ring-1 ring-primary/20",
        exp.status === 'archived' && "opacity-60"
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
              <Badge variant="secondary" className="text-xs">{exp.pos_or_type}</Badge>
            )}
            {exp.is_user_added && (
              <Badge variant="default" className="text-xs bg-amber-500/20 text-amber-500 border-amber-500/30">
                <Star className="w-3 h-3 mr-0.5" />
                User
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
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onArchiveToggle(exp.id, exp.status === 'archived' ? 'active' : 'archived');
            }}
          >
            {exp.status === 'archived' ? (
              <><ArchiveRestore className="w-3 h-3 mr-1" />Restore</>
            ) : (
              <><Archive className="w-3 h-3 mr-1" />Archive</>
            )}
          </Button>
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
          />
        </div>
      )}
    </button>
  );
}
