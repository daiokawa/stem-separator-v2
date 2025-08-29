-- jobsテーブル作成
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  preset TEXT DEFAULT 'htdemucs',
  metadata JSONB,
  error JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- RLS無効化（開発用）
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- 全アクセス許可ポリシー
CREATE POLICY "Allow all operations" ON jobs
  FOR ALL USING (true) WITH CHECK (true);