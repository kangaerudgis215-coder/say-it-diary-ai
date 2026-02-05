-- Canonical per-sentence records for stable practice generation
-- Each row represents one diary sentence and the key expressions that belong to it.

CREATE TABLE IF NOT EXISTS public.diary_sentences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  diary_entry_id uuid NOT NULL,
  sentence_index integer NOT NULL,
  english_sentence text NOT NULL,
  japanese_sentence text NOT NULL DEFAULT '',
  key_expressions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diary_sentences_sentence_index_nonneg CHECK (sentence_index >= 0)
);

-- One canonical row per sentence index per diary
CREATE UNIQUE INDEX IF NOT EXISTS diary_sentences_diary_sentence_idx
  ON public.diary_sentences (diary_entry_id, sentence_index);

CREATE INDEX IF NOT EXISTS diary_sentences_user_id_idx
  ON public.diary_sentences (user_id);

CREATE INDEX IF NOT EXISTS diary_sentences_diary_entry_id_idx
  ON public.diary_sentences (diary_entry_id);

ALTER TABLE public.diary_sentences ENABLE ROW LEVEL SECURITY;

-- Timestamp helper (safe to replace)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS diary_sentences_set_updated_at ON public.diary_sentences;
CREATE TRIGGER diary_sentences_set_updated_at
BEFORE UPDATE ON public.diary_sentences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies
DROP POLICY IF EXISTS "Users can view their own diary sentences" ON public.diary_sentences;
CREATE POLICY "Users can view their own diary sentences"
ON public.diary_sentences
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own diary sentences" ON public.diary_sentences;
CREATE POLICY "Users can insert their own diary sentences"
ON public.diary_sentences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own diary sentences" ON public.diary_sentences;
CREATE POLICY "Users can update their own diary sentences"
ON public.diary_sentences
FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own diary sentences" ON public.diary_sentences;
CREATE POLICY "Users can delete their own diary sentences"
ON public.diary_sentences
FOR DELETE
USING (auth.uid() = user_id);
