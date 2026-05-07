DO $$
DECLARE
  job_record record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_cron'
  ) THEN
    FOR job_record IN
      SELECT jobid
      FROM cron.job
      WHERE command ILIKE '%send-push-notifications%'
         OR jobname ILIKE '%push%'
         OR jobname ILIKE '%notification%'
    LOOP
      PERFORM cron.unschedule(job_record.jobid);
    END LOOP;
  END IF;
END $$;

DROP TABLE IF EXISTS public.push_subscriptions CASCADE;