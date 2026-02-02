-- Add important_sentences column to diary_entries to store AI-selected practice sentences
ALTER TABLE public.diary_entries 
ADD COLUMN IF NOT EXISTS important_sentences jsonb DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.diary_entries.important_sentences IS 'Array of sentence objects selected by AI for focused practice. Each has: english, japanese, expressions[]';

-- Create a table to track instant composition practice attempts
CREATE TABLE IF NOT EXISTS public.instant_composition_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  diary_entry_id uuid NOT NULL REFERENCES public.diary_entries(id) ON DELETE CASCADE,
  sentence_index integer NOT NULL,
  user_answer text,
  meaning_grade text CHECK (meaning_grade IN ('excellent', 'good', 'needs_work')),
  structure_grade text CHECK (structure_grade IN ('excellent', 'good', 'needs_work')),
  fluency_grade text CHECK (fluency_grade IN ('excellent', 'good', 'needs_work')),
  passed boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instant_composition_attempts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can insert their own attempts"
ON public.instant_composition_attempts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own attempts"
ON public.instant_composition_attempts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own attempts"
ON public.instant_composition_attempts
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_instant_composition_user_diary 
ON public.instant_composition_attempts(user_id, diary_entry_id);

CREATE INDEX IF NOT EXISTS idx_instant_composition_created 
ON public.instant_composition_attempts(user_id, created_at DESC);