
-- Add plan field to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- Add stripe_customer_id for linking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Create index on plan for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON public.profiles(plan);
