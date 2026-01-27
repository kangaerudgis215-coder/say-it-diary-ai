import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export function MasteredDiariesBadge() {
  const { user } = useAuth();
  const [masteredCount, setMasteredCount] = useState(0);
  const [totalDiaries, setTotalDiaries] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMasteryStats();
    }
  }, [user]);

  const fetchMasteryStats = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Get all diary entries
      const { data: diaries } = await supabase
        .from('diary_entries')
        .select('id')
        .eq('user_id', user.id);

      if (!diaries || diaries.length === 0) {
        setTotalDiaries(0);
        setMasteredCount(0);
        setIsLoading(false);
        return;
      }

      setTotalDiaries(diaries.length);

      // For each diary, get the latest recall session score
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

        if (latestRecall && latestRecall.score !== null && latestRecall.score >= 90) {
          mastered++;
        }
      }

      setMasteredCount(mastered);
    } catch (error) {
      console.error('Error fetching mastery stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || totalDiaries === 0) {
    return null;
  }

  const progressPercentage = totalDiaries > 0 ? (masteredCount / totalDiaries) * 100 : 0;

  return (
    <div className="bg-card rounded-2xl p-4 border border-border">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-accent-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Past diaries mastered</p>
          <p className="text-2xl font-bold">
            {masteredCount} <span className="text-muted-foreground text-base font-normal">/ {totalDiaries}</span>
          </p>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      
      <p className="text-xs text-muted-foreground mt-2">
        Diaries with 90%+ recall accuracy on the latest attempt.
      </p>
    </div>
  );
}
