import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

/**
 * Returns the number of diary entries that are READY for recall but have NOT
 * been recalled yet.
 *
 *   ready for recall = `sentences_review_completed = true` (the user finished
 *                       at least the reorder quiz once)
 *   recalled         = a row exists in `recall_sessions` with completed=true
 *
 * This is the single source of truth for the Recall tab badge and the
 * pending recall list.
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
      // 1. All diaries that finished reorder (ready for recall)
      const { data: ready } = await supabase
        .from('diary_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('sentences_review_completed', true);
      const readyIds = (ready || []).map((d: any) => d.id);
      if (readyIds.length === 0) {
        if (!cancelled) setCount(0);
        return;
      }

      // 2. Which of those already have a completed recall session
      const { data: completed } = await supabase
        .from('recall_sessions')
        .select('diary_entry_id')
        .eq('user_id', user.id)
        .eq('completed', true)
        .in('diary_entry_id', readyIds);
      const completedSet = new Set((completed || []).map((r: any) => r.diary_entry_id));

      const pending = readyIds.filter((id) => !completedSet.has(id)).length;
      if (!cancelled) setCount(pending);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  return count;
}