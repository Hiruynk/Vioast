@echo off
:: 強制使用 UTF-8 編碼，防止在不同語言/地區設定的 Windows 系統下出現亂碼
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==========================================================
echo 📥 1. 正在檢查 Python 虛擬環境與依賴套件...
echo ==========================================================
:: 智慧偵測並啟用虛擬環境 (如果有的話)
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    echo ✅ 已成功啟用本地 venv 虛擬環境。
)

python -m pip install -r requirements.txt

echo ==========================================================
echo 🚀 2. 正在啟動 Web 對話伺服器 (Port: 8000)...
echo ==========================================================
:: 【核心防禦】檢查並強制關閉任何佔用 Port 8000 的殘留程序，防止啟動衝突
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: 【核心修正】改用 python -m uvicorn 呼叫，確保 100% 找得到指令，不依賴全域環境變數
start "" python -m uvicorn chatBot_local:app --host 0.0.0.0 --port 8000 --reload

echo ⏳ 等待對話伺服器就緒 (Port 8000)...

:wait_loop
timeout /t 1 >nul
netstat -aon | findstr ":8000" | findstr "LISTENING" >nul
if %errorlevel% neq 0 (
    <nul set /p =.
    goto wait_loop
)

echo.
echo ✅ 伺服器已成功就緒！正在自動開啟網頁瀏覽器...
echo ----------------------------------------------------------
start "" http://localhost:8000

echo 📌 提示：關閉此視窗或按下任意鍵將終止本地對話伺服器。
echo ----------------------------------------------------------
pause

:: 當用戶關閉視窗或按鍵結束時，自動將剛才啟動的 8000 埠程序徹底殺掉，不留背景垃圾
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
endlocal