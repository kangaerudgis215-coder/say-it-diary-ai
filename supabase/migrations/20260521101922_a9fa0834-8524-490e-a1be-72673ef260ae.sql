ALTER TABLE public.conversations
DROP CONSTRAINT IF EXISTS conversations_user_id_date_key;

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_user_id_date_mode_key UNIQUE (user_id, date, mode);