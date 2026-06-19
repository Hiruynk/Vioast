#!/bin/bash
cd "$(dirname "$0")"

# 1. 自動安裝套件
echo "📥 正在檢查並安裝 requirements.txt..."
python3 -m pip install -r requirements.txt

# 2. 執行第一個腳本
echo "🚀 正在執行 bulidJson.py..."
python3 bulidJson.py

# 3. 執行第二個腳本
echo "🚀 正在執行 bulidJson2.py..."
python3 bulidJson2.py

echo "✅ 所有任務已完成！"