-- 実際のpreset制約を確認
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM 
  pg_constraint
WHERE 
  conrelid = 'jobs'::regclass
  AND contype = 'c'
  AND conname = 'jobs_preset_check';

-- もしくは、jobsテーブルの全制約を確認
SELECT 
  conname,
  pg_get_constraintdef(oid) AS definition
FROM 
  pg_constraint
WHERE 
  conrelid = 'jobs'::regclass;

-- 実際のデータを確認（どんな値が入っているか）
SELECT DISTINCT preset 
FROM jobs 
WHERE preset IS NOT NULL
LIMIT 10;