ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS generation_cost_usd DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS generation_cost_jpy INTEGER,
  ADD COLUMN IF NOT EXISTS generation_run_id TEXT,
  ADD COLUMN IF NOT EXISTS generation_pipeline_version TEXT,
  ADD COLUMN IF NOT EXISTS generation_model_summary TEXT;

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  operation TEXT NOT NULL,
  generation_run_id TEXT,
  pipeline_version TEXT
);

ALTER TABLE api_usage
  ADD COLUMN IF NOT EXISTS generation_run_id TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_version TEXT;

ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'api_usage'
      AND policyname = 'Allow select usage to everyone'
  ) THEN
    CREATE POLICY "Allow select usage to everyone"
      ON api_usage FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'api_usage'
      AND policyname = 'Allow insert usage with anon key'
  ) THEN
    CREATE POLICY "Allow insert usage with anon key"
      ON api_usage FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_api_usage_created_at
  ON api_usage(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_generation_run_id
  ON api_usage(generation_run_id);

CREATE INDEX IF NOT EXISTS idx_articles_generation_pipeline_version
  ON articles(generation_pipeline_version, created_at DESC);

UPDATE articles
SET generation_pipeline_version = 'legacy'
WHERE generation_pipeline_version IS NULL;
