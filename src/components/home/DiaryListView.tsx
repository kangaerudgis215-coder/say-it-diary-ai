import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DiaryEntryRow {
  id: string;
  date: string;
  content: string;
  created_at: string;
}

interface DiaryListViewProps {
  entries: DiaryEntryRow[];
  showSearch?: boolean;
  /** Set of diary entry ids whose recall practice has been completed. */
  recallCompletedIds?: Set<string>;
}

export function DiaryListView({ entries, showSearch = false, recallCompletedIds }: DiaryListViewProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.toLowerCase();
    return entries.filter(
      (e) =>
        e.content.toLowerCase().includes(q) ||
        e.date.includes(q),
    );
  }, [entries, query]);

  // Group by month label "yyyy年M月"
  const groups = useMemo(() => {
    const map = new Map<string, DiaryEntryRow[]>();
    for (const e of filtered) {
      const label = format(parseISO(e.date), 'yyyy年M月');
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-4">
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="日記を検索..."
            className="pl-9 pr-9 bg-card/60 border-border/60"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {query ? '一致する日記が見つかりません' : 'まだ日記がありません'}
        </div>
      )}

      {groups.map(([label, items]) => (
        <div key={label} className="space-y-2">
          <div className="text-xs text-muted-foreground px-1">{label}</div>
          <div className="space-y-2">
            {items.map((e) => (
              <DiaryCard
                key={e.id}
                entry={e}
                recallCompleted={!!recallCompletedIds?.has(e.id)}
                onClick={() => navigate(`/review?diaryId=${e.id}&date=${e.date}`)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DiaryCard({
  entry,
  recallCompleted,
  onClick,
}: {
  entry: DiaryEntryRow;
  recallCompleted: boolean;
  onClick: () => void;
}) {
  const d = parseISO(entry.date);
  const dow = format(d, 'EEEEE', { locale: ja }); // 月,火...
  const day = format(d, 'd');
  const time = format(parseISO(entry.created_at), 'HH:mm');

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left bg-card/70 hover:bg-card transition-colors relative',
        'rounded-2xl border p-4 flex gap-4',
        recallCompleted
          ? 'border-amber-400/50 shadow-[0_0_18px_hsl(38_92%_55%/0.18)]'
          : 'border-border/60',
      )}
    >
      {recallCompleted && (
        <span
          className="absolute -top-1.5 -right-1.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-md animate-pulse"
          aria-label="Recall completed"
        >
          <Sparkles className="w-3 h-3" />
          Recalled
        </span>
      )}
      <div className="flex flex-col items-center justify-start w-12 shrink-0">
        <span className="text-xs text-muted-foreground">{dow}</span>
        <span className="text-2xl font-bold leading-none mt-0.5">{day}</span>
        <span className="text-[10px] text-muted-foreground mt-1">{time}</span>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90 line-clamp-3 flex-1">
        {entry.content}
      </p>
    </button>
  );
}