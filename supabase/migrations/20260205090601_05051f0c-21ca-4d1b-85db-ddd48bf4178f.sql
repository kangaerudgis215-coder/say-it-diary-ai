-- Create table for tracking daily spoken vocabulary
CREATE TABLE public.spoken_vocabulary_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  word_count INTEGER NOT NULL DEFAULT 0,
  unique_words TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.spoken_vocabulary_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own vocabulary logs"
ON public.spoken_vocabulary_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vocabulary logs"
ON public.spoken_vocabulary_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vocabulary logs"
ON public.spoken_vocabulary_logs
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_spoken_vocabulary_user_date ON public.spoken_vocabulary_logs(user_id, date DESC);