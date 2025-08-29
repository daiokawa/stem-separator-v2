#!/bin/bash
# Suno非公開API探索スクリプト

echo "================================"
echo "Suno API Investigation"
echo "================================"

# 環境変数設定（テスト用）
export SUNO_API_KEY="your-suno-api-key-here"

# Node.jsでハックスクリプト実行
node suno-hack.js 2>&1 | tee suno-hack-results.log

echo ""
echo "================================"
echo "結果をsuno-hack-results.logに保存"
echo "================================"

# GitHub非公式ラッパーも調査
echo ""
echo "非公式ラッパー（gcui-art/suno-api）調査："
curl -s https://api.github.com/repos/gcui-art/suno-api | grep -E "description|stargazers_count"

# Redditコミュニティ検索（ブラウザで開く）
echo ""
echo "Redditで最新情報を確認："
echo "https://www.reddit.com/r/SunoAI/search/?q=stems%20api%20hack&sort=new"