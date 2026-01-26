-- Add score and used_expressions columns to recall_sessions table
ALTER TABLE public.recall_sessions 
ADD COLUMN IF NOT EXISTS score integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS used_expressions text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS missed_expressions text[] DEFAULT '{}';