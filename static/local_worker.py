import os
import ollama
import uvicorn
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pyngrok import ngrok

app = FastAPI()

class ChatRequest(BaseModel):
    model: str
    messages: list

@app.post("/api/generate")
async def generate_response(req: ChatRequest):
    # 1. 檢查並動態拉取模型 (與網頁端同步)
    try:
        ollama.show(req.model)
    except ollama.ResponseError as e:
        if e.status_code == 404:
            print(f"📦 偵測到新模型 {req.model}，正在從 Ollama 下載 (這需要一點時間)...")
            ollama.pull(req.model)
            print(f"✅ 模型 {req.model} 下載完成！")
        else:
            raise e

    # 2. 串流生成回應
    def stream_generator():
        stream = ollama.chat(model=req.model, messages=req.messages, stream=True)
        for chunk in stream:
            yield chunk['message']['content']

    return StreamingResponse(stream_generator(), media_type="text/plain")

if __name__ == "__main__":
    # 啟動 Ngrok 內網穿透 (將本機 8001 暴露到外網)
    # 第一次使用建議去 ngrok 官網註冊拿 authtoken，然後執行 ngrok config add-authtoken <your_token>
    port = 8001
    public_url = ngrok.connect(port).public_url
    print("=" * 60)
    print("🚀 本地 AI 節點已啟動！")
    print(f"🔗 請將此 URL 複製到 Vioast 網頁的設定中: {public_url}")
    print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=port)