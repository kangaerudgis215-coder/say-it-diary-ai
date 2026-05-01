import { Calendar, BookOpen, MessageSquare, Tag, Layers, Star, Trash2, Loader2, Archive, ArchiveRestore, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { posLabelJa } from '@/lib/mastery';

interface ExpressionDetailProps {
  expression: {
    id: string;
    expression: string;
    meaning: string | null;
    example_sentence: string | null;
    mastery_level: number;
    diary_date?: string | null;
    scene_or_context: string | null;
    pos_or_type: string | null;
    diary_entry_id: string | null;
    is_user_added?: boolean;
    status?: string;
    review_count?: number;
    correct_streak?: number;
    last_reviewed_at?: string | null;
  };
  onNavigateToDiary?: (date?: string) => void;
  onDeleted?: () => void;
  onArchiveToggle?: (id: string, newStatus: string) => void;
  /**
   * When this expression is the representative of a cluster of similar
   * expressions, pass every member's diary date here (deduped, sorted).
   * If two or more dates exist, the "View diary" button becomes a date picker.
   */
  relatedDiaryDates?: string[];
}

export function ExpressionDetail({
  expression,
  onNavigateToDiary,
  onDeleted,
  onArchiveToggle,
  relatedDiaryDates,
}: ExpressionDetailProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!expression.is_user_added) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('expressions').delete().eq('id', expression.id);
      if (error) throw error;
      toast({ title: 'Expression deleted', description: 'The expression has been removed from your collection.' });
      onDeleted?.();
    } catch (error) {
      console.error('Failed to delete expression:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete expression. Please try again.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDiaryDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown date';
    return format(new Date(dateStr), 'MMMM d, yyyy');
  };

  const isArchived = expression.status === 'archived';

  return (
    <div className="space-y-4">
      {/* Status badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {expression.is_user_added && (
          <div className="flex items-center gap-1 text-amber-500">
            <Star className="w-4 h-4 fill-amber-500" />
            <span className="text-sm font-medium">User-added</span>
          </div>
        )}
        {isArchived && (
          <Badge variant="outline" className="text-xs border-muted-foreground/30">
            <Archive className="w-3 h-3 mr-1" />
            Archived
          </Badge>
        )}
      </div>

      {/* Expression header */}
      <div>
        <h3 className="text-lg font-bold text-primary">{expression.expression}</h3>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {expression.scene_or_context && (
            <Badge variant="outline" className="gap-1">
              <Tag className="w-3 h-3" />
              {expression.scene_or_context}
            </Badge>
          )}
          {expression.pos_or_type && (
            <Badge variant="secondary" className="gap-1">
              <Layers className="w-3 h-3" />
              {posLabelJa(expression.pos_or_type) ?? expression.pos_or_type}
            </Badge>
          )}
        </div>
      </div>

      {/* Meaning */}
      {expression.meaning && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
            <BookOpen className="w-3 h-3" />
            Meaning
          </div>
          <p className="text-sm">{expression.meaning}</p>
        </div>
      )}

      {/* Example sentence */}
      {expression.example_sentence && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
            <MessageSquare className="w-3 h-3" />
            Example
          </div>
          <p className="text-sm italic text-muted-foreground">"{expression.example_sentence}"</p>
        </div>
      )}

      {/* Mastery bar — the only at-a-glance "marubatsu" indicator */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Mastery</span>
          <span className="tabular-nums">{expression.mastery_level ?? 0}/3</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(expression.mastery_level / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Source diary */}
      {expression.diary_date && expression.diary_entry_id && (
        <div className="pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Calendar className="w-3 h-3" />
            {relatedDiaryDates && relatedDiaryDates.length > 1
              ? `Used in ${relatedDiaryDates.length} diaries`
              : `From diary: ${formatDiaryDate(expression.diary_date)}`}
          </div>
          {onNavigateToDiary &&
            (relatedDiaryDates && relatedDiaryDates.length > 1 ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>View diary from this day</span>
                    <ChevronDown className="w-4 h-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-64 p-2 bg-popover z-50"
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-2 py-1">
                    Pick a date
                  </p>
                  <div className="max-h-64 overflow-y-auto">
                    {relatedDiaryDates.map((d) => (
                      <button
                        key={d}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToDiary(d);
                        }}
                        className={cn(
                          'w-full text-left px-2 py-2 rounded-md text-sm hover:bg-muted transition-colors',
                          d === expression.diary_date && 'bg-muted/60 font-medium',
                        )}
                      >
                        {formatDiaryDate(d)}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToDiary(expression.diary_date ?? undefined);
                }}
              >
                View diary from this day
              </Button>
            ))}
        </div>
      )}

      {/* Archive / Unarchive */}
      {onArchiveToggle && (
        <div className="pt-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onArchiveToggle(expression.id, isArchived ? 'active' : 'archived');
            }}
          >
            {isArchived ? (
              <><ArchiveRestore className="w-4 h-4 mr-2" />Restore to practice queue</>
            ) : (
              <><Archive className="w-4 h-4 mr-2" />Archive — I know this</>
            )}
          </Button>
        </div>
      )}

      {/* Delete button for user-added expressions */}
      {expression.is_user_added && (
        <div className="pt-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            {isDeleting ? 'Deleting...' : 'Delete expression'}
          </Button>
        </div>
      )}
    </div>
  );
}
