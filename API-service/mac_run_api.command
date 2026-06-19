#!/bin/bash
cd "$(dirname "$0")"

echo "=========================================================="
echo "🔍 1. 正在檢查 Ollama 環境..."
echo "=========================================================="
if command -v ollama &> /dev/null; then
    echo "✅ 偵測到 Ollama 已安裝！"
else
    echo "❌ 未偵測到 Ollama！正在透過官方一鍵指令為您自動安裝..."
    echo "📥 正在下載並執行 Ollama 安裝腳本，請稍候..."
    
    # 執行官方一鍵安裝
    curl -fsSL https://ollama.com/install.sh | sh
    
    # 再次檢查是否安裝成功
    if ! command -v ollama &> /dev/null; then
        echo "⚠️ 自動安裝可能需要權限，或遇到環境變數未更新的問題。"
        echo "🌐 請手動前往官網下載：https://ollama.com/download"
        exit 1
    fi
    echo "✅ Ollama 安裝成功！"
fi

# 確保 Ollama 服務已在背景啟動
if ! lsof -i :11434 &> /dev/null; then
    echo "⚙️ 正在啟動 Ollama 背景服務..."
    open -a "Ollama"
    sleep 5
fi

echo "=========================================================="
echo "📥 2. 正在檢查 Python 依賴套件..."
echo "=========================================================="
if [ -d "venv" ]; then
    source venv/bin/activate
fi
python3 -m pip install -r requirements.txt

echo "=========================================================="
echo "🚀 3. 正在啟動 本地 LLM API 伺服器 (Port: 8001)..."
echo "=========================================================="
# 確保 8001 沒有被舊程序佔用
lsof -ti :8001 | xargs kill -9 &> /dev/null
python3 -m uvicorn local_llm_api:app --host 0.0.0.0 --port 8001 &

# 等待 Port 8001 成功開啟
until lsof -i :8001 | grep -q "LISTEN"; do
    sleep 0.5
done
echo "✅ API 伺服器已成功就緒！"
echo "----------------------------------------------------------"
echo -e "\033[1;33m💡 模型下載提醒：\033[0m"
echo "   若您尚未下載模型，請開啟一個【新的終端機視窗】輸入："
echo -e "\033[1;36m   ollama pull <模型名稱> \033[0m (例如: ollama pull gemma4:12b)"
echo "----------------------------------------------------------"
echo "=========================================================="
echo "☁️ 4. 正在檢查/自動安裝 Cloudflare Tunnel..."
echo "=========================================================="

if ! command -v cloudflared &> /dev/null; then
    echo "⚠️ 未偵測到 cloudflared，正在透過 Homebrew 自動安裝..."
    
    # 檢查是否安裝了 brew，若無則先安裝 brew
    if ! command -v brew &> /dev/null; then
        echo "🍺 未發現 Homebrew，正在安裝 Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    brew install cloudflared
    echo "✅ Cloudflare 安裝完成！"
fi

echo "⏳ 正在產生臨時公網 URL..."
echo "----------------------------------------------------------"

# 啟動 cloudflared 並即時過濾出產生的 trycloudflare 網址
cloudflared tunnel --url http://127.0.0.1:8001 2>&1 | tee /tmp/cf_tunnel.log | grep --line-buffered -o 'https://[^ ]*\.trycloudflare\.com' | while read -r url; do
    echo -e "\033[1;32m🔥 您的本地大模型外網穿透網址已就緒！\033[0m"
    echo -e "\033[1;36m🔗 網址: $url \033[0m"
    echo "👉 請將此網址複製到網頁的 local_url 設定中。"
    echo "----------------------------------------------------------"
done

wait