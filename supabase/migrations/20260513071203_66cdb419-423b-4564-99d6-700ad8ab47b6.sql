ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

UPDATE public.expressions SET archived_at = COALESCE(archived_at, now()) WHERE status = 'archived' AND archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_expression_archived_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'archived' AND NEW.archived_at IS NULL THEN
      NEW.archived_at = now();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'archived' AND (OLD.status IS DISTINCT FROM 'archived') THEN
    NEW.archived_at = now();
  ELSIF NEW.status <> 'archived' THEN
    NEW.archived_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_expression_archived_at_trigger ON public.expressions;
CREATE TRIGGER set_expression_archived_at_trigger
BEFORE INSERT OR UPDATE ON public.expressions
FOR EACH ROW
EXECUTE FUNCTION public.set_expression_archived_at();

CREATE INDEX IF NOT EXISTS expressions_archived_at_idx ON public.expressions(archived_at) WHERE status = 'archived';