import os
import uvicorn
import asyncio
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import ollama

# 🌟 引入 DuckDuckGo 搜尋引擎
from duckduckgo_search import DDGS

app = FastAPI(title="Local LLM API (With Auto Web Search)")

# 增加 web_search 參數，並預設為 True (自動開啟聯網)
class ChatRequest(BaseModel):
    model: str
    messages: list
    web_search: bool = True 

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    # 1. 驗證模型是否存在
    try:
        ollama.show(req.model)
    except ollama.ResponseError as e:
        return Response(content="Model Not Found", status_code=404)

    # 🌟 2. 自動聯網攔截器 (Auto Web Search Interceptor)
    if req.web_search:
        # 從訊息陣列中，找出使用者最後一次發送的問題
        user_msg_index = -1
        for i in range(len(req.messages)-1, -1, -1):
            if req.messages[i]['role'] == 'user':
                user_msg_index = i
                break
        
        if user_msg_index != -1:
            query = req.messages[user_msg_index]['content']
            
            # 過濾掉太短的無意義詞彙 (例如: "hi", "你好")，避免浪費時間搜尋
            if len(query.strip()) > 2:
                print(f"🌐 啟動本地端自動聯網搜尋: {query}")
                try:
                    def fetch_web():
                        with DDGS() as ddgs:
                            # 抓取前 3 筆最新網路結果
                            return list(ddgs.text(query, max_results=3))
                    
                    # 使用非同步執行，避免卡死本地 API 伺服器
                    search_results = await asyncio.to_thread(fetch_web)
                    
                    if search_results:
                        web_context = "【🌐 網際網路即時搜尋結果 (提供最新資訊參考)】:\n"
                        for idx, res in enumerate(search_results):
                            web_context += f"{idx+1}. {res.get('title')}\n   內容: {res.get('body')}\n   來源: {res.get('href')}\n\n"
                        
                        # 🌟 核心魔法：將搜尋結果「偷偷」塞入使用者的問題前面，再餵給 Gemma！
                        req.messages[user_msg_index]['content'] = f"{web_context}\n---\n使用者的問題：{query}"
                        print("✅ 聯網結果注入完成！Gemma 已經獲得最新知識。")
                    else:
                        print("⚠️ 找不到相關網路資料。")
                except Exception as e:
                    print(f"⚠️ 網路搜尋發生錯誤 (略過搜尋): {e}")

    # 3. 啟動串流推論
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
            yield f"\n【本地節點錯誤】推論中斷: {str(e)}"

    return StreamingResponse(stream_generator(), media_type="text/plain")

if __name__ == "__main__":
    print("==========================================================")
    print("🚀 啟動本地大模型 API 伺服器 (包含自動聯網能力) (Port: 8001)")
    print("==========================================================")
    uvicorn.run(app, host="0.0.0.0", port=8001)