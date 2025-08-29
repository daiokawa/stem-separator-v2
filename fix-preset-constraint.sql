-- 既存の制約を削除して、新しい制約を追加
-- Supabase SQL Editorで実行

-- 1. 現在のpreset制約を確認
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM 
  pg_constraint
WHERE 
  conrelid = 'jobs'::regclass
  AND contype = 'c'
  AND conname LIKE '%preset%';

-- 2. 制約を削除（制約名が'jobs_preset_check'の場合）
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_preset_check;

-- 3. 新しい制約を追加（一般的な値を許可）
ALTER TABLE jobs ADD CONSTRAINT jobs_preset_check 
CHECK (preset IN ('stem-2', 'stem-4', 'stem-5', 'karaoke', 'vocals', 'instrumental', '4stems', 'default'));

-- または、presetカラムを完全に自由にする
-- ALTER TABLE jobs ALTER COLUMN preset DROP NOT NULL;
-- ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_preset_check;