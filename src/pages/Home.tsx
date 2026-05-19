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
import { FirstTimeCoachMark } from '@/components/home/FirstTimeCoachMark';
import { StreakHeroCompact } from '@/components/home/StreakHeroCompact';
import { CatBuddy } from '@/components/home/CatBuddy';
import { SelectedDayChatPreview } from '@/components/home/SelectedDayChatPreview';
import { speakAssistantImmediately } from '@/lib/assistantSpeech';
import { getChatWelcomeMessage } from '@/lib/chatWelcome';
import { FeedbackSection } from '@/components/home/FeedbackSection';
import { ComposeModeSheet, getDefaultComposeMode } from '@/components/home/ComposeModeSheet';
import {
  StreakCelebrationOverlay,
  DIARY_CELEBRATION_FLAG,
} from '@/components/home/StreakCelebrationOverlay';

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
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [showCoachMark, setShowCoachMark] = useState(false);
  const [composeSheet, setComposeSheet] = useState<{ open: boolean; date: string }>({
    open: false,
    date: format(new Date(), 'yyyy-MM-dd'),
  });
  const [celebrate, setCelebrate] = useState(false);

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
    setEntriesLoaded(true);
  };

  // Show the first-time coach mark once when the user has zero entries.
  useEffect(() => {
    if (!entriesLoaded || !user) return;
    const seenKey = `soki_coach_mark_seen_${user.id}`;
    if (entries.length === 0 && !localStorage.getItem(seenKey)) {
      setShowCoachMark(true);
    }
  }, [entriesLoaded, entries.length, user]);

  const startDiaryChat = (date: Date) => {
    const diaryDate = format(date, 'yyyy-MM-dd');
    const hasEntry = entries.some((e) => e.date === diaryDate);
    const defaultMode = getDefaultComposeMode();
    if (defaultMode === 'speak') {
      navigate(`/speak?date=${diaryDate}`);
      return;
    }
    if (defaultMode === 'chat') {
      if (!hasEntry) {
        speakAssistantImmediately(getChatWelcomeMessage(diaryDate).content);
      }
      navigate(`/chat?date=${diaryDate}&welcomeSpoken=1`);
      return;
    }
    setComposeSheet({ open: true, date: diaryDate });
  };

  const stamps = useMemo(
    () =>
      entries.map((e) => ({
        date: e.date,
        // 濃い色 = 並び替えクイズを1回以上クリア（復習完了）した日記
        // 薄い色 = 日記を書いただけ
        mastered: e.sentences_review_completed,
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

  // After diary generation, Chat/Speak set a localStorage flag. When the
  // user lands back on Home, show the streak celebration once.
  useEffect(() => {
    if (!entriesLoaded) return;
    try {
      if (localStorage.getItem(DIARY_CELEBRATION_FLAG)) {
        setCelebrate(true);
      }
    } catch {
      /* ignore */
    }
  }, [entriesLoaded]);

  const closeCelebration = () => {
    try {
      localStorage.removeItem(DIARY_CELEBRATION_FLAG);
    } catch {
      /* ignore */
    }
    setCelebrate(false);
  };

  // Diary entry (if any) for the currently-selected calendar day.
  const selectedDayEntry = useMemo(
    () => entries.find((e) => isSameDay(parseISO(e.date), selectedDate)),
    [entries, selectedDate],
  );

  return (
    <div className="min-h-screen flex flex-col bg-background pb-24">
      {celebrate && (
        <StreakCelebrationOverlay streak={streak} onClose={closeCelebration} />
      )}
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
                <CatBuddy recentDiary={entries[0]?.content} entries={entries} streak={streak} sizeScale={1.5} />
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
            {!selectedDayEntry ? (
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
                      onClick={() => startDiaryChat(selectedDate)}
                    >
                      <Plus className="w-4 h-4" />
                      {isToday(selectedDate) ? '今日の日記を書く' : 'この日の日記を書く'}
                    </Button>
                  </>
                )}
              </div>
            ) : (
              user && (
                <SelectedDayChatPreview
                  userId={user.id}
                  diaryId={selectedDayEntry.id}
                  diaryDate={selectedDayEntry.date}
                />
              )
            )}
          </>
        ) : (
          <DiaryListView entries={entries} showSearch recallCompletedIds={recallCompletedIds} />
        )}
        <FeedbackSection />
      </main>

      <ComposeFAB
        skipWelcomeVoice={entries.some(
          (e) => e.date === format(new Date(), 'yyyy-MM-dd'),
        )}
      />
      <BottomTabBar homeTab={tab} onHomeTabChange={setTab} />
      <ComposeModeSheet
        open={composeSheet.open}
        onOpenChange={(o) => setComposeSheet((s) => ({ ...s, open: o }))}
        date={composeSheet.date}
        skipWelcomeVoice={entries.some((e) => e.date === composeSheet.date)}
      />
      {showCoachMark && user && (
        <FirstTimeCoachMark
          onDismiss={() => {
            localStorage.setItem(`soki_coach_mark_seen_${user.id}`, '1');
            setShowCoachMark(false);
          }}
        />
      )}
    </div>
  );
}
