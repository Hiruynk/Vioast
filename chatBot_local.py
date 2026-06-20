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

# 🌟 引入 ChromaDB 內建的 Embedding 工具包
from chromadb.utils import embedding_functions


# ==========================================
# 1. 基礎設定與模型初始化
# ==========================================
cc_s2t = OpenCC('s2hk') # 簡轉繁
cc_t2s = OpenCC('t2s') # 繁轉簡
app = FastAPI()

# ==========================================
# 🌟 雲端資料庫驗證初始化 (MongoDB Atlas)
# ==========================================
MONGO_URI = os.environ.get("MONGO_URI")
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

# 🌟 新增：讓儲存請求支援本地 URL 與模型名稱
class SaveKeyReq(BaseModel):
    username: str
    api_key: str = ""
    local_url: str = ""
    local_model_name: str = ""

class GetKeyReq(BaseModel):
    username: str

@app.post("/api/login")
async def login_api(req: LoginReq):
    if users_collection is None:
        return {"status": "error", "msg": "資料庫未連線"}
    user = users_collection.find_one({"username": req.username, "password": req.password})
    if user:
        # 🌟 登入時，一併回傳 MongoDB 裡的本地模型設定
        return {
            "status": "success", 
            "api_key": user.get("api_key", ""),
            "local_url": user.get("local_url", ""),
            "local_model_name": user.get("local_model_name", "gemma4:12b")
        }
    return {"status": "error"}

@app.post("/api/save_key")
async def save_key_api(req: SaveKeyReq):
    if users_collection is None:
        return {"status": "error"}
    # 🌟 儲存時，將這三個參數一起更新到雲端資料庫
    result = users_collection.update_one(
        {"username": req.username},
        {"$set": {
            "api_key": req.api_key,
            "local_url": req.local_url,
            "local_model_name": req.local_model_name
        }}
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
        # 🌟 背景同步時，一併回傳 MongoDB 裡的本地模型設定
        return {
            "status": "success", 
            "api_key": user.get("api_key", ""),
            "local_url": user.get("local_url", ""),
            "local_model_name": user.get("local_model_name", "gemma4:12b")
        }
    return {"status": "error"}

# ==========================================
# 1. 載入 JSON 資料 (支援中英雙語，動態載入多檔案)
# ==========================================
def load_all_data():
    BASE_PATH = "database/"
    
    # 定義要載入的檔案清單 (介紹檔中英通用，所以兩邊都加入)
    chi_files = ["IVE_courses_CHI.json", "IVE_f_courses_CHI.json", "IVE_introduce.json", "HKIIT_introduce.json"]
    eng_files = ["IVE_courses_ENG.json", "IVE_f_courses_ENG.json", "IVE_introduce.json", "HKIIT_introduce.json"]
    
    def read_json_files(file_list):
        combined_data = []
        for filename in file_list:
            filepath = os.path.join(BASE_PATH, filename)
            if not os.path.exists(filepath):
                print(f"⚠️ 找不到檔案，將略過: {filename}")
                continue
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    # 確保無論是單一 Dict 還是 List 都能正確合併
                    if isinstance(data, list):
                        combined_data.extend(data)
                    else:
                        combined_data.append(data)
                print(f"📥 成功載入檔案: {filename} (共 {len(data) if isinstance(data, list) else 1} 筆資料)")
            except Exception as e:
                print(f"⚠️ 載入失敗 {filename}: {e}")
        return combined_data

    print("--- 準備載入中文知識庫資料 ---")
    chi_data = read_json_files(chi_files)
    
    print("--- 準備載入英文知識庫資料 ---")
    eng_data = read_json_files(eng_files)
        
    return chi_data, eng_data

courses_chi, courses_eng = load_all_data()

# ==========================================
# 2. 定義 ChromaDB 與 本地 Ollama Embedding (持久化儲存)
# ==========================================

def init_vector_db():
    # 🌟 關鍵 1：設定 PersistentClient，將向量永久儲存在本機硬碟中
    client = chromadb.PersistentClient(path="database/RAG_DB")
    collections = {}
    
    # 🌟 關鍵 2：直接使用 ChromaDB 內建的 Ollama 整合套件
    print("📥 正在連結本地 Ollama (bge-m3)...")
    ollama_ef = embedding_functions.OllamaEmbeddingFunction(
        url="http://localhost:11434/api/embeddings", 
        model_name="bge-m3"
    )
    
    def process_data(data_list, collection_name, prefix_msg):
        if not data_list: return None
        
        # 取得或建立 Collection，並綁定 Ollama Embedding
        collection = client.get_or_create_collection(
            name=collection_name,
            embedding_function=ollama_ef
        )
        
        # 🌟 關鍵 3：智能緩存機制。如果硬碟裡已經有資料，就直接跳過漫長的計算過程！
        if collection.count() > 0:
            print(f"📦 知識庫 [{collection_name}] 已存在 (共 {collection.count()} 筆向量)，直接從 ./my_vioast_db 載入！")
            return collection
            
        print(f"📦 正在透過 Ollama 計算並建立知識庫 [{collection_name}] 的向量 (首次啟動需時較長)...")
        docs, metadatas, ids = [], [], []
        
        def flatten_data(data):
            if isinstance(data, list):
                return "\n".join([f"- {flatten_data(item)}" for item in data])
            elif isinstance(data, dict):
                return "\n".join([f"{k}: {flatten_data(v)}" for k, v in data.items()])
            else:
                return str(data)

        # 建立全域計數器，確保混合不同 JSON 時 ID 絕對唯一
        global_id_counter = 0

        for row in data_list:
            # 萬用屬性擷取
            code = str(row.get("ProgrammeCode", row.get("course_no", row.get("id", ""))))
            name = str(row.get("ProgrammeName", row.get("course_name", row.get("title", row.get("name", "綜合資訊")))))
            
            full_text = f"名稱/Title: {name}\n"
            if code:
                full_text += f"編號/Code: {code}\n"
            
            ignore_keys = ["ProgrammeCode", "ProgrammeName", "course_no", "course_name", "title", "name", "id"]
            
            for k, v in row.items():
                if k not in ignore_keys and v:
                    full_text += f"【{k}】:\n{flatten_data(v)}\n\n"
                    
            # 文本重疊分塊邏輯
            chunk_size = 800  
            overlap = 150     
            
            if len(full_text) > chunk_size:
                step = chunk_size - overlap
                chunks = [full_text[i : i + chunk_size] for i in range(0, len(full_text), step)]
                
                for i, chunk in enumerate(chunks):
                    chunk_header = f"[{prefix_msg} {code} {name} - Part {i+1}]\n"
                    docs.append(chunk_header + chunk)
                    metadatas.append({"code": code, "name": name, "chunk": i})
                    ids.append(f"doc_{collection_name}_{global_id_counter}_p{i}")
            else:
                docs.append(full_text)
                metadatas.append({"code": code, "name": name, "chunk": 0})
                ids.append(f"doc_{collection_name}_{global_id_counter}_p0")
                
            global_id_counter += 1

        # 批次寫入 ChromaDB
        batch_size = 20 
        for i in range(0, len(docs), batch_size):
            try:
                collection.add(
                    documents=docs[i:i+batch_size], 
                    metadatas=metadatas[i:i+batch_size], 
                    ids=ids[i:i+batch_size]
                )
            except Exception as e:
                print(f"⚠️ 寫入 Batch 失敗: {e}")
                
        return collection

    collections['chi'] = process_data(courses_chi, "hkiit_server_db_chi", "知識庫資料")
    collections['eng'] = process_data(courses_eng, "hkiit_server_db_eng", "Knowledge Base")
    print("✅ Vioast 本地端雙語混合知識庫載入完成！")
    return collections

vector_collections = init_vector_db()

# ==========================================
# 定義 FastAPI 路由與資料模型
# ==========================================
class ChatRequest(BaseModel):
    message: str
    history: list = []   
    mode: str             
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
# 核心對話 API
# ==========================================
@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    user_query = req.message.strip()
    
    # 👇 修改這行：加入 .lower()，這樣不管打大寫還是小寫都能觸發！
    if user_query.lower() == "clear system cache" or user_query == "強制清除緩存":
        async def clear_cache_stream():
            # 吐出一個帶有 [CLEAR_LOCAL_STORAGE] 標籤的特製回應
            yield f"data: {json.dumps({'text': '[CLEAR_LOCAL_STORAGE] 🚨 收到強制清除指令！正在抹除本地所有緩存並重啟系統...'})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(clear_cache_stream(), media_type="text/event-stream")
    
    search_query = user_query
    retrieved_context = ""

    # 決定使用的語言庫與系統提示設定
    is_english = req.app_lang == "en"
    is_simp_chi = req.app_lang == "zh-CN"
    
    target_collection = vector_collections.get('eng') if is_english else vector_collections.get('chi')

    # 👇 🌟 新增：攔截 Base64 圖片並轉換為 AI 專用多模態格式
    import base64
    image_part_gemini = None
    image_base64_ollama = None

    if req.file_context and req.file_context.startswith("data:image/"):
        try:
            # 分離標頭 (data:image/jpeg;base64) 與實際編碼
            header, encoded = req.file_context.split(",", 1)
            mime_type = header.split(";")[0].split(":")[1]
            
            # 給 Gemini 用的原生圖片格式 (Bytes)
            image_bytes = base64.b64decode(encoded)
            image_part_gemini = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            
            # 給 Ollama 用的 base64 格式
            image_base64_ollama = encoded
            
            # 🚨 致命修復：清空 file_context，阻止這串亂碼被塞入純文字提示詞中！
            req.file_context = "" 
        except Exception as e:
            print(f"圖片解析失敗: {e}")
        

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

    # 根據語言設定 System Instruction
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
    
    if req.mode == "live2d":
        # 決定畫面顯示文字的語言
        display_lang = "中文(繁體)" if req.text_lang == "chinese" else "英文(English)"
        
        # 決定語音引擎要接收的語言
        voice_lang_map = {
            "cantonese": "極度地道的香港廣東話口語 (把「是/的/甚麼/了/在」轉換成「係/嘅/咩/咗/緊」)", 
            "mandarin": "自然流暢的普通話", 
            "japanese": "純正日語 (必須完全翻譯成日文文法與詞彙，平假名/片假名/日文漢字)", 
            "english": "純正英文"
        }
        target_voice = voice_lang_map.get(req.output_lang, voice_lang_map["cantonese"])

       # 🌟 終極大腦：雙軌獨立翻譯標籤系統
        system_instruction_str = f"""你現在是香港專業教育學院IVE & 香港資訊科技學院HKIIT 開放日現場的虛擬學姐助手「桃瀨日和」(Hiyori)。
說話風格熱情、活潑俏皮。每次回覆嚴格控制在 1 到 2 句話內，並以「引導式問句」結尾。

【🌐 終極語言處理引擎：雙軌獨立翻譯】（系統級最高絕對指令）
為徹底解決多語種錯亂問題，你【必須】嚴格按照以下步驟處理：

步驟 1. 核心思考：先用【標準書面繁體中文】根據下方知識庫，構思出你簡短俏皮的回覆。
步驟 2. 語音軌翻譯：將中文回覆完全翻譯成【{target_voice}】，並放入 [VOICE] 標籤內。
   - ⚠️ 絕對禁止把中文直接塞進日文或英文的發音標籤內！
   - ⚠️ 專有名詞 (如 HKIIT、IVE)，必須轉換為該語音的正確發音 (日文必須轉為片假名 エイチ・ケー・アイ・アイ・ティー)。
步驟 3. 文字軌翻譯：將中文回覆完全翻譯成【{display_lang}】，並放入 [TEXT] 標籤內。

【⚠️ 最終輸出格式鐵律】
你不可以把思考過程寫出來，你【必須且只能】輸出帶有這兩個標籤的最終結果，格式如下：
[VOICE]步驟2的語音翻譯結果[/VOICE][TEXT]步驟3的畫面翻譯結果[/TEXT]

【⚠️ 語音首字極速啟動鐵律】
為了讓系統達到 0 秒反應，你的 [VOICE] 內，第一句話【必須】是一個極短的語氣詞或打招呼（不超過 3 個字），並且立刻用逗號「，」斷開！
⚠️ 致命要求：語氣詞的語言必須與目標語音完全一致！如果是英文，絕對不能用中文的「啊，」，必須使用「Oh,」或「Hi,」等英文語氣詞，並用半形逗號「,」斷開。

✅ 絕對正確的範例：
[VOICE]啊，[TEXT]啊，
[VOICE]你好，[TEXT]你好，
[VOICE]咦，[TEXT]咦，

✅ 廣東話範例（目標語音:廣東話 / 畫面:中文）：
[VOICE]歡迎來到 HKIIT 嘅開放日呀！今日有咩可以幫到你呢？[/VOICE][TEXT]歡迎來到 HKIIT 開放日！今天有甚麼我可以幫忙的呢？[/TEXT]

✅ 日文範例（目標語音:日文 / 畫面:中文）：
[VOICE]エイチ・ケー・アイ・アイ・ティーのオープンキャンパスへようこそ！今日は何かお手伝いできることはありますか？[/VOICE][TEXT]歡迎來到 HKIIT 開放日！今天有甚麼我可以幫忙的呢？[/TEXT]

✅ 英文範例（目標語音:英文 / 畫面:中文）：
[VOICE]Oh, welcome to the HKIIT Open Day! How can I help you today?[/VOICE][TEXT]啊，歡迎來到 HKIIT 開放日！今天有甚麼我可以幫忙的呢？[/TEXT]

核心知識庫資料：
{retrieved_context}
"""
    else:
        system_instruction_str = f"""# 你的身份
{sys_role}
{sys_tone}

# 核心行為指示
{sys_rules}

# 🛑【由 BGE-M3 模型檢索出之核心知識庫資料】🛑
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
                # 👇 🌟 核心修復：如果存在圖片，將圖片加入 Ollama 的 images 陣列
                user_msg_dict = {"role": "user", "content": user_query}
                if image_base64_ollama:
                    user_msg_dict["images"] = [image_base64_ollama]
                ollama_messages.append(user_msg_dict)
                # 🌟 改為指向我們剛剛寫好的 5070 Ti 腳本的 /api/chat 路由
                target_url = f"{req.local_url.rstrip('/')}/api/chat"
                payload = {
                    "model": req.local_model_name if req.local_model_name else "gemma4:12b",
                    "messages": ollama_messages,
                    "stream": True
                }

                async with httpx.AsyncClient(timeout=300.0) as client:
                    async with client.stream("POST", target_url, json=payload) as response:
                        # 🌟 攔截模型不存在的錯誤
                        if response.status_code == 404:
                            err_txt = f"⚠️ Error: 尋找不到該模型 ({req.local_model_name})，請確認PC上是否已 pull 下載！"
                            yield f"data: {json.dumps({'text': err_txt})}\n\n"
                            yield "data: [DONE]\n\n"
                            return
                        elif response.status_code != 200:
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
                
            except httpx.ConnectError:
                err_txt = "⚠️ 網路連線失敗！請確認PC的 API 腳本是否啟動，以及 Cloudflare Tunnel 網址是否填寫正確。"
                yield f"data: {json.dumps({'text': err_txt})}\n\n"
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

                contents_to_send = [image_part_gemini, full_query_for_gemini] if image_part_gemini else full_query_for_gemini

                client = genai.Client(api_key=req.api_key)
                config = types.GenerateContentConfig(
                    system_instruction=system_instruction_str, 
                    tools=[{"google_search": {}}], # 修復為最穩定的 Google Search 啟用格式
                    max_output_tokens=1024,  
                    temperature=0.5         
                )
                
                response_stream = client.models.generate_content_stream(
                    model='gemini-3.1-flash-lite',
                    contents=contents_to_send,
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
    uvicorn.run("chatBot_local:app", host="0.0.0.0", port=8000)