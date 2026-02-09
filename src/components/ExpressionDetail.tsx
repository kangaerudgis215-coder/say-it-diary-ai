import { Calendar, BookOpen, MessageSquare, Tag, Layers, Star, Trash2, Loader2, Archive, ArchiveRestore, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

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
  onNavigateToDiary?: () => void;
  onDeleted?: () => void;
  onArchiveToggle?: (id: string, newStatus: string) => void;
}

export function ExpressionDetail({ expression, onNavigateToDiary, onDeleted, onArchiveToggle }: ExpressionDetailProps) {
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
              {expression.pos_or_type}
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

      {/* Review stats */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
          <BarChart3 className="w-3 h-3" />
          Practice Stats
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="font-bold text-sm">{expression.review_count || 0}</p>
            <p className="text-xs text-muted-foreground">Reviews</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="font-bold text-sm">{expression.correct_streak || 0}</p>
            <p className="text-xs text-muted-foreground">Streak</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="font-bold text-sm">{expression.mastery_level}/5</p>
            <p className="text-xs text-muted-foreground">Mastery</p>
          </div>
        </div>
        {expression.last_reviewed_at && (
          <p className="text-xs text-muted-foreground">
            Last reviewed: {format(new Date(expression.last_reviewed_at), 'MMM d, yyyy')}
          </p>
        )}
      </div>

      {/* Mastery bar */}
      <div className="space-y-1">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(expression.mastery_level / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Source diary */}
      {expression.diary_date && expression.diary_entry_id && (
        <div className="pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Calendar className="w-3 h-3" />
            From diary: {formatDiaryDate(expression.diary_date)}
          </div>
          {onNavigateToDiary && (
            <Button variant="outline" size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); onNavigateToDiary(); }}>
              View diary from this day
            </Button>
          )}
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
