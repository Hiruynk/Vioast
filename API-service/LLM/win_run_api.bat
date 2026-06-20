@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==========================================================
echo 🔍 1. 正在檢查 Ollama 環境...
echo ==========================================================
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✅ 偵測到 Ollama 正在執行！
) else (
    echo ⚠️ 未偵測到 Ollama 正在執行，請手動啟動 Ollama 應用程式。
    echo 🌐 下載連結：https://ollama.com/download
)

echo ==========================================================
echo 📥 2. 正在檢查 Python 依賴套件...
echo ==========================================================
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)
python -m pip install -r requirements.txt

echo ==========================================================
echo 🚀 3. 正在啟動 本地 LLM API 伺服器 (Port: 8001)...
echo ==========================================================
:: 關閉佔用 8001 的程序
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8001"') do (
    taskkill /F /PID %%a >nul 2>&1
)

start /B python -m uvicorn local_llm_api:app --host 0.0.0.0 --port 8001

echo 等待伺服器啟動...
:wait_loop
timeout /t 2 >nul
netstat -aon | findstr ":8001" | findstr "LISTENING" >nul
if errorlevel 1 goto wait_loop

echo ✅ API 伺服器已成功就緒！
echo ----------------------------------------------------------
echo 💡 模型下載提醒：請開啟新視窗輸入：ollama pull ^<模型名稱^>
echo ----------------------------------------------------------

echo ==========================================================
echo ☁️ 4. 正在檢查/執行 Cloudflare Tunnel...
echo ==========================================================
where cloudflared >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️ 未偵測到 cloudflared，嘗試安裝...
    winget install --id Cloudflare.cloudflared --silent
    echo ✅ 安裝完成，請重新執行此腳本。
    pause
    exit
)

echo ⏳ 正在產生臨時公網 URL (請查看下方輸出的連結)...
echo ----------------------------------------------------------

:: 啟動並捕捉連結
for /f "tokens=*" %%a in ('cloudflared tunnel --url http://127.0.0.1:8001 2^>^&1 ^| findstr "trycloudflare.com"') do (
    echo 🔥 您的本地大模型外網穿透網址已就緒！
    echo 🔗 網址: %%a
    echo 👉 請將此網址複製到您的設定中。
)

pause