-- PostgRESTスキーマキャッシュをリロード
NOTIFY pgrst, 'reload schema';

-- カラムの存在確認
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema='public' 
  AND table_name='jobs' 
ORDER BY ordinal_position;