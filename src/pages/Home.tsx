import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, BookOpen, Sparkles, LogOut, Shuffle, TrendingUp, Brain, Crown, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StreakBadge } from '@/components/StreakBadge';
import { ActionCard } from '@/components/ActionCard';
import { MasteredDiariesBadge } from '@/components/MasteredDiariesBadge';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/lib/supabase';
import { format, isToday } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'react-router-dom';

export default function Home() {
  const { user, signOut } = useAuth();
  const { isPro, plan, checkSubscription, openPortal } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
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

  // Handle checkout return
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      toast({ title: 'Proプランへようこそ！🎉', description: 'すべての機能が使えるようになりました。' });
      checkSubscription();
      // Clean URL
      window.history.replaceState({}, '', '/');
    } else if (checkout === 'cancel') {
      window.history.replaceState({}, '', '/');
    }
  }, [searchParams]);

  const fetchUserData = async () => {
    if (!user) return;

    const today = format(new Date(), 'yyyy-MM-dd');

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

    const { data: latestEntry } = await supabase
      .from('diary_entries')
      .select('id, date')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestEntry) {
      setLatestDiaryId(latestEntry.id);
      setLatestDiaryDate(latestEntry.date);
    }

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
          <h1 className="text-2xl font-bold">
            {profile?.display_name || 'Friend'} ✨
          </h1>
        </div>
        
        <div className="flex items-center gap-1">
          {isPro && (
            <Button variant="ghost" size="icon" onClick={openPortal} title="Manage subscription">
              <Settings className="w-5 h-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Plan badge */}
      {isPro ? (
        <div className="mb-4 flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full w-fit">
          <Crown className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-medium text-amber-600">Pro</span>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="mb-4 w-fit gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
          onClick={() => navigate('/upgrade')}
        >
          <Crown className="w-4 h-4" />
          Proにアップグレード
        </Button>
      )}

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

        <ActionCard
          icon={<Brain className="w-8 h-8" />}
          title="Latest Quiz"
          description={
            latestDiaryId
              ? "Review your latest diary with cloze & full sentence practice"
              : "Write a diary first to unlock"
          }
          onClick={handleReviewLatest}
          variant="secondary"
          badge={todayComplete && latestDiaryId ? "NEXT" : undefined}
          disabled={!latestDiaryId}
        />

        <ActionCard
          icon={<Shuffle className="w-8 h-8" />}
          title="Expression Memory Game"
          description={isPro ? "フレーズ神経衰弱 - Match Japanese ↔ English" : "Pro限定 - フレーズ神経衰弱"}
          onClick={() => isPro ? navigate('/instant') : navigate('/upgrade')}
          variant="secondary"
          badge={!isPro ? "PRO" : undefined}
        />

        <ActionCard
          icon={<Sparkles className="w-8 h-8" />}
          title="My expressions"
          description="Browse and review phrases from your diaries"
          onClick={() => navigate('/expressions')}
          variant="secondary"
        />

        <ActionCard
          icon={<BookOpen className="w-8 h-8" />}
          title="My diary collection"
          description="Browse all your past diary entries"
          onClick={() => navigate('/calendar')}
          variant="secondary"
        />

        <ActionCard
          icon={<TrendingUp className="w-8 h-8" />}
          title="Progress"
          description={isPro ? "Track your spoken vocabulary growth" : "Pro限定 - 語彙成長の統計"}
          onClick={() => isPro ? navigate('/progress') : navigate('/upgrade')}
          variant="secondary"
          badge={!isPro ? "PRO" : undefined}
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
