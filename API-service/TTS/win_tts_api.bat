@echo off
chcp 65001 >nul
echo 正在啟動 TTS-API 伺服器 (Windows)...

runtime\python.exe local_tts_api.py

pause