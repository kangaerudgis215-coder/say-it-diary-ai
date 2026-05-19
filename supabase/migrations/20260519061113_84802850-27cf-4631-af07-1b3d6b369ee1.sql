ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'chat';
CREATE INDEX IF NOT EXISTS idx_conversations_user_date_mode ON public.conversations(user_id, date, mode);