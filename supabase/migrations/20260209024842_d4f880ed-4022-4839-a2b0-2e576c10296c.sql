
-- Add completion flags to diary_entries
ALTER TABLE public.diary_entries 
ADD COLUMN IF NOT EXISTS sentences_review_completed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS full_diary_challenge_completed boolean NOT NULL DEFAULT false;

-- Create full_diary_attempts table for logging each challenge attempt
CREATE TABLE public.full_diary_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  diary_entry_id uuid NOT NULL REFERENCES public.diary_entries(id),
  used_expressions_count integer NOT NULL DEFAULT 0,
  total_expressions_count integer NOT NULL DEFAULT 0,
  rating text NOT NULL DEFAULT 'needs_work', -- 'great', 'good', 'needs_work'
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.full_diary_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own attempts" ON public.full_diary_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own attempts" ON public.full_diary_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
