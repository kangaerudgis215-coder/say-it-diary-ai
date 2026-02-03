import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, X, Brain, Shuffle, Plus, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DiaryCalendar } from '@/components/DiaryCalendar';
import { RecallHistory } from '@/components/RecallHistory';
import { DiaryExpressions } from '@/components/DiaryExpressions';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format, isToday, isFuture, parseISO } from 'date-fns';

export default function Calendar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const [entries, setEntries] = useState<{ date: string; hasEntry: boolean }[]>([]);
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [recallHistory, setRecallHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchEntries();
  }, [user]);

  // Handle date parameter from URL (for navigation from expressions page)
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

    // Fetch recall history for this entry
    if (data) {
      const { data: recalls } = await supabase
        .from('recall_sessions')
        .select('id, score, created_at')
        .eq('diary_entry_id', data.id)
        .eq('completed', true)
        .order('created_at', { ascending: false });
      
      setRecallHistory(recalls || []);
    } else {
      setRecallHistory([]);
    }
  };

  const handleRandomQuiz = () => {
    if (allEntries.length === 0) return;
    
    // Filter out today's entry
    const today = format(new Date(), 'yyyy-MM-dd');
    const pastEntries = allEntries.filter(e => e.date !== today);
    
    if (pastEntries.length === 0) {
      // No past entries available
      return;
    }

    // Pick a random entry
    const randomIndex = Math.floor(Math.random() * pastEntries.length);
    const randomEntry = pastEntries[randomIndex];
    
    navigate(`/recall?diaryId=${randomEntry.id}&mode=random`);
  };

  const hasPastEntries = allEntries.some(e => e.date !== format(new Date(), 'yyyy-MM-dd'));

  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      {/* Header */}
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-xl">My Diary Collection</h1>
      </header>

      {/* Random Quiz Button */}
      <Button
        variant="outline"
        className="w-full mb-4 gap-2 h-auto py-3"
        onClick={handleRandomQuiz}
        disabled={!hasPastEntries}
      >
        <Shuffle className="w-5 h-5" />
        <div className="text-left">
          <p className="font-medium">Random past quiz</p>
          <p className="text-xs text-muted-foreground">
            {hasPastEntries 
              ? "Start a recall quiz using a random past diary"
              : "Complete some diaries first to unlock this"
            }
          </p>
        </div>
      </Button>

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
                setRecallHistory([]);
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
            <span>Created: {format(new Date(selectedEntry.created_at), 'MMM d, yyyy')}</span>
          </div>

          {/* Expressions from this diary */}
          <DiaryExpressions diaryEntryId={selectedEntry.id} />

          {/* Edit Diary Button */}
          <Button
            variant="outline"
            className="w-full mt-4 gap-2"
            onClick={() => navigate(`/chat?date=${selectedEntry.date}`)}
          >
            <Edit className="w-4 h-4" />
            Edit this diary
          </Button>

          {/* Recall Quiz Button */}
          <Button
            variant="secondary"
            className="w-full mt-2 gap-2"
            onClick={() => navigate(`/recall?diaryId=${selectedEntry.id}`)}
          >
            <Brain className="w-4 h-4" />
            Use this diary for recall quiz
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Start a recall quiz using this day's diary.
          </p>

          {/* Recall History */}
          <RecallHistory attempts={recallHistory} />
        </div>
      )}

      {/* Empty state when date selected but no entry */}
      {!selectedEntry && selectedDate && (
        <div className="mt-6 bg-card rounded-2xl p-6 text-center fade-in border border-border">
          <p className="text-muted-foreground mb-4">
            {isFuture(selectedDate) 
              ? "You can't write a diary for a future date."
              : `No diary entry for ${format(selectedDate, 'MMMM d, yyyy')} yet.`
            }
          </p>
          {!isFuture(selectedDate) && (
            <Button
              variant="glow"
              className="gap-2"
              onClick={() => navigate(`/chat?date=${format(selectedDate, 'yyyy-MM-dd')}`)}
            >
              <Plus className="w-4 h-4" />
              {isToday(selectedDate) ? "Start today's diary" : "Write diary for this day"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
