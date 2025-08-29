# ⚠️ Vercel環境変数設定 - 絶対に改行コードを入れない ⚠️

## 設定する環境変数（値のみ、改行なし）

### 1. NEXT_PUBLIC_SUPABASE_URL
```
https://ubbmwemyibhffpqnlvql.supabase.co
```

### 2. NEXT_PUBLIC_SUPABASE_ANON_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViYm13ZW15aWJoZmZwcW5sdnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzOTkxMzUsImV4cCI6MjA3MDOTc1MTM1fQ.pCyjwRWDabZ0kS1DtZH63wvc1Cr4bxMFdoM4NzAKsGk
```

### 3. SUPABASE_SERVICE_ROLE_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViYm13ZW15aWJoZmZwcW5sdnFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTM5OTEzNSwiZXhwIjoyMDcwOTc1MTM1fQ.p65zS7ta4ctqCTe4VRnTu_Ofba2k8Ke1s_ApaP5wVmU
```

### 4. WEBHOOK_SECRET
```
stem-separator-webhook-secret-2025
```

### 5. SUPABASE_STORAGE_BUCKET
```
uploads
```

## 🔴 重要：コピー方法

1. 値の最初から最後まで選択（改行を含めない）
2. Command+C でコピー
3. Vercelの環境変数入力欄にペースト
4. **必ず最後にBackspaceを1回押す**（念のため）

## ❌ やってはいけないこと
- .envファイルから行全体をコピー
- 値の後ろの空白や改行を含めてコピー
- 複数行をまとめてコピー

## ✅ 確認方法（Vercel側）
環境変数を設定後、値の最後にカーソルを置いて右矢印キーを押す。
カーソルが動かなければOK。動いたら改行が入っている。