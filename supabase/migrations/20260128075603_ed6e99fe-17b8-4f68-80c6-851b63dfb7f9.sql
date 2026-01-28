-- Add scene/context and part-of-speech/type columns to expressions table
ALTER TABLE public.expressions 
ADD COLUMN scene_or_context text,
ADD COLUMN pos_or_type text;

-- Add index for filtering by scene
CREATE INDEX idx_expressions_scene ON public.expressions(scene_or_context);

-- Add index for filtering by type
CREATE INDEX idx_expressions_type ON public.expressions(pos_or_type);