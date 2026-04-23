import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Sun, Moon, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/ThemeProvider';
import { supabase } from '@/lib/supabase';
import { format, parseISO, isSameDay } from 'date-fns';
import { StampCalendar } from '@/components/home/StampCalendar';
import { DiaryListView } from '@/components/home/DiaryListView';
import { BottomTabBar } from '@/components/home/BottomTabBar';
import { ComposeFAB } from '@/components/home/ComposeFAB';

interface DiaryRow {
  id: string;
  date: string;
  content: string;
  created_at: string;
  full_diary_challenge_completed: boolean;
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'calendar' | 'list'>('calendar');
  const [entries, setEntries] = useState<DiaryRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    if (user) fetchEntries();
  }, [user]);

  const fetchEntries = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('diary_entries')
      .select('id, date, content, created_at, full_diary_challenge_completed')
      .eq('user_id', user.id)
      .order('date', { ascending: false });
    setEntries((data || []) as DiaryRow[]);
  };

  const stamps = useMemo(
    () =>
      entries.map((e) => ({
        date: e.date,
        mastered: e.full_diary_challenge_completed,
      })),
    [entries],
  );

  // Entries visible underneath the calendar (selected day + earlier)
  const calendarListEntries = useMemo(() => {
    if (tab !== 'calendar') return [];
    return entries.filter((e) => parseISO(e.date) <= selectedDate);
  }, [entries, selectedDate, tab]);

  return (
    <div className="min-h-screen flex flex-col bg-background pb-24">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <h1 className="text-xl font-bold">
          {tab === 'calendar' ? 'カレンダー' : '日記'}
        </h1>
        <div className="flex items-center gap-1">
          {tab === 'list' && (
            <Button variant="ghost" size="icon" aria-label="検索">
              <Search className="w-5 h-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="テーマ切替">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="ログアウト"
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
            <StampCalendar
              entries={stamps}
              onDateSelect={setSelectedDate}
              selectedDate={selectedDate}
            />

            {/* Selected day header */}
            <div className="px-1 pt-2 text-sm text-muted-foreground">
              {format(selectedDate, 'yyyy年M月d日')}
              {entries.some((e) => isSameDay(parseISO(e.date), selectedDate))
                ? ''
                : ' （日記なし）'}
            </div>

            <DiaryListView entries={calendarListEntries} />
          </>
        ) : (
          <DiaryListView entries={entries} showSearch />
        )}
      </main>

      <ComposeFAB />
      <BottomTabBar homeTab={tab} onHomeTabChange={setTab} />
    </div>
  );
}
