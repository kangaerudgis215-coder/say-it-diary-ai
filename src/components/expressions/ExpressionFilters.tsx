import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExpressionFiltersProps {
  availableScenes: string[];
  availableTypes: string[];
  sceneFilter: string;
  typeFilter: string;
  onSceneChange: (scene: string) => void;
  onTypeChange: (type: string) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
}

export function ExpressionFilters({
  availableScenes,
  availableTypes,
  sceneFilter,
  typeFilter,
  onSceneChange,
  onTypeChange,
  hasActiveFilters,
  onClear,
}: ExpressionFiltersProps) {
  return (
    <>
      {/* Scene filters */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Scene / Context</span>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClear} className="h-6 px-2 text-xs">
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {availableScenes.map((scene) => (
            <Badge
              key={scene}
              variant={sceneFilter === scene ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-all",
                sceneFilter === scene ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
              onClick={() => onSceneChange(scene)}
            >
              {scene === 'All' ? 'All Scenes' : scene}
            </Badge>
          ))}
        </div>
      </div>

      {/* Type filters */}
      <div>
        <span className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Type / Part of Speech</span>
        <div className="flex flex-wrap gap-2">
          {availableTypes.map((type) => (
            <Badge
              key={type}
              variant={typeFilter === type ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-all",
                typeFilter === type ? "bg-secondary text-secondary-foreground" : "hover:bg-muted"
              )}
              onClick={() => onTypeChange(type)}
            >
              {type === 'All' ? 'All Types' : type}
            </Badge>
          ))}
        </div>
      </div>
    </>
  );
}
