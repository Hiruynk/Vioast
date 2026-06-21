@echo off
:: 強制使用 UTF-8 編碼，防止在不同語言/地區設定的 Windows 系統下出現亂碼
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==========================================================
echo 🔍 1. 正在檢查 Ollama 環境...
echo ==========================================================
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe" >NUL
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
:: 強制釋放 Port 8001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8001" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

start /B python -m uvicorn local_llm_api:app --host 0.0.0.0 --port 8001

echo 等待 Python API 伺服器啟動...
:wait_loop
timeout /t 2 >nul
netstat -aon | findstr ":8001" | findstr "LISTENING" >nul
if errorlevel 1 goto wait_loop

echo ✅ API 伺服器已成功就緒！

echo ==========================================================
echo ☁️ 4. 正在檢查/執行 Cloudflare Tunnel...
echo ==========================================================
where cloudflared >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️ 未偵測到 cloudflared，嘗試透過 winget 自動安裝...
    winget install --id Cloudflare.cloudflared --silent
    if %errorlevel% neq 0 (
        echo ❌ winget 安裝失敗，請手動下載 cloudflared 並加入環境變數：https://github.com/cloudflare/cloudflared/releases
        pause
        exit
    )
    echo ✅ 安裝完成，請重新執行此腳本！
    pause
    exit
)

echo ⏳ 正在透過 Cloudflare 產生臨時公網 URL...
echo ----------------------------------------------------------

:: 【核心修正】定義臨時 Log 檔案路徑
set "TUNNEL_LOG=%TEMP%\cf_tunnel_%RANDOM%.log"
if exist "!TUNNEL_LOG!" del /f /q "!TUNNEL_LOG!"

:: 【核心修正】使用 start /B 將 tunnel 丟到背景執行，並重定向錯誤輸出(2>) 到暫存檔
start /B cloudflared tunnel --url http://127.0.0.1:8001 >nul 2>"!TUNNEL_LOG!"

:: 【核心修正】動態監聽暫存檔，直到抓到 trycloudflare.com 網址為止（最多等待 15 秒）
set /a count=0
:loop_check_url
timeout /t 1 >nul
set /a count+=1

:: 檢查日誌中是否已出現網址
findstr "trycloudflare.com" "!TUNNEL_LOG!" >nul
if %errorlevel%==0 (
    echo.
    echo 🔥 您的本地大模型外網穿透網址已就緒！
    echo ----------------------------------------------------------
    :: 提取並單獨列印出網址
    for /f "tokens=4" %%i in ('findstr "trycloudflare.com" "!TUNNEL_LOG!"') do (
        set "RAW_URL=%%i"
        :: 拔除可能夾帶的前後引號或空白
        set "RAW_URL=!RAW_URL:"=!"
        echo 🔗 網址: !RAW_URL!
    )
    echo ----------------------------------------------------------
    echo 👉 請將上方 https 的網址複製到網頁側邊欄設定中。
    goto tunnel_end
)

if !count! gtr 15 (
    echo.
    echo ❌ Tunnel 啟動超時或失敗。請手動檢查暫存檔記錄：
    echo 路徑: !TUNNEL_LOG!
    goto tunnel_end
)

<nul set /p =.
goto loop_check_url

:tunnel_end
echo.
echo 💡 模型下載提醒：請開啟新視窗輸入：ollama pull ^<模型名稱^>
echo 📌 提示：關閉此視窗將自動終止 API 伺服器與外網穿透隧道。
echo ----------------------------------------------------------
pause

:: 當用戶按下任意鍵關閉視窗時，自動清理背景程序與臨時檔案
taskkill /F /IM cloudflared.exe >nul 2>&1
if exist "!TUNNEL_LOG!" del /f /q "!TUNNEL_LOG!"
endlocal