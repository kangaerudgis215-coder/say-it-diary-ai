import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type SortOption = 'recent' | 'least_reviewed' | 'oldest_review' | 'alphabetical';

interface ExpressionSortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const sortLabels: Record<SortOption, string> = {
  recent: 'Recently added',
  least_reviewed: 'Least reviewed',
  oldest_review: 'Oldest review',
  alphabetical: 'Alphabetical',
};

export function ExpressionSortSelect({ value, onChange }: ExpressionSortSelectProps) {
  return (
    <div>
      <span className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Sort by</span>
      <Select value={value} onValueChange={(v) => onChange(v as SortOption)}>
        <SelectTrigger className="w-full max-w-[200px] h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(sortLabels) as [SortOption, string][]).map(([key, label]) => (
            <SelectItem key={key} value={key}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
