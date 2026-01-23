import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DiaryCalendar } from '@/components/DiaryCalendar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

export default function Calendar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<{ date: string; hasEntry: boolean }[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  useEffect(() => {
    fetchEntries();
  }, [user]);

  const fetchEntries = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('diary_entries')
      .select('date')
      .eq('user_id', user.id);

    if (data) {
      setEntries(data.map(e => ({ date: e.date, hasEntry: true })));
    }
  };

  const handleDateSelect = async (date: Date) => {
    if (!user) return;

    setSelectedDate(date);
    const dateStr = format(date, 'yyyy-MM-dd');

    const { data } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', dateStr)
      .single();

    setSelectedEntry(data);
  };

  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      {/* Header */}
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-xl">My Diary Collection</h1>
      </header>

      {/* Calendar */}
      <DiaryCalendar
        entries={entries}
        onDateSelect={handleDateSelect}
        selectedDate={selectedDate}
      />

      {/* Selected Entry Preview */}
      {selectedEntry && (
        <div className="mt-6 bg-card rounded-2xl p-5 border border-border fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">
              {format(new Date(selectedEntry.date), 'MMMM d, yyyy')}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedDate(undefined);
                setSelectedEntry(null);
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <p className="text-sm leading-relaxed text-foreground/90">
            {selectedEntry.content}
          </p>

          {selectedEntry.japanese_summary && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">日本語サマリー</p>
              <p className="text-sm font-japanese text-muted-foreground">
                {selectedEntry.japanese_summary}
              </p>
            </div>
          )}

          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span>{selectedEntry.word_count} words</span>
            <span>Reviewed {selectedEntry.review_count}x</span>
          </div>
        </div>
      )}

      {/* Empty state when no entry selected */}
      {!selectedEntry && selectedDate && (
        <div className="mt-6 bg-muted/50 rounded-2xl p-6 text-center fade-in">
          <p className="text-muted-foreground">
            No diary entry for this day yet.
          </p>
        </div>
      )}
    </div>
  );
}
