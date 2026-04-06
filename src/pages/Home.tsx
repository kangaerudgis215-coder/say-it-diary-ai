import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, BookOpen, Sparkles, LogOut, Shuffle, TrendingUp, Brain, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StreakBadge } from '@/components/StreakBadge';
import { ActionCard } from '@/components/ActionCard';
import { MasteredDiariesBadge } from '@/components/MasteredDiariesBadge';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/ThemeProvider';
import { supabase } from '@/lib/supabase';
import { format, isToday, startOfDay } from 'date-fns';

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [todayComplete, setTodayComplete] = useState(false);
  const [hasPastDiaries, setHasPastDiaries] = useState(false);
  const [latestDiaryId, setLatestDiaryId] = useState<string | null>(null);
  const [latestDiaryDate, setLatestDiaryDate] = useState<string | null>(null);
  const [latestDiaryReviewed, setLatestDiaryReviewed] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    const today = format(new Date(), 'yyyy-MM-dd');

    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (profileData) {
      setProfile(profileData);
      // Check if today's diary is done
      if (profileData.last_diary_date) {
        setTodayComplete(isToday(new Date(profileData.last_diary_date)));
      }
    }

    // Get the latest diary entry (including today) for Recent Recall
    const { data: latestEntry } = await supabase
      .from('diary_entries')
      .select('id, date, sentences_review_completed')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestEntry) {
      setLatestDiaryId(latestEntry.id);
      setLatestDiaryDate(latestEntry.date);
      setLatestDiaryReviewed(latestEntry.sentences_review_completed ?? false);
    } else {
      setLatestDiaryId(null);
      setLatestDiaryDate(null);
      setLatestDiaryReviewed(false);
    }

    // Check if there are any past diary entries (before today)
    const { data: pastEntries } = await supabase
      .from('diary_entries')
      .select('id, date')
      .eq('user_id', user.id)
      .lt('date', today)
      .order('date', { ascending: false })
      .limit(1);
    
    setHasPastDiaries(!!(pastEntries && pastEntries.length > 0));
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Recent Recall: only enabled if latest diary is from a previous day AND not yet reviewed
  const isLatestDiaryFromToday = latestDiaryDate ? isToday(new Date(latestDiaryDate + 'T00:00:00')) : false;
  const canDoRecall = !!latestDiaryId && !isLatestDiaryFromToday && !latestDiaryReviewed;

  // Progress: step 1 = today's diary, step 2 = recall review of previous diary
  const todayStepDone = todayComplete;
  const recallStepDone = latestDiaryReviewed;
  const stepsCompleted = (todayStepDone ? 1 : 0) + (recallStepDone ? 1 : 0);

  const handleReviewLatest = () => {
    if (canDoRecall && latestDiaryId) {
      navigate(`/quiz?diaryId=${latestDiaryId}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-muted-foreground">{getGreeting()}</p>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">
              {profile?.display_name || 'Friend'} ✨
            </h1>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary font-semibold tracking-wider">
              BETA
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={async () => {
            await signOut();
            navigate('/auth');
          }}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Streak Badge */}
      <div className="mb-4">
        <StreakBadge 
          streak={profile?.current_streak || 0} 
          showMessage={true}
        />
      </div>

      {/* Mastered Diaries Badge */}
      <div className="mb-6">
        <MasteredDiariesBadge />
      </div>

      {/* Daily progress indicator */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-foreground">今日の進捗</p>
          <span className="text-sm font-bold text-primary">{stepsCompleted} / 2</span>
        </div>
        <div className="flex gap-2">
          <div className={`flex-1 h-2 rounded-full transition-colors ${todayStepDone ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`flex-1 h-2 rounded-full transition-colors ${recallStepDone ? 'bg-primary' : 'bg-muted'}`} />
        </div>
        <div className="flex gap-2 mt-1">
          <p className="flex-1 text-[10px] text-muted-foreground text-center">
            {todayStepDone ? '✅ 日記' : '📝 日記'}
          </p>
          <p className="flex-1 text-[10px] text-muted-foreground text-center">
            {recallStepDone ? '✅ 復習' : '🧠 復習'}
          </p>
        </div>
      </div>

      {/* Main Actions */}
      <div className="space-y-4 flex-1">
        {/* 1. Today's Diary - Primary action */}
        <ActionCard
          icon={<Mic className="w-8 h-8" />}
          title={todayComplete ? "Today's diary ✓" : "Start today's diary"}
          description={todayComplete 
            ? "Great job! You've completed today's entry."
            : "Tell me about your day in English"
          }
          onClick={() => navigate('/chat')}
          variant="primary"
          badge={!todayComplete ? "MUST" : undefined}
        />

        {/* 2. Recent Recall - Next-day review only */}
        <ActionCard
          icon={<Brain className="w-8 h-8" />}
          title={latestDiaryReviewed && !isLatestDiaryFromToday ? "Recent Recall ✓" : "Recent Recall"}
          description={
            latestDiaryReviewed && !isLatestDiaryFromToday
              ? "✅ 復習完了！よく頑張りました！"
              : canDoRecall
                ? "前回の日記を並び替えで復習しよう"
                : isLatestDiaryFromToday
                  ? "🌙 明日また挑戦してね！"
                  : "まず日記を書こう"
          }
          onClick={handleReviewLatest}
          variant="secondary"
          badge={canDoRecall ? "NEXT" : latestDiaryReviewed && !isLatestDiaryFromToday ? "DONE" : undefined}
          disabled={!canDoRecall}
          hoverColor="hsl(220, 90%, 56%)"
        />

        {/* 3. Expression Memory Game */}
        <ActionCard
           icon={<Shuffle className="w-8 h-8" />}
           title="Expression Memory Game"
           description="フレーズ神経衰弱 - Match Japanese ↔ English"
          onClick={() => navigate('/instant')}
          variant="secondary"
          hoverColor="hsl(150, 80%, 45%)"
        />

        {/* 4. Review Expressions */}
        <ActionCard
          icon={<Sparkles className="w-8 h-8" />}
          title="My expressions"
          description="Browse and review phrases from your diaries"
          onClick={() => navigate('/expressions')}
          variant="secondary"
          hoverColor="hsl(280, 80%, 60%)"
        />

        {/* 5. Calendar View */}
        <ActionCard
          icon={<BookOpen className="w-8 h-8" />}
          title="My diary collection"
          description="Browse all your past diary entries"
          onClick={() => navigate('/calendar')}
          variant="secondary"
          hoverColor="hsl(340, 80%, 55%)"
        />

        {/* 6. Progress / Stats */}
        <ActionCard
          icon={<TrendingUp className="w-8 h-8" />}
          title="Progress"
          description="Track your spoken vocabulary growth"
          onClick={() => navigate('/progress')}
          variant="secondary"
          hoverColor="hsl(180, 70%, 45%)"
        />
      </div>

      {/* Footer encouragement */}
      <div className="mt-8 text-center">
        <p className="text-xs text-muted-foreground">
          Every day you show up is a step forward 💪
        </p>
      </div>
    </div>
  );
}
