import { Calendar, BookOpen, MessageSquare, Tag, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

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
  };
  onNavigateToDiary?: () => void;
}

export function ExpressionDetail({ expression, onNavigateToDiary }: ExpressionDetailProps) {
  const formatDiaryDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown date';
    return format(new Date(dateStr), 'MMMM d, yyyy');
  };

  return (
    <div className="space-y-4">
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

      {/* Mastery level */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Mastery Level</span>
          <span className="font-medium">{expression.mastery_level}/5</span>
        </div>
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
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToDiary();
              }}
            >
              View diary from this day
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
