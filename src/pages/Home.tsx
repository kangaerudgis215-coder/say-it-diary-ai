import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, BookOpen, Sparkles, LogOut, Shuffle, TrendingUp, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StreakBadge } from '@/components/StreakBadge';
import { ActionCard } from '@/components/ActionCard';
import { MasteredDiariesBadge } from '@/components/MasteredDiariesBadge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format, isToday } from 'date-fns';

export default function Home() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [todayComplete, setTodayComplete] = useState(false);
  const [hasPastDiaries, setHasPastDiaries] = useState(false);
  const [latestDiaryId, setLatestDiaryId] = useState<string | null>(null);
  const [latestDiaryDate, setLatestDiaryDate] = useState<string | null>(null);

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

    // Get the latest diary excluding today (for review button)
    const { data: latestEntry } = await supabase
      .from('diary_entries')
      .select('id, date')
      .eq('user_id', user.id)
      .lt('date', today)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestEntry) {
      setLatestDiaryId(latestEntry.id);
      setLatestDiaryDate(latestEntry.date);
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

  const handleReviewLatest = () => {
    if (latestDiaryId && latestDiaryDate) {
      navigate(`/review?diaryId=${latestDiaryId}&date=${latestDiaryDate}`);
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
        
        <Button variant="ghost" size="icon" onClick={async () => {
          await signOut();
          navigate('/auth');
        }}>
          <LogOut className="w-5 h-5" />
        </Button>
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

      {/* Completion message */}
      {todayComplete && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mb-6 text-center">
          <p className="text-sm text-primary font-medium">
            🎉 Great job! You completed today's diary.
          </p>
        </div>
      )}

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

        {/* 2. Latest Quiz - Review latest diary */}
        <ActionCard
          icon={<Brain className="w-8 h-8" />}
          title="Latest Quiz"
          description={
            latestDiaryId
              ? "Review your latest diary with cloze & full sentence practice"
              : "Write a diary first to unlock"
          }
          onClick={handleReviewLatest}
          variant={todayComplete ? "secondary" : "secondary"}
          badge={todayComplete && latestDiaryId ? "NEXT" : undefined}
          disabled={!latestDiaryId}
        />

        {/* 3. Expression Memory Game */}
        <ActionCard
           icon={<Shuffle className="w-8 h-8" />}
           title="Expression Memory Game"
           description="フレーズ神経衰弱 - Match Japanese ↔ English"
          onClick={() => navigate('/instant')}
          variant="secondary"
        />

        {/* 4. Review Expressions */}
        <ActionCard
          icon={<Sparkles className="w-8 h-8" />}
          title="My expressions"
          description="Browse and review phrases from your diaries"
          onClick={() => navigate('/expressions')}
          variant="secondary"
        />

        {/* 5. Calendar View */}
        <ActionCard
          icon={<BookOpen className="w-8 h-8" />}
          title="My diary collection"
          description="Browse all your past diary entries"
          onClick={() => navigate('/calendar')}
          variant="secondary"
        />

        {/* 6. Progress / Stats */}
        <ActionCard
          icon={<TrendingUp className="w-8 h-8" />}
          title="Progress"
          description="Track your spoken vocabulary growth"
          onClick={() => navigate('/progress')}
          variant="secondary"
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
