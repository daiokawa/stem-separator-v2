-- Supabase Storage Bucket作成用SQL
-- Supabase ダッシュボード > SQL Editor で実行してください

-- バケット作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- RLSポリシー設定（誰でもアップロード可能）
CREATE POLICY "Allow public uploads" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'uploads');

-- RLSポリシー設定（誰でも読み取り可能）
CREATE POLICY "Allow public read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'uploads');

-- 確認
SELECT * FROM storage.buckets WHERE id = 'uploads';