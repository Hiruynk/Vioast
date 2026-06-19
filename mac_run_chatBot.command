#!/bin/bash
cd "$(dirname "$0")"

# 1. 自動檢查並安裝
python3 -m pip install -r requirements.txt

# 2. 啟動伺服器 (背景執行)
python3 -m uvicorn chatBot_local:app --host 0.0.0.0 --port 8000 --reload &

echo "⏳ 等待伺服器 Port 8000 開啟..."

# 3. 循環檢查 Port 是否已就緒
# lsof 會回傳 0 代表 port 已被佔用（即伺服器已啟動）
until lsof -i :8000 | grep -q "LISTEN"; do
    echo "  等待中..."
    sleep 1
done

echo "✅ 伺服器已就緒，開啟網頁！"
open -a "Google Chrome" "http://localhost:8000" || open "http://localhost:8000"

wait