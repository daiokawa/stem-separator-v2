-- Supabase Jobs Table Setup
-- Execute this in Supabase SQL Editor

-- 1. Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  stage text CHECK (stage IN ('preprocess', 'separate', 'postprocess', 'upload')),
  progress int NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  version int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  eta_sec int,
  files jsonb,
  error_code text,
  error_message text,
  error_retryable boolean,
  file_key text,
  file_size bigint,
  file_mime text
);

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS jobs_updated_at_idx ON public.jobs (updated_at DESC);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON public.jobs (status);

-- 3. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;

-- 4. Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Allow public SELECT (for Realtime subscription)
CREATE POLICY "jobs_select_public" ON public.jobs
  FOR SELECT TO anon
  USING (true);

-- Block public writes (service role bypasses RLS)
CREATE POLICY "jobs_block_writes_public" ON public.jobs
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);

-- 6. Optional: Clean up old jobs (7 days retention)
-- You can run this as a scheduled function
CREATE OR REPLACE FUNCTION cleanup_old_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.jobs
  WHERE updated_at < now() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a scheduled job for cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-old-jobs', '0 0 * * *', 'SELECT cleanup_old_jobs();');