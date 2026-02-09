
-- Add new columns to expressions table
ALTER TABLE public.expressions 
ADD COLUMN IF NOT EXISTS last_reviewed_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS correct_streak integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_expressions_status ON public.expressions (status);
CREATE INDEX IF NOT EXISTS idx_expressions_created_at ON public.expressions (created_at);
CREATE INDEX IF NOT EXISTS idx_expressions_last_reviewed_at ON public.expressions (last_reviewed_at);
CREATE INDEX IF NOT EXISTS idx_expressions_user_status ON public.expressions (user_id, status);
