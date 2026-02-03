import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Brain, Zap, Flame, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { InsightCard } from '@/components/InsightCard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Home() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [todayComplete, setTodayComplete] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [totalDiaries, setTotalDiaries] = useState(0);

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
      .maybeSingle();
    
    if (profileData) {
      setProfile(profileData);
      if (profileData.last_diary_date) {
        setTodayComplete(isToday(new Date(profileData.last_diary_date)));
      }
    }

    // Fetch mastery stats
    const { data: diaries } = await supabase
      .from('diary_entries')
      .select('id')
      .eq('user_id', user.id);

    if (diaries) {
      setTotalDiaries(diaries.length);
      
      let mastered = 0;
      for (const diary of diaries) {
        const { data: latestRecall } = await supabase
          .from('recall_sessions')
          .select('score')
          .eq('diary_entry_id', diary.id)
          .eq('completed', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestRecall?.score && latestRecall.score >= 90) {
          mastered++;
        }
      }
      setMasteredCount(mastered);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const streak = profile?.current_streak || 0;

  return (
    <div className="min-h-screen flex flex-col pb-nav">
      {/* Header */}
      <header className="px-6 pt-8 pb-4">
        <p className="text-muted-foreground text-sm">{getGreeting()}</p>
        <h1 className="text-2xl font-bold mt-1">
          Ready to record your day? ✨
        </h1>
      </header>

      {/* Stats Row */}
      <div className="px-6 mb-6">
        <div className="flex gap-3">
          {/* Streak Badge */}
          <div className="card-elevated flex-1 p-3 flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              streak > 0 ? "bg-primary/20" : "bg-muted"
            )}>
              <Flame className={cn("w-5 h-5", streak > 0 ? "text-primary" : "text-muted-foreground")} />
            </div>
            <div>
              <p className="text-2xl font-bold">{streak}</p>
              <p className="text-xs text-muted-foreground">day streak</p>
            </div>
          </div>

          {/* Mastered Badge */}
          {totalDiaries > 0 && (
            <div className="card-elevated flex-1 p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{masteredCount}<span className="text-base font-normal text-muted-foreground">/{totalDiaries}</span></p>
                <p className="text-xs text-muted-foreground">mastered</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center Mic Button */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <button
          onClick={() => navigate('/chat')}
          className={cn(
            "btn-circle-lg mb-4",
            todayComplete && "bg-accent"
          )}
        >
          <Mic className="w-10 h-10" />
        </button>
        <p className="text-lg font-semibold text-center mb-1">
          {todayComplete ? "Today's diary ✓" : "Tap to start"}
        </p>
        <p className="text-sm text-muted-foreground text-center">
          {todayComplete 
            ? "Great job! You've completed today's entry."
            : "Tell me about your day in English"
          }
        </p>
      </div>

      {/* Insight Card */}
      <div className="px-6 mb-6">
        <InsightCard />
      </div>

      {/* Quick Actions */}
      <div className="px-6 mb-8">
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1 h-auto py-3 flex-col gap-1"
            onClick={() => navigate('/recall')}
          >
            <Brain className="w-5 h-5" />
            <span className="text-xs">Recall Quiz</span>
          </Button>
          <Button
            variant="secondary"
            className="flex-1 h-auto py-3 flex-col gap-1"
            onClick={() => navigate('/instant')}
          >
            <Zap className="w-5 h-5" />
            <span className="text-xs">Instant English</span>
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
