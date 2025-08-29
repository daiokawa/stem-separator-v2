-- preset制約の確認
SELECT 
  constraint_name,
  check_clause
FROM 
  information_schema.check_constraints
WHERE 
  constraint_name LIKE '%preset%';

-- テーブルの全制約確認
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM 
  pg_constraint
WHERE 
  conrelid = 'jobs'::regclass
  AND contype = 'c';  -- CHECK制約

-- presetカラムの詳細確認
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM 
  information_schema.columns
WHERE 
  table_name = 'jobs' 
  AND column_name = 'preset';