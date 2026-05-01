
-- 1. Delete duplicates: keep oldest completed row per (user_id, diary_entry_id)
DELETE FROM public.recall_sessions rs
USING public.recall_sessions rs2
WHERE rs.user_id = rs2.user_id
  AND rs.diary_entry_id = rs2.diary_entry_id
  AND rs.completed = true
  AND rs2.completed = true
  AND rs.created_at > rs2.created_at;

-- 2. Delete recall_sessions linked to diaries dated today or in the future
DELETE FROM public.recall_sessions rs
USING public.diary_entries de
WHERE rs.diary_entry_id = de.id
  AND de.date >= CURRENT_DATE;

-- 3. Add uniqueness so we cannot insert duplicate completed rows in the future
CREATE UNIQUE INDEX IF NOT EXISTS recall_sessions_unique_completed
  ON public.recall_sessions (user_id, diary_entry_id)
  WHERE completed = true;
