@echo off
cd /d "%~dp0"

echo 檢查並安裝套件...
python -m pip install -r requirements.txt

:: 啟動伺服器
start "" uvicorn chatBot_local:app --host 0.0.0.0 --port 8000 --reload

echo ⏳ 等待伺服器 Port 8000 開啟...

:wait_loop
:: 檢查 port 8000 是否處於 LISTENING 狀態
netstat -ano | findstr :8000 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    timeout /t 1 >nul
    goto wait_loop
)

echo ✅ 伺服器已就緒，開啟網頁！
start "" http://localhost:8000

pause