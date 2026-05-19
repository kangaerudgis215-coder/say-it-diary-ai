import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

/**
 * Returns the number of diary entries whose reorder quiz has NOT been
 * completed yet. Completing the reorder quiz once = recall done forever.
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
      const { count: pending } = await supabase
        .from('diary_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('sentences_review_completed', false);
      if (!cancelled) setCount(pending ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  return count;
}