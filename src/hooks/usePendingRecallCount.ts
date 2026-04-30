import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

/**
 * Returns the number of past diary entries (before today) whose
 * sentence-reorder review has not been completed yet. Used to drive
 * the badge on the Recall tab so users see they have pending review.
 */
export function usePendingRecallCount(refreshKey: number = 0) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { count: c } = await supabase
        .from('diary_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .lt('date', today)
        .eq('sentences_review_completed', false);
      if (!cancelled) setCount(c ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  return count;
}