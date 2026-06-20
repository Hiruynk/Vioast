#!/bin/bash
echo "開始設定並啟動 TTS-API 伺服器 (Mac)..."

# 1. 創建虛擬環境
python3 -m venv .venv 

# 2. 啟用虛擬環境
source .venv/bin/activate 

# 3. 下載所需套件
python3 -m pip install --upgrade pip 
pip install -r requirements.txt 

# 4. 運行API伺服器
python3 local_tts_api.py