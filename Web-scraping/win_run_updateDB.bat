@echo off
cd /d "%~dp0"

echo 📥 正在檢查並安裝 requirements.txt...
python -m pip install -r requirements.txt

echo 🚀 正在執行 bulidJson.py...
python bulidJson.py

echo 🚀 正在執行 bulidJson2.py...
python bulidJson2.py

echo ✅ 所有任務已完成！
pause
