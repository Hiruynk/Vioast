import os
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import ollama

app = FastAPI(title="Local LLM API")

class ChatRequest(BaseModel):
    model: str
    messages: list

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    # 🌟 1. 驗證模型是否存在 (攔截「尋找不到該模型」錯誤)
    try:
        ollama.show(req.model)
    except ollama.ResponseError as e:
        # 如果模型不存在，回傳 404 狀態碼讓前端能精準攔截
        return Response(content="Model Not Found", status_code=404)

    # 🌟 2. 啟動串流推論
    async def stream_generator():
        try:
            stream = ollama.chat(
                model=req.model,
                messages=req.messages,
                stream=True
            )
            for chunk in stream:
                content = chunk['message']['content']
                if content:
                    yield content
        except Exception as e:
            yield f"\n【節點錯誤】推論中斷: {str(e)}"

    # 回傳純文字串流，完美適配我們原本的 chatBot_local.py
    return StreamingResponse(stream_generator(), media_type="text/plain")

if __name__ == "__main__":
    print("==========================================================")
    print("🚀 啟動本地大模型 API 伺服器 (Port: 8001)")
    print("==========================================================")
    uvicorn.run(app, host="0.0.0.0", port=8001)
