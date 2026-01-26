import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Brain, BookOpen, Sparkles, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StreakBadge } from '@/components/StreakBadge';
import { ActionCard } from '@/components/ActionCard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format, subDays, isToday } from 'date-fns';

export default function Home() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [todayComplete, setTodayComplete] = useState(false);
  const [yesterdayRecalled, setYesterdayRecalled] = useState(false);
  const [hasYesterdayDiary, setHasYesterdayDiary] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (profileData) {
      setProfile(profileData);
      // Check if today's diary is done
      if (profileData.last_diary_date) {
        setTodayComplete(isToday(new Date(profileData.last_diary_date)));
      }
    }

    // Check if yesterday has a diary entry
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const { data: yesterdayEntry } = await supabase
      .from('diary_entries')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', yesterday)
      .single();
    
    setHasYesterdayDiary(!!yesterdayEntry);

    // Check if recall was done today for yesterday
    if (yesterdayEntry) {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: recallData } = await supabase
        .from('recall_sessions')
        .select('completed')
        .eq('diary_entry_id', yesterdayEntry.id)
        .eq('completed', true)
        .gte('created_at', today)
        .single();
      
      setYesterdayRecalled(!!recallData);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Determine status message for recall
  const getRecallStatusMessage = () => {
    if (!hasYesterdayDiary) return null;
    if (yesterdayRecalled) return null;
    if (todayComplete) return "Next step: try the latest recall quiz!";
    return null;
  };

  // Determine if both tasks are complete
  const allDailyTasksDone = todayComplete && (!hasYesterdayDiary || yesterdayRecalled);

  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-muted-foreground">{getGreeting()}</p>
          <h1 className="text-2xl font-bold">
            {profile?.display_name || 'Friend'} ✨
          </h1>
        </div>
        
        <Button variant="ghost" size="icon" onClick={signOut}>
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      {/* Streak Badge */}
      <div className="mb-8">
        <StreakBadge 
          streak={profile?.current_streak || 0} 
          showMessage={true}
        />
      </div>

      {/* Completion message */}
      {allDailyTasksDone && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mb-6 text-center">
          <p className="text-sm text-primary font-medium">
            🎉 Great job! You did both today's diary and recall.
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

        {/* 2. Latest Recall Quiz - Secondary */}
        <ActionCard
          icon={<Brain className="w-8 h-8" />}
          title={yesterdayRecalled ? "Latest recalled ✓" : "Latest recall quiz"}
          description={
            !hasYesterdayDiary
              ? "No past diaries yet"
              : yesterdayRecalled
                ? "Excellent memory work today!"
                : "Practice recalling your most recent diary from memory."
          }
          onClick={() => navigate('/recall')}
          variant={yesterdayRecalled ? "accent" : hasYesterdayDiary ? "secondary" : "secondary"}
          badge={hasYesterdayDiary && !yesterdayRecalled && todayComplete ? "NEXT" : undefined}
          statusMessage={getRecallStatusMessage()}
          disabled={!hasYesterdayDiary}
        />

        {/* 3. Review Expressions */}
        <ActionCard
          icon={<Sparkles className="w-8 h-8" />}
          title="Review expressions"
          description="Practice useful phrases from your diaries"
          onClick={() => navigate('/expressions')}
          variant="secondary"
        />

        {/* 4. Calendar View */}
        <ActionCard
          icon={<BookOpen className="w-8 h-8" />}
          title="My diary collection"
          description="Browse all your past diary entries"
          onClick={() => navigate('/calendar')}
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
