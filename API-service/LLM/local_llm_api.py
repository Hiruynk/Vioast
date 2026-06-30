import os
import uvicorn
import asyncio
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import ollama

from duckduckgo_search import DDGS

app = FastAPI(title="Local LLM API (With Auto Web Search)")

class ChatRequest(BaseModel):
    model: str
    messages: list
    web_search: bool = True 

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
  
    try:
        ollama.show(req.model)
    except ollama.ResponseError as e:
        return Response(content="Model Not Found", status_code=404)


    if req.web_search:
        
        user_msg_index = -1
        for i in range(len(req.messages)-1, -1, -1):
            if req.messages[i]['role'] == 'user':
                user_msg_index = i
                break
        
        if user_msg_index != -1:
            query = req.messages[user_msg_index]['content']
            
   
            if len(query.strip()) > 2:
                print(f"🌐 啟動本地端自動聯網搜尋: {query}")
                try:
                    def fetch_web():
                        with DDGS() as ddgs:
                          
                            return list(ddgs.text(query, max_results=3))
                    

                    search_results = await asyncio.to_thread(fetch_web)
                    
                    if search_results:
                        web_context = "【🌐 網際網路即時搜尋結果 (提供最新資訊參考)】:\n"
                        for idx, res in enumerate(search_results):
                            web_context += f"{idx+1}. {res.get('title')}\n   內容: {res.get('body')}\n   來源: {res.get('href')}\n\n"
                        
                       
                        req.messages[user_msg_index]['content'] = f"{web_context}\n---\n使用者的問題：{query}"
                        print("✅ 聯網結果注入完成！Gemma 已經獲得最新知識。")
                    else:
                        print("⚠️ 找不到相關網路資料。")
                except Exception as e:
                    print(f"⚠️ 網路搜尋發生錯誤 (略過搜尋): {e}")

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