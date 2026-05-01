import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

/**
 * Returns the number of past diary entries (date < today) whose recall has
 * NOT been completed yet. "Recall completed" = a row exists in
 * `recall_sessions` with completed=true for that diary.
 *
 * This is the single source of truth for the Recall tab badge, the pending
 * list, and the calendar/list "kira-kira" badge.
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

      // 1. All past diary ids
      const { data: pastDiaries } = await supabase
        .from('diary_entries')
        .select('id')
        .eq('user_id', user.id)
        .lt('date', today);
      const pastIds = (pastDiaries || []).map((d: any) => d.id);
      if (pastIds.length === 0) {
        if (!cancelled) setCount(0);
        return;
      }

      // 2. Which of those already have a completed recall session
      const { data: completed } = await supabase
        .from('recall_sessions')
        .select('diary_entry_id')
        .eq('user_id', user.id)
        .eq('completed', true)
        .in('diary_entry_id', pastIds);
      const completedSet = new Set((completed || []).map((r: any) => r.diary_entry_id));

      const pending = pastIds.filter((id) => !completedSet.has(id)).length;
      if (!cancelled) setCount(pending);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  return count;
}