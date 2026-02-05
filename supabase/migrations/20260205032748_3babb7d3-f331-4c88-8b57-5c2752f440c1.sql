-- Add is_user_added column to expressions table
ALTER TABLE public.expressions 
ADD COLUMN is_user_added BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.expressions.is_user_added IS 'True if expression was manually added by user, false if AI-extracted';