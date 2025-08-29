#!/bin/bash
# Vercel環境変数設定スクリプト（改行コードを絶対に入れない）

echo "======================================"
echo "Vercel環境変数設定用の値を出力します"
echo "各値をコピーする際は改行を含めないでください"
echo "======================================"
echo ""

echo "1. NEXT_PUBLIC_SUPABASE_URL:"
echo -n "https://ubbmwemyibhffpqnlvql.supabase.co"
echo " ← ここまで（改行なし）"
echo ""

echo "2. NEXT_PUBLIC_SUPABASE_ANON_KEY:"
echo -n "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViYm13ZW15aWJoZmZwcW5sdnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzOTkxMzUsImV4cCI6MjA3MDOTc1MTM1fQ.pCyjwRWDabZ0kS1DtZH63wvc1Cr4bxMFdoM4NzAKsGk"
echo " ← ここまで（改行なし）"
echo ""

echo "3. SUPABASE_SERVICE_ROLE_KEY:"
echo -n "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViYm13ZW15aWJoZmZwcW5sdnFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTM5OTEzNSwiZXhwIjoyMDcwOTc1MTM1fQ.p65zS7ta4ctqCTe4VRnTu_Ofba2k8Ke1s_ApaP5wVmU"
echo " ← ここまで（改行なし）"
echo ""

echo "4. WEBHOOK_SECRET:"
echo -n "stem-separator-webhook-secret-2025"
echo " ← ここまで（改行なし）"
echo ""

echo "5. SUPABASE_STORAGE_BUCKET:"
echo -n "uploads"
echo " ← ここまで（改行なし）"
echo ""

echo "======================================"
echo "クリップボードにコピーする場合："
echo "======================================"
echo ""
echo "以下のコマンドを実行してください："
echo ""
echo "echo -n 'https://ubbmwemyibhffpqnlvql.supabase.co' | pbcopy"
echo "# NEXT_PUBLIC_SUPABASE_URLがクリップボードにコピーされました（改行なし）"
echo ""
echo "各値を個別にコピーして、Vercelに貼り付けてください"