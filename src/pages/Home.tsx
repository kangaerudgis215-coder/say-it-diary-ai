import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggleLottie } from '@/components/ThemeToggleLottie';
import { supabase } from '@/lib/supabase';
import { format, parseISO, isSameDay, differenceInCalendarDays, isFuture, isToday } from 'date-fns';
import { Plus } from 'lucide-react';
import { StampCalendar } from '@/components/home/StampCalendar';
import { DiaryListView } from '@/components/home/DiaryListView';
import { BottomTabBar } from '@/components/home/BottomTabBar';
import { ComposeFAB } from '@/components/home/ComposeFAB';
import { StreakHeroCompact } from '@/components/home/StreakHeroCompact';
import { CatBuddy } from '@/components/home/CatBuddy';

interface DiaryRow {
  id: string;
  date: string;
  content: string;
  created_at: string;
  full_diary_challenge_completed: boolean;
  sentences_review_completed: boolean;
}

export default function Home() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'calendar' | 'list'>('calendar');
  const [entries, setEntries] = useState<DiaryRow[]>([]);
  const [recallCompletedIds, setRecallCompletedIds] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    if (user) fetchEntries();
  }, [user]);

  // Refresh entries + recall completion when the tab regains focus or
  // becomes visible again. This ensures the recall badge appears
  // immediately after returning from the Recall page.
  useEffect(() => {
    if (!user) return;
    const onFocus = () => fetchEntries();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchEntries();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user]);

  const fetchEntries = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('diary_entries')
      .select('id, date, content, created_at, full_diary_challenge_completed, sentences_review_completed')
      .eq('user_id', user.id)
      .order('date', { ascending: false });
    setEntries((data || []) as DiaryRow[]);

    const { data: recalls } = await supabase
      .from('recall_sessions')
      .select('diary_entry_id')
      .eq('user_id', user.id)
      .eq('completed', true);
    setRecallCompletedIds(new Set((recalls || []).map((r: any) => r.diary_entry_id)));
  };

  const stamps = useMemo(
    () =>
      entries.map((e) => ({
        date: e.date,
        // キラキラ光る日 = リコール（翌日以降の復習）まで完了した日記
        mastered: recallCompletedIds.has(e.id),
        reviewed: e.sentences_review_completed,
      })),
    [entries, recallCompletedIds],
  );

  // Compute current streak from entry dates (consecutive days ending today or yesterday).
  const streak = useMemo(() => {
    if (entries.length === 0) return 0;
    const dates = Array.from(new Set(entries.map((e) => e.date))).sort().reverse();
    const today = new Date();
    const newest = parseISO(dates[0]);
    const gap = differenceInCalendarDays(today, newest);
    if (gap > 1) return 0;
    let count = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = differenceInCalendarDays(parseISO(dates[i - 1]), parseISO(dates[i]));
      if (diff === 1) count++;
      else break;
    }
    return count;
  }, [entries]);

  // Entries visible underneath the calendar (selected day + earlier)
  const calendarListEntries = useMemo(() => {
    if (tab !== 'calendar') return [];
    return entries.filter((e) => parseISO(e.date) <= selectedDate);
  }, [entries, selectedDate, tab]);

  return (
    <div className="min-h-screen flex flex-col bg-background pb-24">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <h1 className="text-lg font-semibold tracking-tight text-foreground/90">
          {tab === 'calendar' ? 'Home' : 'Entries'}
        </h1>
        <div className="flex items-center gap-1">
          {tab === 'list' && (
            <Button variant="ghost" size="icon" aria-label="Search">
              <Search className="w-5 h-5" />
            </Button>
          )}
          <ThemeToggleLottie />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={async () => {
              await signOut();
              navigate('/auth');
            }}
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 space-y-4">
        {tab === 'calendar' ? (
          <>
            <div className="grid grid-cols-2 gap-3 rounded-3xl overflow-hidden bg-card/60 border border-border/50 px-3 py-3 relative">
              <div
                className="absolute inset-0 pointer-events-none opacity-80"
                style={{
                  background:
                    'radial-gradient(ellipse at center top, hsl(var(--primary) / 0.18), transparent 60%)',
                }}
              />
              <div className="relative">
                <StreakHeroCompact streak={streak} />
              </div>
              <div className="relative">
                <CatBuddy recentDiary={entries[0]?.content} entries={entries} streak={streak} />
              </div>
            </div>
            <StampCalendar
              entries={stamps}
              onDateSelect={setSelectedDate}
              selectedDate={selectedDate}
            />

            {/* Selected day header */}
            <div className="px-1 pt-2 text-sm text-muted-foreground">
              {format(selectedDate, 'EEEE, MMM d')}
              {entries.some((e) => isSameDay(parseISO(e.date), selectedDate))
                ? ''
                : ' · No entry'}
            </div>

            {/* CTA when the selected day has no diary yet */}
            {!entries.some((e) => isSameDay(parseISO(e.date), selectedDate)) && (
              <div className="rounded-2xl bg-card/60 border border-border/50 p-5 text-center fade-in">
                {isFuture(selectedDate) ? (
                  <p className="text-sm text-muted-foreground">未来の日付には日記を書けません。</p>
                ) : (
                  <>
                    <div className="mb-1 flex justify-center">
                      {isToday(selectedDate) ? (
                        <span className="text-2xl">✨</span>
                      ) : (
                        <CalendarDays className="w-7 h-7 text-primary" />
                      )}
                    </div>
                    <p className="font-bold text-base mb-1">
                      {format(selectedDate, 'yyyy年M月d日')}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {isToday(selectedDate)
                        ? '今日の出来事を話して日記にしよう！'
                        : 'この日の日記を埋めて、ストリークを繋げよう🔥'}
                    </p>
                    <Button
                      variant="glow"
                      className="gap-2"
                      onClick={() =>
                        navigate(`/chat?date=${format(selectedDate, 'yyyy-MM-dd')}`)
                      }
                    >
                      <Plus className="w-4 h-4" />
                      {isToday(selectedDate) ? '今日の日記を書く' : 'この日の日記を書く'}
                    </Button>
                  </>
                )}
              </div>
            )}

            <DiaryListView entries={calendarListEntries} recallCompletedIds={recallCompletedIds} />
          </>
        ) : (
          <DiaryListView entries={entries} showSearch recallCompletedIds={recallCompletedIds} />
        )}
      </main>

      <ComposeFAB />
      <BottomTabBar homeTab={tab} onHomeTabChange={setTab} />
    </div>
  );
}
