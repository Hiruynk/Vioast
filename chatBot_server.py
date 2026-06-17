import os
import json
import asyncio
import httpx
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import uvicorn

# AI 相關套件
import chromadb
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings
from opencc import OpenCC
from google import genai
from google.genai import types 

from pymongo import MongoClient

# ==========================================
# 1. 基礎設定與模型初始化
# ==========================================
cc_s2t = OpenCC('s2t') # 簡轉繁
cc_t2s = OpenCC('t2s') # 繁轉簡
app = FastAPI()

# ==========================================
# 🌟 雲端資料庫驗證初始化 (MongoDB Atlas)
# ==========================================
MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://hiruynk:Ynk39.,.@vioast.j3m5blp.mongodb.net/")
users_collection = None

try:
    # 加入 Timeout 避免無止盡等待導致伺服器卡死
    mongo_client = MongoClient(MONGO_URI, tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=5000)
    db = mongo_client["sample_mflix"] 
    users_collection = db["users"]
    # 測試連線
    mongo_client.admin.command('ping')
    print("✅ 成功連線至 MongoDB 雲端資料庫 [sample_mflix]！")
except Exception as e:
    print(f"⚠️ 雲端資料庫連線失敗，登入功能將暫時不可用: {e}")

# ==========================================
# 2. 定義 FastAPI 路由與資料模型
# ==========================================
class LoginReq(BaseModel):
    username: str
    password: str

class SaveKeyReq(BaseModel):
    username: str
    api_key: str

class GetKeyReq(BaseModel):
    username: str

@app.post("/api/login")
async def login_api(req: LoginReq):
    if users_collection is None:
        return {"status": "error", "msg": "資料庫未連線"}
    user = users_collection.find_one({"username": req.username, "password": req.password})
    if user:
        return {"status": "success", "api_key": user.get("api_key", "")}
    return {"status": "error"}

@app.post("/api/save_key")
async def save_key_api(req: SaveKeyReq):
    if users_collection is None:
        return {"status": "error"}
    result = users_collection.update_one(
        {"username": req.username},
        {"$set": {"api_key": req.api_key}}
    )
    if result.matched_count > 0:
        return {"status": "success"}
    return {"status": "error"}

@app.post("/api/get_key")
async def get_key_api(req: GetKeyReq):
    if users_collection is None:
        return {"status": "error"}
    user = users_collection.find_one({"username": req.username})
    if user:
        return {"status": "success", "api_key": user.get("api_key", "")}
    return {"status": "error"}

# ==========================================
# 載入 JSON 資料 (支援中英雙語)
# ==========================================
def load_all_data():
    BASE_PATH = "./"
    chi_data, eng_data = [], []
    try:
        with open(os.path.join(BASE_PATH, "IVE_courses_CHI.json"), "r", encoding="utf-8") as f:
            chi_data = json.load(f)
    except Exception as e:
        print(f"⚠️ 中文資料載入失敗: {e}")
        
    try:
        with open(os.path.join(BASE_PATH, "IVE_courses_ENG.json"), "r", encoding="utf-8") as f:
            eng_data = json.load(f)
    except Exception as e:
        print(f"⚠️ 英文資料載入失敗，將無法使用英文庫: {e}")
        
    return chi_data, eng_data

courses_chi, courses_eng = load_all_data()

# ==========================================
# 3. 伺服器專用: 定義 ChromaDB 與 HF Embedding (100% Space 適配版)
# ==========================================
class HFEmbeddingFunction(EmbeddingFunction):
    def __init__(self):
        from sentence_transformers import SentenceTransformer
        print("📥 正在載入伺服器端 Embedding 模型 (paraphrase-multilingual)...")
        self.model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

    def __call__(self, input: Documents) -> Embeddings:
        try:
            embeddings = self.model.encode(input)
            return embeddings.tolist()
        except Exception as e:
            print(f"Embedding error: {e}")
            return [[0.0] * 384 for _ in input]

def init_vector_db():
    # 🛑 核心修正：在 Hugging Face Space 中使用 EphemeralClient (純記憶體模式)
    # 這樣完全不需要硬碟寫入權限，絕對不會報 Permission Denied 錯誤
    client = chromadb.EphemeralClient()
    collections = {}
    
    hf_ef = HFEmbeddingFunction()
    
    def process_data(data_list, collection_name, prefix_msg):
        if not data_list: return None
        collection = client.get_or_create_collection(
            name=collection_name,
            embedding_function=hf_ef
        )
        
        # 純記憶體模式每次重啟都會重新建立，JSON 資料很少，速度極快
        print(f"📦 正在建立 Space 記憶體知識庫 {collection_name}...")
        docs, metadatas, ids = [], [], []
        
        def flatten_data(data):
            if isinstance(data, list):
                return "\n".join([f"- {flatten_data(item)}" for item in data])
            elif isinstance(data, dict):
                return "\n".join([f"{k}: {flatten_data(v)}" for k, v in data.items()])
            else:
                return str(data)

        for row in data_list:
            code = row.get("ProgrammeCode", "")
            name = row.get("ProgrammeName", "")
            full_text = f"課程編號/Code: {code}\n課程名稱/Name: {name}\n"
            for k, v in row.items():
                if k not in ["ProgrammeCode", "ProgrammeName"] and v:
                    full_text += f"【{k}】:\n{flatten_data(v)}\n\n"
                    
            chunk_size = 1200 
            if len(full_text) > chunk_size:
                chunks = [full_text[i:i+chunk_size] for i in range(0, len(full_text), chunk_size)]
                for i, chunk in enumerate(chunks):
                    chunk_header = f"[{prefix_msg} {code} {name} - Part {i+1}]\n"
                    docs.append(chunk_header + chunk)
                    metadatas.append({"code": code, "chunk": i})
                    ids.append(f"{code}_p{i}")
            else:
                docs.append(full_text)
                metadatas.append({"code": code, "chunk": 0})
                ids.append(f"{code}_p0")

        # 採用安全小批次寫入，防止 Space 記憶體溢出爆掉
        batch_size = 20 
        for i in range(0, len(docs), batch_size):
            collection.add(
                documents=docs[i:i+batch_size], 
                metadatas=metadatas[i:i+batch_size], 
                ids=ids[i:i+batch_size]
            )
        return collection

    collections['chi'] = process_data(courses_chi, "hkiit_server_db_chi", "課程")
    collections['eng'] = process_data(courses_eng, "hkiit_server_db_eng", "Course")
    print("✅ Space 虛擬雙語知識庫现场建立完成！")
    return collections

vector_collections = init_vector_db()

# ==========================================
# 4. 定義 FastAPI 路由與資料模型
# ==========================================
class ChatRequest(BaseModel):
    message: str
    history: list = []   
    mode: str           
    is_amadeus: bool    
    input_lang: str     
    output_lang: str    
    text_lang: str      
    ai_model: str = "gemini" 
    api_key: str = ""   
    file_context: str = ""
    local_url: str = ""         
    local_model_name: str = ""  
    app_lang: str = "zh-HK"    

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse('static/index.html')

# ==========================================
# 5. 核心對話 API
# ==========================================
@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    user_query = req.message.strip()
    search_query = user_query
    retrieved_context = ""

    # 決定使用的語言庫與系統提示設定
    is_english = req.app_lang == "en"
    is_simp_chi = req.app_lang == "zh-CN"
    
    target_collection = vector_collections.get('eng') if is_english else vector_collections.get('chi')

    if not user_query and req.file_context:
        user_query = "Please analyze and summarize the uploaded file." if is_english else "請幫我分析並總結這份上傳的檔案內容。"
        search_query = "Open Day" if is_english else "開放日" 

    if target_collection and search_query:
        try:
            search_results = target_collection.query(query_texts=[search_query], n_results=15)
            if search_results and search_results['documents']:
                retrieved_context = "\n\n---\n\n".join(search_results['documents'][0])
        except Exception as e:
            print(f"向量搜尋失敗: {e}")
            
    if req.file_context:
        file_header = "【User Uploaded Reference Document】:\n" if is_english else "【使用者上傳的參考文件內容】：\n"
        retrieved_context = f"{file_header}{req.file_context}\n\n---\n\n" + retrieved_context

    # ==========================================
    # 🌟 升級版強力 Prompt 寫入區
    # ==========================================
    if is_english:
        sys_role = "You are the official Open Day AI Chatbot Assistant for the Hong Kong Institute of Information Technology (HKIIT)."
        sys_tone = "Professional, structured, and helpful. You MUST answer entirely in ENGLISH."
        sys_rules = """
        1. [Knowledge Base Priority & Completeness]: Always read the [Knowledge Base Data] provided below first. You must extract and present the relevant course information completely without holding anything back.
        2. [Dynamic Length Control]:
           - For greetings or simple queries (e.g., tuition fees, transport), provide concise answers in 1 to 3 sentences.
           - For complex queries like "course details," "syllabus," or "what will I learn," you MUST list ALL modules, chapters, and semester details found in the Knowledge Base exactly as provided. Do NOT summarize, abbreviate, or skip any parts.
        3. [🛑 Strict Anti-Hallucination]: If the [Knowledge Base Data] does not contain specific details (e.g., a specific semester's syllabus), explicitly state: "The official database currently does not provide detailed syllabus for this specific part." NEVER guess or invent information.
        4. [Internet Search & Proactive Help]: You possess powerful internet search capabilities. For general school queries (e.g., university progression with specific GPAs) or queries lacking in the local database (especially transportation guidelines), you MUST proactively search the web, provide a clear and constructive answer, and state that the info is sourced from the internet. Do not rigidly block general educational queries.
        5. [Hide Technical Jargon]: NEVER use underlying technical terms in your final response (e.g., JSON, chunk, vector, Database).
        6. [Polite Rejection]: Politely deflect meaningless or offensive inputs using humor or tact.
        """
    elif is_simp_chi:
        sys_role = "你是【香港专业教育学院IVE & 香港资讯科技学院HKIIT 开放日官方 AI Chatbot 智能升学咨询助手】。"
        sys_tone = "极度专业、条理清晰。强制要求：必须使用【简体中文】回答。"
        sys_rules = """
        1. 【优先检索与完整输出】：必须优先阅读下方【知识库检索资料】来回答问题。务必将检索到的相关课程资料完整、毫无保留地提供给用户。
        2. 【长度与细节动态控制】：
           - 若用户只是打招呼或询问极简单的资讯（如学费、交通），请以 1-3 句话精简回答。
           - 若用户询问“课程内容、大纲、学什么”，这属于复杂问题！你必须将下方【知识库检索资料】中该课程的【所有章节、所有学期细节】毫无保留、逐字不漏地完整列出，绝对不允许自行总结、省略或简写。
        3. 【🛑 绝对禁止脑补与幻觉】：如果【知识库检索资料】中完全没有提及用户询问的特定学期或课程细节，你必须直接回答“目前官方资料库未提供该部分的详细大纲”，绝对不允许主观推测或虚构。
        4. 【强大联网搜索与泛用解答能力】：你具备强大的互联网搜索能力。对于知识库中没有的资料（特别是明确的交通路线指南），或者一般的学校疑问（例如：考取特定GPA如何升读大学、校园生活等），请务必立即触发联网搜索，给出清晰、有建设性的解答，并标明资料参考自网络。请放宽对一般学校问题的限制，尽力协助学生解决升学疑难。
        5. 【隐藏底层逻辑】：全程严禁在最终回答中出现任何底层技术词汇（如 JSON, chunk, 向量, Database）。
        6. 【礼貌应对】：遇到无意义或攻击言论，请用幽默机智的方式婉拒或转移话题。
        """
    else:
        sys_role = "你目前正擔任【香港專業教育學院IVE & 香港資訊科技學院HKIIT 開放日官方 AI Chatbot 智能升學諮詢助手】。"
        sys_tone = "極度專業、條理清晰。強制要求：必須使用【繁體中文】（可帶適當廣東話詞彙）回答。"
        sys_rules = """
        1. 【優先檢索與完整輸出】：必須優先閱讀下方【知識庫檢索資料】來回答問題。務必將檢索到的相關課程資料完整、毫無保留地提供給用戶。
        2. 【長度與細節動態控制】：
           - 若用戶只是打招呼或詢問極簡單的資訊（如學費、交通），請以 1-3 句話精簡回答。
           - 若用戶詢問「課程內容、大綱、學咩」，這屬於複雜問題！你必須將下方【知識庫檢索資料】中該課程的【所有章節、所有學期細節】毫無保留、逐字不漏地完整列出，絕對不允許自行總結、省略或簡寫。
        3. 【🛑 絕對禁止腦補與幻覺】：如果【知識庫檢索資料】中完全沒有提及用戶詢問的特定學期或課程細節，你必須直接回答「目前官方資料庫未提供該部分的詳細大綱」，絕對不允許主觀推測或虛構。
        4. 【強大聯網搜尋與泛用解答能力】：你具備強大的網際網路搜尋能力。對於知識庫中沒有的資料（特別是明確的交通路線指南），或者一般的學校疑問（例如：考取特定GPA如何升讀大學、校園生活等），請務必立即觸發聯網搜尋，給出清晰、有建設性的解答，並標明資料參考自網絡。請放寬對一般學校問題的限制，盡力協助學生解決升學疑難。
        5. 【隱藏底層邏輯】：全程嚴禁在最終回答中出現任何底層技術詞彙（如 JSON, chunk, 向量, Database）。
        6. 【禮貌應對】：遇到無意義或攻擊言論，請用幽默機智的方式婉拒或轉移話題。
        """

    if req.is_amadeus:
        lang_str = "English" if is_english else ("简体中文" if is_simp_chi else "繁體中文")
        system_instruction_str = f"""你現在是 Amadeus 系統中的 AI 牧瀨紅莉棲（Makise Kurisu），天才腦科學家。
你的性格傲嬌（Tsundere）、理性，嘴硬心軟。絕對不要承認自己是客服或 AI 助手。
強制要求：你的回應必須以【{lang_str}】輸出。
# 🛑【核心知識庫資料】🛑
{retrieved_context}
"""
    else:
        system_instruction_str = f"""# 你的身份
{sys_role}
{sys_tone}

# 核心行為指示
{sys_rules}

# 🛑【由 Embedding 模型檢索出之核心知識庫資料】🛑
{retrieved_context}
"""

    async def generate():
        recent_history = req.history[-5:] if req.history else []
        history_text = ""
        if recent_history:
            h_title = "Recent History" if is_english else "近期對話紀錄"
            history_text = f"\n# 【{h_title}】\n"
            for msg in recent_history:
                role = "User" if msg.get("role") == "user" else "AI"
                history_text += f"{role}: {msg.get('content')}\n"

        if req.ai_model == "gemma":
            try:
                if not req.local_url:
                    err = "Please enter the local node URL in settings." if is_english else "⚠️ 請先在設定中填寫本地節點 URL。"
                    yield f"data: {json.dumps({'text': err})}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                ollama_messages = [{"role": "system", "content": system_instruction_str}]
                for msg in recent_history:
                    ollama_role = "assistant" if msg.get("role") == "ai" else "user"
                    ollama_messages.append({"role": ollama_role, "content": msg.get("content", "")})
                ollama_messages.append({"role": "user", "content": user_query})

                target_url = f"{req.local_url.rstrip('/')}/api/generate"
                payload = {
                    "model": req.local_model_name if req.local_model_name else "gemma4:12b",
                    "messages": ollama_messages
                }

                async with httpx.AsyncClient(timeout=300.0) as client:
                    async with client.stream("POST", target_url, json=payload) as response:
                        if response.status_code != 200:
                            err_msg = await response.aread()
                            yield f"data: {json.dumps({'text': f'Node Error: {err_msg.decode()}'})}\n\n"
                            yield "data: [DONE]\n\n"
                            return

                        async for chunk in response.aiter_text():
                            if chunk:
                                if is_simp_chi: chunk = cc_t2s.convert(chunk)
                                elif not is_english: chunk = cc_s2t.convert(chunk)
                                yield f"data: {json.dumps({'text': chunk})}\n\n"
                                await asyncio.sleep(0.01)

                yield "data: [DONE]\n\n"
                
            except Exception as e:
                yield f"data: {json.dumps({'text': f'Connection error: {str(e)}'})}\n\n"
        else: 
            try:
                if not req.api_key:
                    err = "Please enter your Gemini API Key in settings." if is_english else "⚠️ 請在網頁側邊欄設定中輸入 Gemini API Key。"
                    yield f"data: {json.dumps({'text': err})}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                q_title = "Current Question" if is_english else "當前問題"
                full_query_for_gemini = f"{history_text}\n# 【{q_title}】\n{user_query}" if history_text else user_query

                client = genai.Client(api_key=req.api_key)
                config = types.GenerateContentConfig(
                    system_instruction=system_instruction_str, 
                    tools=[{"google_search": {}}], 
                    max_output_tokens=1024,  
                    temperature=0.5         
                )
                
                response_stream = client.models.generate_content_stream(
                    model='gemini-2.5-flash-lite',
                    contents=full_query_for_gemini,
                    config=config
                )
                
                for chunk in response_stream:
                    if chunk.text:
                        text = chunk.text
                        if is_simp_chi: text = cc_t2s.convert(text)
                        elif not is_english: text = cc_s2t.convert(text)
                        
                        yield f"data: {json.dumps({'text': text})}\n\n"
                        await asyncio.sleep(0.01)
                yield "data: [DONE]\n\n"
                
            except Exception as e:
                yield f"data: {json.dumps({'text': f'API Error: {str(e)}'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

if __name__ == "__main__":
    uvicorn.run("chatBot_server:app", host="0.0.0.0", port=7860)