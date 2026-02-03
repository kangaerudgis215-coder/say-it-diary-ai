import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, X, Brain, Shuffle, Plus, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DiaryCalendar } from '@/components/DiaryCalendar';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format, isToday, isFuture, parseISO, differenceInDays, differenceInWeeks } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Calendar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const [entries, setEntries] = useState<{ date: string; hasEntry: boolean }[]>([]);
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  useEffect(() => {
    fetchEntries();
  }, [user]);

  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam && user) {
      const date = parseISO(dateParam);
      handleDateSelect(date);
    }
  }, [searchParams, user]);

  const fetchEntries = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (data) {
      setAllEntries(data);
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
      .maybeSingle();

    setSelectedEntry(data);
  };

  const handleRandomQuiz = () => {
    if (allEntries.length === 0) return;
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const pastEntries = allEntries.filter(e => e.date !== today);
    
    if (pastEntries.length === 0) return;

    const randomIndex = Math.floor(Math.random() * pastEntries.length);
    const randomEntry = pastEntries[randomIndex];
    
    navigate(`/recall?diaryId=${randomEntry.id}&mode=random`);
  };

  const hasPastEntries = allEntries.some(e => e.date !== format(new Date(), 'yyyy-MM-dd'));

  const getTimeAgoLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = differenceInDays(new Date(), date);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    const weeks = differenceInWeeks(new Date(), date);
    if (weeks === 1) return '1 week ago';
    if (weeks < 4) return `${weeks} weeks ago`;
    return format(date, 'MMM d');
  };

  return (
    <div className="min-h-screen flex flex-col pb-nav">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 pt-6 pb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-xl">Diary History</h1>
      </header>

      {/* Random Quiz Card - Flashback Challenge Style */}
      <div className="px-6 mb-4">
        <button
          onClick={handleRandomQuiz}
          disabled={!hasPastEntries}
          className={cn(
            "w-full card-elevated p-5 text-left",
            "bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20",
            "hover:border-primary/40 transition-all",
            !hasPastEntries && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Shuffle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Flashback Challenge</p>
                <p className="text-sm text-muted-foreground">
                  {hasPastEntries 
                    ? "Test your memory with a random past diary"
                    : "Complete some diaries first"
                  }
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </button>
      </div>

      {/* Calendar */}
      <div className="px-6 mb-4">
        <DiaryCalendar
          entries={entries}
          onDateSelect={handleDateSelect}
          selectedDate={selectedDate}
        />
      </div>

      {/* Selected Entry Card */}
      {selectedEntry && (
        <div className="px-6 mb-6 fade-in">
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground">{getTimeAgoLabel(selectedEntry.date)}</p>
                <h3 className="font-bold text-lg">
                  {format(new Date(selectedEntry.date), 'MMMM d, yyyy')}
                </h3>
              </div>
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
            
            <p className="text-sm leading-relaxed text-foreground/90 mb-4 line-clamp-3">
              {selectedEntry.content}
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => navigate(`/chat?date=${selectedEntry.date}`)}
              >
                View full
              </Button>
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={() => navigate(`/recall?diaryId=${selectedEntry.id}`)}
              >
                <Brain className="w-4 h-4 mr-2" />
                Start recall
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state when date selected but no entry */}
      {!selectedEntry && selectedDate && (
        <div className="px-6 mb-6 fade-in">
          <div className="card-elevated p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <CalendarIcon className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">
              {isFuture(selectedDate) 
                ? "Can't write a diary for future dates"
                : `No diary for ${format(selectedDate, 'MMM d')}`
              }
            </p>
            {!isFuture(selectedDate) && (
              <Button
                className="btn-glow"
                onClick={() => navigate(`/chat?date=${format(selectedDate, 'yyyy-MM-dd')}`)}
              >
                <Plus className="w-4 h-4 mr-2" />
                {isToday(selectedDate) ? "Start today's diary" : "Write diary"}
              </Button>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
