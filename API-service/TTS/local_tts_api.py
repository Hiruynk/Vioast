import os
import subprocess

# ==========================================
# 1. Mac 模型路徑設定 
# ==========================================
GPT_PATH = "./weights/TakagiV4-e5.ckpt"
SOVITS_PATH = "./weights/TakagiV4_e4_s540_l32.pth"
REF_AUDIO = "./weights/Takagi_sample.wav"
REF_TEXT = "変顔だったらもっと眉毛をこうしてさ。"
REF_LANG = "ja"

# ==========================================
# 2. 啟動官方 API
# ==========================================
cmd = [
    "python3", "api.py",  
    "-a", "127.0.0.1",
    "-p", "9880",
    "-s", SOVITS_PATH,
    "-g", GPT_PATH,
    "-dr", REF_AUDIO,
    "-dt", REF_TEXT,
    "-dl", REF_LANG
]

try:
    subprocess.run(cmd)
except KeyboardInterrupt:
    print("\nTTS-API 伺服器已手動關閉。")