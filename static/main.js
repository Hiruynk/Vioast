document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. 狀態與設定管理
    // ==========================================
    let currentMode = 'chat'; 
    let live2dApp = null; 
    let fileContentBuffer = ""; 
    let attachedFile = null; // 🌟 新增：用來記錄當前準備發送的檔案元數據 (名稱、類型與數據)

    let live2dFullHistory = JSON.parse(localStorage.getItem('hkiit_l2d_history')) || [];

    let chatSessions = JSON.parse(localStorage.getItem('hkiit_chat_sessions')) || [];
    let currentSessionId = Date.now();
    let currentMessages = [];

    // 頂部全域變數 (🌟 已經刪除了重複的 live2dApp)
    let live2dModel, ttsSpeaking = false, live2dMessages = [];
    // 👇 新增
    let live2dMood = 'calm';

    // 宣告佇列變數，放在全域確保不會被洗掉
    let sentenceQueue = [];
    let currentAudio = null;

    let ttsInterruptToken = 0; // 🌟 新增：語音防重疊中斷權杖

    let audioContext = null;
    let audioAnalyser = null;

    // 🌟 新增：全域防連點鎖 (確保任何時候只有一個請求在進行)
    let isProcessingRequest = false;

    let appSettings = {
        model: 'gemini', apiKey: '', theme: 'auto',
        inputLang: 'cantonese', outputLang: 'cantonese', textLang: 'chinese',
        sakuraEffect: true, // 🌟 新增：櫻花特效預設開啟
        live2dLangSet: false,
        appLang: 'zh-HK'
    };

    const dom = {
        header: document.getElementById('app-header'),
        headerTitle: document.getElementById('header-title'),
        chatHistory: document.getElementById('chat-history'),
        chatInput: document.getElementById('chat-input'),
        chatSend: document.getElementById('chat-send'),
        settingsModal: document.getElementById('settings-modal'),

        dropdownTrigger: document.getElementById('model-dropdown-trigger'),
        dropdownMenu: document.getElementById('model-dropdown-menu'),
        selectedModelName: document.getElementById('selected-model-name'),
        dropdownItems: document.querySelectorAll('#model-dropdown-menu .dropdown-item'),
        
        langDropdownTrigger: document.getElementById('lang-dropdown-trigger'),
        langDropdownMenu: document.getElementById('lang-dropdown-menu'),
        langDropdownItems: document.querySelectorAll('#lang-dropdown-menu .dropdown-item'),
        
        inpApiKey: document.getElementById('input-api-key'),
        selTheme: document.getElementById('sel-theme'),
        apiKeyContainer: document.getElementById('api-key-container'),
        
        localNodeContainer: document.getElementById('local-node-container'),
        inputLocalUrl: document.getElementById('input-local-url'),
        inputLocalModel: document.getElementById('input-local-model'),

        btnCloseSidebar: document.getElementById('btn-close-sidebar'),
        
        btnLive2DSettings: document.getElementById('btn-live2d-settings'),
        sidebar: document.getElementById('sidebar'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
        btnNewChat: document.getElementById('btn-new-chat'),
        historyList: document.getElementById('history-list'),
        uploadPreview: document.getElementById('upload-preview'),
        btnUpload: document.getElementById('btn-upload'),
        fileUpload: document.getElementById('file-upload'),
        btnModeChat: document.getElementById('btn-mode-chat'),
        btnModeLive2D: document.getElementById('btn-mode-live2d'),
        viewChat: document.getElementById('view-chat'),
        viewLive2D: document.getElementById('view-live2d'),
        langModal: document.getElementById('lang-modal'),
        closeLangModal: document.getElementById('close-lang-modal'),
        btnStartLive2D: document.getElementById('btn-start-live2d'),
        selInputLang: document.getElementById('sel-input-lang'),
        selOutputLang: document.getElementById('sel-output-lang'),
        selTextLang: document.getElementById('sel-text-lang'),
        selSakuraEffect: document.getElementById('sel-sakura-effect'), // 🌟 新增：抓取櫻花選單
        live2dSubtitle: document.getElementById('live2d-subtitle'),
        btnSettings: document.getElementById('btn-settings'), 
        btnLogin: document.getElementById('btn-login'),
        loginModal: document.getElementById('login-modal'),
        closeLogin: document.getElementById('close-login'),
        btnDoLogin: document.getElementById('btn-do-login'),
        inpUsername: document.getElementById('inp-username'),
        inpPassword: document.getElementById('inp-password'),
        loginError: document.getElementById('login-error'),
        loginSuccess: document.getElementById('login-success'),
        settingsSuccess: document.getElementById('settings-success')
    };

    // 定義 Logo 的 HTML 字串，確保它與文字完美對齊

    // ===== 定義高質感的 SVG 圖示變數 =====
    const svgUser = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px; position: relative; top: -1px;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    const svgSettings = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px; position: relative; top: -1px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
    const svgSettingsInline = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin: 0 2px; position: relative; top: -1px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
    const svgKey = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px; position: relative; top: -1px;"><path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z"></path><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"></circle></svg>`;
    const svgLink = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px; position: relative; top: -1px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
    const svgBot = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px; position: relative; top: -1px;"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>`;
    const svgCheck = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34c759" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; position: relative; top: -1px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const svgMic = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px; position: relative; top: -1px;"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>`;
    const svgSpeaker = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px; position: relative; top: -1px;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
    const svgPen = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px; position: relative; top: -1px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    const svgWarn = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffcc00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; position: relative; top: -1px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    const svgCopy = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; position: relative; top: -1px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const svgFail = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; position: relative; top: -1px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    const svgImageIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px; position: relative; top: -1px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
    const svgFileIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px; position: relative; top: -1px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;

    // ===== 完備多國語言包 =====
    const translations = {
        'en': {
            app_title: "Open Day Assistant", new_chat: "New Chat", recent_chats: "Recent Chats",
            login: "Login", settings: "Settings", voice: "Voice",
            tooltip_toggle_sidebar: "Expand", tooltip_close_sidebar: "Close",
            tooltip_upload: "Upload Attachment", tooltip_send: "Send Message",
            tooltip_mode_chat: "Chat Mode", tooltip_mode_live2d: "Live2D Mode",
            placeholder_input: "Type a message here...",
            login_header: `${svgUser} Account Login`, placeholder_username: "Username", placeholder_password: "Password",
            login_error: "Incorrect username or password!", login_btn: "Login",
            settings_header: `${svgSettings} System Settings`, settings_api_key: `${svgKey} Gemini API Key:`,
            settings_local_url: `${svgLink} Local Node URL:`, settings_local_model: `${svgBot} Local Model Name:`,
            placeholder_local_url: "e.g., https://xxx.abc.com", placeholder_local_model: "e.g., gemma4:12b",
            placeholder_api_key: "Enter your API Key",
            settings_theme: "🌗 Theme Appearance:", theme_auto: "Follow System (Auto)",
            theme_light: "Light Mode", theme_dark: "Dark Mode",
            settings_success: `${svgCheck} Saved successfully!`, settings_save_btn: "Save Settings",
            live2d_subtitle: "Click the microphone button on the bottom right to talk to me",
            voice_header: `${svgSettings} Voice Dialogue Settings`, voice_input_lang: `${svgMic} Your Input Language:`,
            voice_output_lang: `${svgSpeaker} AI Voice Output:`, voice_text_lang: `${svgPen} Screen Display Text:`,
            settings_sakura: "🌸 Sakura Effect:", sakura_on: "On (Default)", sakura_off: "Off (Performance)", // 🌟 新增
            lang_cantonese: "Cantonese", lang_mandarin: "Mandarin", lang_japanese: "Japanese", lang_english: "English",
            lang_chinese_text: "Chinese", lang_english_text: "English", voice_start_btn: "Confirm and Enter",
            model_gemini_desc: "Fastest Response", model_gemma_desc: "Local Computing",
            err_no_api_key: `${svgWarn} Please click Settings (${svgSettingsInline}) in the sidebar to enter your Gemini API Key.`,
            err_network: "System connection error. Please ensure the backend server is running.",
            btn_copy: `${svgCopy} Copy`, btn_copied: `${svgCheck} Copied`, btn_copy_fail: `${svgFail} Failed`,
            upload_image: "Image", upload_file: "Attachment",
            tooltip_upload: "Upload",
            l2d_mode_auto: `${svgMic} Auto`, l2d_mode_verify: `${svgPen} Verify`,
            l2d_placeholder_auto: "Tap Mic to speak...",
            l2d_placeholder_verify: "Type or use Mic ...",
            local_help_title: "❓ Local LLM Startup Tutorial",
            local_help_s1_title: "Step 1: Start the API Script",
            local_help_s1_desc: "On your PC host, open a terminal and execute the script:",
            local_help_s2_title: "Step 2: Configure Cloudflare Tunnel",
            local_help_s2_desc: "Open a new terminal and execute the following command to get the Domain Name (URL):",
            local_help_s2_note: "(Or use the run command to bind your own domain)",
            local_help_s3_title: "Step 3: Fill in Configuration Parameters",
            local_help_s3_url_title: "API URL:",
            local_help_s3_url_desc: "Paste the HTTPS URL obtained just now.",
            local_help_s3_model_title: "Model Name:",
            local_help_s3_model_desc: "Enter the model that already exists on your PC.",
            l2d_placeholder_verify: "Type or use Mic ...",
            l2d_loading_text: "Loading model, please wait...", // 🌟 新增英文
            local_help_title: "❓ Local LLM Startup Tutorial",
            tooltip_l2d_history: "Live2D Chat Log", l2d_history_title: "Chat History",
            tooltip_l2d_auto: "Voice Direct", tooltip_l2d_verify: "Verify Mode",
            welcome_md: `Hello! Welcome to the **IVE HKIIT Open Day**! I am your official **AI Chatbot Assistant**.\n\nThe IVE IT Discipline has been upgraded to the **Hong Kong Institute of Information Technology (HKIIT)**! I'm here to provide you with syllabus details, tuition fees, and admission requirements for our Higher Diploma programs, or navigate you through today's activities!\n\n**Try asking me:**\n* Syllabus: \`What will I learn in Higher Diploma in Data Science and AI (IT114126)?\`\n* Admission: \`What are the requirements for Real Estate (BA114037)?\`\n* Transport: \`How do I get to IVE Tsing Yi?\`\n\nHow can I help you today?`
        },
        'zh-HK': {
            app_title: "開放日助手", new_chat: "新增對話", recent_chats: "近期對話",
            login: "登入", settings: "設定", voice: "語音",
            tooltip_toggle_sidebar: "展開", tooltip_close_sidebar: "關閉",
            tooltip_upload: "上傳附件", tooltip_send: "發送訊息",
            tooltip_mode_chat: "對話模式", tooltip_mode_live2d: "Live2D 模式",
            placeholder_input: "在這裡輸入訊息...",
            login_header: `${svgUser} 帳號登入`, placeholder_username: "帳號", placeholder_password: "密碼",
            login_error: "帳號或密碼錯誤！", login_btn: "登入",
            settings_header: `${svgSettings} 系統設定`, settings_api_key: `${svgKey} Gemini API Key：`,
            settings_local_url: `${svgLink} 本地節點 URL：`, settings_local_model: `${svgBot} 本地模型名稱：`,
            placeholder_local_url: "例如 hhttps://xxx.abc.com", placeholder_local_model: "例如 gemma4:12b",
            placeholder_api_key: "輸入您的 API 密鑰",
            settings_theme: "🌗 外觀主題：", theme_auto: "跟隨系統 (Auto)",
            theme_light: "淺色模式 (Light)", theme_dark: "深色模式 (Dark)",
            settings_success: `${svgCheck} 儲存成功！`, settings_save_btn: "儲存設定",
            live2d_subtitle: "點擊右下角麥克風與我對話",
            voice_header: `${svgSettings} 語音對話設定`, voice_input_lang: `${svgMic} 您的輸入語言：`,
            voice_output_lang: `${svgSpeaker} AI 語音輸出：`, voice_text_lang: `${svgPen} 螢幕顯示文字：`,
            settings_sakura: "🌸 櫻花飄落特效：", sakura_on: "開啟 (預設)", sakura_off: "關閉 (提升效能)", // 🌟 新增
            lang_cantonese: "廣東話", lang_mandarin: "普通話", lang_japanese: "日文", lang_english: "英文",
            lang_chinese_text: "中文", lang_english_text: "英文", voice_start_btn: "確認並進入",
            model_gemini_desc: "回覆最快", model_gemma_desc: "本地運算",
            err_no_api_key: `${svgWarn} 請先點擊側邊欄設定 (${svgSettingsInline}) 填寫您的 Gemini API Key。`,
            err_network: "系統連接錯誤。請確認後端伺服器運行中。",
            btn_copy: `${svgCopy} 複製`, btn_copied: `${svgCheck} 已複製`, btn_copy_fail: `${svgFail} 失敗`,
            upload_image: "圖片", upload_file: "附件",
            tooltip_upload: "上傳",
            l2d_mode_auto: `${svgMic} 直發模式`, l2d_mode_verify: `${svgPen} 校對模式`,
            l2d_placeholder_auto: "請按麥克風語音對話...",
            l2d_placeholder_verify: "輸入後發送...",
            local_help_title: "❓ 本地大模型啟動教學",
            local_help_s1_title: "步驟 1：啟動 API 腳本",
            local_help_s1_desc: "在你的PC主機上，打開終端機並執行腳本：",
            local_help_s2_title: "步驟 2：設定 Cloudflare Tunnel 穿透",
            local_help_s2_desc: "開啟新終端機，執行以下指令獲取 Domain Name (網址)：",
            local_help_s2_note: "(或使用 run 指令綁定 你設定的域名)",
            local_help_s3_title: "步驟 3：填寫設定參數",
            local_help_s3_url_title: "API 網址：",
            local_help_s3_url_desc: "貼上剛才獲取的 HTTPS 網址。",
            local_help_s3_model_title: "模型名稱：",
            local_help_s3_model_desc: "填寫PC上已存在的模型。",
            l2d_placeholder_verify: "輸入後發送...",
            l2d_loading_text: "模型載入中，請稍候...", // 🌟 新增繁體
            local_help_title: "❓ 本地大模型啟動教學",
            tooltip_l2d_history: "Live2D 聊天紀錄", l2d_history_title: "聊天紀錄",
            tooltip_l2d_auto: "語音直發", tooltip_l2d_verify: "打字校對",
            welcome_md: `您好！歡迎來到 **IVE HKIIT 開放日**！我是您的官方 **AI Chatbot 智能升學諮詢助手**。\n\n香港專業教育學院（IVE）資訊科技學系已全新升級為 **香港資訊科技學院（HKIIT）**！在這裡，我能為您提供各項熱門的高級文憑 (Higher Diploma) 課程大綱、學費、入學要求，或是為您導航今天的開放日活動！\n\n**您可以試著這樣問我：**\n* 課程內容：\`IT114126 數據科學及人工智能高級文憑學咩？\`\n* 入學條件：\`BA114037 房地產高級文憑有咩入學要求？\`\n* 交通導航：\`青衣 IVE 點樣去？\` \n\n請問今天有甚麼我可以幫到您？`
        },
        'zh-CN': {
            app_title: "开放日助手", new_chat: "新增对话", recent_chats: "近期对话",
            login: "登入", settings: "设定", voice: "语音",
            tooltip_toggle_sidebar: "展开", tooltip_close_sidebar: "关闭",
            tooltip_upload: "上传附件", tooltip_send: "发送讯息",
            tooltip_mode_chat: "对话模式", tooltip_mode_live2d: "Live2D 模式",
            placeholder_input: "在这里输入讯息...",
            login_header: `${svgUser} 帐号登入`, placeholder_username: "帐号", placeholder_password: "密码",
            login_error: "帐号 or 密码错误！", login_btn: "登入",
            settings_header: `${svgSettings} 系统设定`, settings_api_key: `${svgKey} Gemini API Key：`,
            settings_local_url: `${svgLink} 本地节点 URL：`, settings_local_model: `${svgBot} 本地模型名称：`,
            placeholder_local_url: "例如 https://xxx.abc.com", placeholder_local_model: "例如 gemma4:12b",
            placeholder_api_key: "输入您的 API 密钥",
            settings_theme: "🌗 外观主题：", theme_auto: "跟随系统 (Auto)",
            theme_light: "浅色模式 (Light)", theme_dark: "深色模式 (Dark)",
            settings_success: `${svgCheck} 储存成功！`, settings_save_btn: "储存设定",
            live2d_subtitle: "点击右下角麦克风与我对话",
            voice_header: `${svgSettings} 语音对话设定`, voice_input_lang: `${svgMic} 您的输入语言：`,
            voice_output_lang: `${svgSpeaker} AI 语音输出：`, voice_text_lang: `${svgPen} 屏幕显示文字：`,
            settings_sakura: "🌸 樱花飘落特效：", sakura_on: "开启 (默认)", sakura_off: "关闭 (提升效能)", // 🌟 新增
            lang_cantonese: "广东话", lang_mandarin: "普通话", lang_japanese: "日文", lang_english: "英文",
            lang_chinese_text: "中文", lang_english_text: "英文", voice_start_btn: "确认并进入",
            model_gemini_desc: "回复最快", model_gemma_desc: "本地运算",
            err_no_api_key: `${svgWarn} 请先点击侧边栏设定 (${svgSettingsInline}) 填写您的 Gemini API Key。`,
            err_network: "系统连接错误。请确认后端服务器运行中。",
            btn_copy: `${svgCopy} 复制`, btn_copied: `${svgCheck} 已复制`, btn_copy_fail: `${svgFail} 失败`,
            upload_image: "图片", upload_file: "附件",
            tooltip_upload: "上传",
            l2d_mode_auto: `${svgMic} 直发模式`, l2d_mode_verify: `${svgPen} 校对模式`,
            l2d_placeholder_auto: "请按麦克风语音对话...",
            l2d_placeholder_verify: "输入后发送...",
            local_help_title: "❓ 本地大模型启动教学",
            local_help_s1_title: "步骤 1：启动 API 脚本",
            local_help_s1_desc: "在你的PC主机上，打开终端并执行脚本：",
            local_help_s2_title: "步骤 2：设置 Cloudflare Tunnel 穿透",
            local_help_s2_desc: "开启新终端，执行以下指令获取 Domain Name (网址)：",
            local_help_s2_note: "(或使用 run 指令绑定 你设定的域名)",
            local_help_s3_title: "步骤 3：填写设定参数",
            local_help_s3_url_title: "API 网址：",
            local_help_s3_url_desc: "贴上刚才获取的 HTTPS 网址。",
            local_help_s3_model_title: "模型名称：",
            local_help_s3_model_desc: "填写PC上已存在的模型。",
            l2d_placeholder_verify: "输入后发送...",
            l2d_loading_text: "模型载入中，请稍候...", // 🌟 新增簡體
            local_help_title: "❓ 本地大模型启动教学",
            tooltip_l2d_history: "Live2D 聊天记录", l2d_history_title: "聊天记录",
            tooltip_l2d_auto: "语音直发", tooltip_l2d_verify: "打字校对",
            welcome_md: `您好！欢迎来到 **IVE HKIIT 开放日**！我是您的官方 **AI Chatbot 智能升学咨询助手**。\n\n香港专业教育学院（IVE）资讯科技学系已全新升级为 **香港资讯科技学院（HKIIT）**！在这里，我能为您提供各项热门的高级文凭 (Higher Diploma) 课程大纲、学费、入学要求，或是为您导航今天的开放日活动！\n\n**您可以试着这样问我：**\n* 课程内容：\`IT114126 数据科学及人工智能高级文凭学什么？\`\n* 入学条件：\`BA114037 房地产高级文凭有什么入学要求？\`\n* 交通导航：\`青衣 IVE 怎么去？\` \n\n请问今天有什么我可以帮到您？`
        }
    };

    // ===== 絲滑打字特效模組 =====
    let welcomeAnimInterval = null;

    function displayWelcomeMessage(animate = false) {
        clearInterval(welcomeAnimInterval);
        dom.chatHistory.innerHTML = '';
        
        const div = document.createElement('div');
        div.className = 'message ai-message slide-up';
        const avatar = document.createElement('div');
        avatar.className = 'ai-avatar'; avatar.innerText = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper';
        const content = document.createElement('div');
        content.className = 'msg-content';
        
        wrapper.appendChild(content); 
        div.appendChild(avatar); 
        div.appendChild(wrapper);
        dom.chatHistory.appendChild(div);

        const mdText = translations[appSettings.appLang || 'en'].welcome_md;

        if (!animate) {
            content.innerHTML = marked.parse(mdText);
            return;
        }

        content.innerHTML = '';
        let i = 0;
        const speed = 3; 
        
        welcomeAnimInterval = setInterval(() => {
            if (i < mdText.length) {
                i += speed;
                const currentStr = mdText.substring(0, i);
                content.innerHTML = marked.parse(currentStr) + '<span class="typing-cursor"> </span>';
                smoothScrollToBottom();
            } else {
                clearInterval(welcomeAnimInterval);
                content.innerHTML = marked.parse(mdText);
            }
        }, 15);
    }

    function applyLanguage() {
        const lang = appSettings.appLang || 'en';
        const dict = translations[lang];

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key === 'login' && currentUser) return; 
            if (key === 'btn_copy' && el.classList.contains('success')) return; 

            if (dict[key]) el.innerHTML = dict[key];
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (dict[key]) el.placeholder = dict[key];
        });

        document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
            const key = el.getAttribute('data-i18n-tooltip');
            if (dict[key]) el.setAttribute('data-tooltip', dict[key]);
        });

        if (dom.langDropdownItems) {
            dom.langDropdownItems.forEach(item => {
                if (item.getAttribute('data-value') === lang) item.classList.add('active');
                else item.classList.remove('active');
            });
        }

        if (currentMessages.length === 0) {
            displayWelcomeMessage(false);
        }
    }

    // ==========================================
    // 2. 帳號同步、側邊欄與新版下拉選單
    // ==========================================
    let currentUser = localStorage.getItem('hkiit_current_user');
    
    if (currentUser) {
        dom.btnLogin.querySelector('span').innerText = currentUser;
        fetch('/api/get_key', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({username: currentUser})
        }).then(r => r.json()).then(data => {
            if (data.status === 'success') {
                // 🌟 同步載入雲端的所有設定
                appSettings.apiKey = data.api_key || ""; 
                appSettings.localUrl = data.local_url || "";
                appSettings.localModel = data.local_model_name || "gemma4:12b";
                
                localStorage.setItem('hkiit_settings', JSON.stringify(appSettings));
                updateModelBadge();
            }
        }).catch(e => console.log("[錯誤] 背景同步失敗:", e));
    }

    // 模型選單觸發
    dom.dropdownTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.dropdownMenu.classList.toggle('hidden');
        dom.langDropdownMenu.classList.add('hidden'); // 互斥關閉
    });

    // 語言選單觸發
    dom.langDropdownTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.langDropdownMenu.classList.toggle('hidden');
        dom.dropdownMenu.classList.add('hidden'); // 互斥關閉
    });

    document.addEventListener('click', (e) => {
        if (!dom.dropdownMenu.contains(e.target) && !dom.dropdownTrigger.contains(e.target)) {
            dom.dropdownMenu.classList.add('hidden');
        }
        if (!dom.langDropdownMenu.contains(e.target) && !dom.langDropdownTrigger.contains(e.target)) {
            dom.langDropdownMenu.classList.add('hidden');
        }
    });

    // 模型選擇監聽
    dom.dropdownItems.forEach(item => {
        item.addEventListener('click', () => {
            const newModel = item.getAttribute('data-value');
            
            // 🌟 終極修復 2：如果發現使用者切換了模型，強制開啟新對話清空緩存！
            if (appSettings.model !== newModel) {
                appSettings.model = newModel;
                localStorage.setItem('hkiit_settings', JSON.stringify(appSettings));
                updateModelBadge();
            }
            dom.dropdownMenu.classList.add('hidden');
        });
    });

    // 語言選擇監聽 (確保放置於全域作用域)
    dom.langDropdownItems.forEach(item => {
        item.addEventListener('click', () => {
            appSettings.appLang = item.getAttribute('data-value');
            localStorage.setItem('hkiit_settings', JSON.stringify(appSettings));
            applyLanguage();
            // 👇 修復：如果是對話模式才刷新聊天紀錄，Live2D 模式只更新文字不重置
            if (currentMode === 'chat') {
                startNewChat(); 
            } else {
                setupLive2DControls(); // 刷新 Live2D 控制列的翻譯
            }
            dom.langDropdownMenu.classList.add('hidden');
        });
    });

    function closeSidebarHandler() {
        dom.sidebar.classList.add('closed');
        dom.sidebarOverlay.classList.add('hidden');
    }

    dom.btnToggleSidebar.addEventListener('click', () => { 
        dom.sidebar.classList.remove('closed'); 
        dom.sidebarOverlay.classList.remove('hidden'); 
    });

    dom.sidebarOverlay.addEventListener('click', closeSidebarHandler);
    dom.btnCloseSidebar.addEventListener('click', closeSidebarHandler);
    
    dom.btnNewChat.addEventListener('click', () => { 
        startNewChat(); 
        closeSidebarHandler(); 
    });

    dom.btnSettings.addEventListener('click', () => {
        dom.inpApiKey.value = appSettings.apiKey || '';
        dom.inputLocalUrl.value = appSettings.localUrl || '';
        dom.inputLocalModel.value = appSettings.localModel || 'gemma4:12b';
        dom.selTheme.value = appSettings.theme || 'auto';

        // 🌟 1. 讀取目前的櫻花設定值
        const selSakura = document.getElementById('sel-sakura-effect');
        if (selSakura) {
            selSakura.value = appSettings.sakuraEffect === false ? 'off' : 'on';
        }

        // 🌟 2. 智慧判斷：如果目前是 Live2D 模式，就顯示櫻花開關；否則隱藏！
        const sakuraGroup = document.getElementById('sakura-setting-group');
        if (sakuraGroup) {
            if (currentMode === 'live2d') {
                sakuraGroup.classList.remove('hidden');
            } else {
                sakuraGroup.classList.add('hidden');
            }
        }

        dom.settingsModal.classList.remove('hidden');
        closeSidebarHandler();
    });

    document.getElementById('btn-local-help').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('local-help-modal').classList.remove('hidden');
    });
    
    document.getElementById('close-local-help').addEventListener('click', () => {
        document.getElementById('local-help-modal').classList.add('hidden');
    });

    document.getElementById('close-settings').addEventListener('click', () => {
        dom.settingsModal.classList.add('hidden');
    });

    dom.btnLogin.addEventListener('click', () => {
        if (currentUser) {
            if (confirm('確定要登出嗎？')) {
                currentUser = null; 
                localStorage.removeItem('hkiit_current_user');
                dom.btnLogin.querySelector('span').innerText = '登入';
                appSettings.apiKey = ''; 
                appSettings.localUrl = '';
                appSettings.localModel = 'gemma4:12b';
                localStorage.setItem('hkiit_settings', JSON.stringify(appSettings));
                updateModelBadge();
            }
        } else { 
            dom.loginModal.classList.remove('hidden'); 
            closeSidebarHandler(); 
        }
    });
    
    dom.closeLogin.addEventListener('click', () => dom.loginModal.classList.add('hidden'));

    dom.btnDoLogin.addEventListener('click', async () => {
        const user = dom.inpUsername.value.trim();
        const pass = dom.inpPassword.value;
        dom.loginError.style.display = 'none'; 

        try {
            const res = await fetch('/api/login', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });
            const data = await res.json();
            
            if (data.status === 'success') {
                currentUser = user; 
                localStorage.setItem('hkiit_current_user', user);
                dom.btnLogin.querySelector('span').innerText = user;
                
                // 🌟 登入成功時，立刻覆蓋本地設定為 MongoDB 的資料
                appSettings.apiKey = data.api_key || ""; 
                appSettings.localUrl = data.local_url || "";
                appSettings.localModel = data.local_model_name || "gemma4:12b";
                
                localStorage.setItem('hkiit_settings', JSON.stringify(appSettings));
                updateModelBadge();
                
                const welcomeBackStr = appSettings.appLang === 'en' ? `✅ Welcome back, ${user}!` :
                                      (appSettings.appLang === 'zh-CN' ? `✅ 欢迎回来，${user}！` : `✅ 歡迎回來，${user}！`);
                
                dom.loginSuccess.innerText = welcomeBackStr;
                dom.loginSuccess.style.display = 'block';
                dom.btnDoLogin.style.display = 'none'; 
                
                setTimeout(() => {
                    dom.loginModal.classList.add('hidden'); 
                    dom.inpPassword.value = ''; 
                    dom.loginSuccess.style.display = 'none';
                    dom.btnDoLogin.style.display = 'block'; 
                }, 1500);
                
            } else {
                dom.loginError.style.display = 'block'; 
            }
        } catch(e) { 
            dom.loginError.style.display = 'block'; 
        }
    });

    document.getElementById('btn-save-settings').addEventListener('click', async () => {
        const newLocalModel = dom.inputLocalModel.value.trim();

        appSettings.apiKey = dom.inpApiKey.value.trim(); 
        appSettings.localUrl = dom.inputLocalUrl.value.trim();
        appSettings.localModel = newLocalModel;
        appSettings.theme = dom.selTheme.value;

        // 🌟 1. 新增：儲存櫻花開關狀態
        const selSakura = document.getElementById('sel-sakura-effect');
        if (selSakura) {
            appSettings.sakuraEffect = (selSakura.value === 'on');
        }

        localStorage.setItem('hkiit_settings', JSON.stringify(appSettings));
        
        if (currentUser) {
            try {
                // 儲存設定時，把所有的 API 與 URL 參數一起打包上傳到 MongoDB
                await fetch('/api/save_key', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: currentUser, 
                        api_key: appSettings.apiKey,
                        local_url: appSettings.localUrl,
                        local_model_name: appSettings.localModel
                    })
                });
            } catch(e) {}
        }
        applyTheme(); updateModelBadge(); 

        // 🌟 2. 新增：如果處於 Live2D 模式，儲存後立刻呼叫引擎，即時開啟或關閉櫻花！
        if (currentMode === 'live2d' && window.toggleSakuraPetals) {
            window.toggleSakuraPetals();
        }
        
        dom.settingsSuccess.style.display = 'block';
        setTimeout(() => { dom.settingsSuccess.style.display = 'none'; }, 2000); 
    });

    dom.closeLangModal.addEventListener('click', () => {
        dom.langModal.classList.add('hidden');
        
        // 🌟 修正 2：如果用戶是在 Chat 模式下第一次點擊 Live2D 卻反悔，才切回 Chat。
        // 如果已經在 Live2D 模式中打開設定，按 X 就什麼都不做，完美留在 Live2D！
        if (currentMode === 'chat') {
            switchMode('chat');
        }
    });

    // ==========================================
    // 3. UI 初始化
    // ==========================================
    const savedSettings = localStorage.getItem('hkiit_settings');
    if (savedSettings) appSettings = { ...appSettings, ...JSON.parse(savedSettings) };
 
    applyLanguage();
    applyTheme();
    updateModelBadge();
  
    if (chatSessions.length > 0) {
        loadSession(chatSessions[0].id);
    } else {
        startNewChat();
    }

    function applyTheme() {
        document.documentElement.removeAttribute('data-theme');
        if (appSettings.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
        else if (appSettings.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    }
    
    function updateModelBadge() {
        try {
            let displayModelName = appSettings.localModel || 'gemma4:12b';
            let formattedName = displayModelName.split(':').map((part, index) => {
                if (index === 0) {
                    let capitalized = part.charAt(0).toUpperCase() + part.slice(1);
                    return capitalized.replace(/([a-zA-Z])(\d)/g, '$1 $2');
                }
                return part.toUpperCase();
            }).join(' ');

            if (dom.dropdownItems) {
                dom.dropdownItems.forEach(i => {
                    // 👇 🌟 核心修復：使用 textContent 代替 innerText！
                    // 因為隱藏狀態下的 DOM，innerText 會回傳空字串，導致文字消失。
                    let titleSpan = i.querySelector('.item-title');
                    let titleText = titleSpan ? titleSpan.textContent : i.textContent.trim();

                    if (i.getAttribute('data-value') === 'gemma' && titleSpan) {
                        titleSpan.textContent = formattedName;
                        titleText = formattedName; 
                    }

                    if(i.getAttribute('data-value') === appSettings.model) {
                        i.classList.add('active');
                        if(dom.selectedModelName) {
                            dom.selectedModelName.textContent = titleText; // 🌟 這裡也改為 textContent
                        }
                    } else {
                        i.classList.remove('active');
                    }
                });
            }
            
            if (dom.inpApiKey) dom.inpApiKey.value = appSettings.apiKey || '';
            if (dom.inputLocalUrl) dom.inputLocalUrl.value = appSettings.localUrl || '';
            if (dom.inputLocalModel) dom.inputLocalModel.value = appSettings.localModel || 'gemma4:12b';
            if (dom.selTheme) dom.selTheme.value = appSettings.theme || 'auto';

            if (dom.apiKeyContainer && dom.localNodeContainer) {
                if (appSettings.model === 'gemini' || appSettings.model === 'groq') {
                    dom.apiKeyContainer.style.display = 'block';
                    dom.localNodeContainer.style.display = 'none';
                } else if (appSettings.model === 'gemma') {
                    dom.apiKeyContainer.style.display = 'none';
                    dom.localNodeContainer.style.display = 'block';
                } else {
                    dom.apiKeyContainer.style.display = 'none';
                    dom.localNodeContainer.style.display = 'none';
                }
            }
        } catch (e) {
            console.error("模型名稱更新攔截:", e);
        }
    }

    // ==========================================
    // 4. 對話歷史管理
    // ==========================================
    function startNewChat() {
        currentSessionId = Date.now();
        currentMessages = [];
        live2dMessages = [];
        displayWelcomeMessage(true); 
        fileContentBuffer = "";
        dom.uploadPreview.classList.add('hidden');
        renderSidebar();
        // 🌟 順便強制隱藏畫面上的 Live2D 對話氣泡與字幕
        const bubble = document.getElementById('live2d-speech-bubble');
        if (bubble) bubble.classList.add('hidden');
        if (dom.live2dSubtitle) dom.live2dSubtitle.innerText = "";
    }

    function saveSession() {
        if (currentMessages.length === 0) return;
        let title = "新對話";
        const firstUserMsg = currentMessages.find(m => m.role === 'user');
        if (firstUserMsg) {
            title = firstUserMsg.content.replace(/\[傳送了參考檔案\]/, '📁 檔案對話').substring(0, 15);
        }
        const sessionData = { id: currentSessionId, title: title, messages: currentMessages };
        const idx = chatSessions.findIndex(s => s.id === currentSessionId);
        
        if (idx >= 0) {
            chatSessions[idx] = sessionData;
        } else {
            chatSessions.unshift(sessionData);
        }
        
        if (chatSessions.length > 10) { chatSessions.pop(); }

        try {
            localStorage.setItem('hkiit_chat_sessions', JSON.stringify(chatSessions));
            renderSidebar();
        } catch (e) {
            console.warn("⚠️ 快取空間有限，正在為歷史紀錄進行大圖 Base64 降維壓縮...");
            // 🌟 空間防護鎖：若空間爆滿，僅清除過往對話中沉重的圖片 base64 字串，保留檔名標籤，確保網站絕不崩潰！
            chatSessions.forEach(s => {
                s.messages.forEach(m => {
                    if (m.file && m.file.type === 'image') m.file.data = ""; 
                });
            });
            try {
                localStorage.setItem('hkiit_chat_sessions', JSON.stringify(chatSessions));
                renderSidebar();
            } catch (err) {}
        }
    }

    function renderSidebar() {
        dom.historyList.innerHTML = '';
        chatSessions.forEach(session => {
            const li = document.createElement('li');
            li.className = `history-item ${session.id === currentSessionId ? 'active' : ''}`;
            li.innerText = session.title;
            li.onclick = () => loadSession(session.id);
            dom.historyList.appendChild(li);
        });
    }

    function loadSession(id) {
        const session = chatSessions.find(s => s.id === id);
        if (!session) return;
        currentSessionId = id;
        currentMessages = session.messages;
        dom.chatHistory.innerHTML = ''; 
        
        displayWelcomeMessage(false); 
        
        // 🌟 核心修改：載入歷史對話時，同步將攜帶的檔案還原到畫面上！
        currentMessages.forEach(msg => appendMessageUI(msg.content, msg.role, false, msg.file)); 
        
        renderSidebar();
        closeSidebarHandler();
        setTimeout(smoothScrollToBottom, 100); 
    }

    // ==========================================
    // 5. 複製功能與 UI 渲染
    // ==========================================
    function copyTextToClipboard(text, btn) {
        const dict = translations[appSettings.appLang || 'en'];
        const copyText = dict.btn_copy.replace(/<[^>]*>?/gm, '').trim();
        const copiedText = dict.btn_copied.replace(/<[^>]*>?/gm, '').trim();
        const failText = dict.btn_copy_fail.replace(/<[^>]*>?/gm, '').trim();

        function showSuccess() {
            btn.classList.add('success');
            btn.innerHTML = svgCheck; // 🌟 只放 SVG
            btn.setAttribute('data-tooltip', copiedText); 
            setTimeout(() => { 
                btn.classList.remove('success'); 
                btn.innerHTML = svgCopy; 
                btn.setAttribute('data-tooltip', copyText); 
            }, 1800); 
        }

        function showError(errMessage) {
            alert("複製失敗: " + errMessage);
            btn.innerHTML = svgFail; // 🌟 只放 SVG
            btn.setAttribute('data-tooltip', failText); 
            setTimeout(() => { 
                btn.innerHTML = svgCopy; 
                btn.setAttribute('data-tooltip', copyText); 
            }, 1800);
        }
        // ... (下方 navigator.clipboard 保留不動)

        function showError(errMessage) {
            // 在手機上彈出真實錯誤原因，方便你 Debug
            alert("複製失敗: " + errMessage);
            btn.innerHTML = dict.btn_copy_fail;
            setTimeout(() => { btn.innerHTML = dict.btn_copy; }, 1800);
        }

        // 1. 嘗試現代 API (需 HTTPS + 同步觸發)
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(showSuccess)
                .catch(err => {
                    console.warn("Clipboard API failed, trying fallback...", err);
                    fallbackCopy(text); // 如果被非同步阻擋或權限問題，轉交給降級方案
                });
        } else {
            fallbackCopy(text);
        }

        // 2. 針對 iOS 極度優化的降級方案
        function fallbackCopy(textToCopy) {
            let textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            
            // iOS 黑魔法：必須設為 contentEditable = true 且 readOnly = false 才能被順利全選
            textArea.contentEditable = true;
            textArea.readOnly = false;
            
            // 隱藏元素的絕對安全寫法
            textArea.style.position = 'fixed';
            textArea.style.top = '-9999px';
            textArea.style.left = '-9999px';
            textArea.style.width = '2em';
            textArea.style.height = '2em';
            
            document.body.appendChild(textArea);

            try {
                // 針對 iOS 設備的選取邏輯
                if (navigator.userAgent.match(/ipad|iphone/i)) {
                    let range = document.createRange();
                    range.selectNodeContents(textArea);
                    let selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                    textArea.setSelectionRange(0, 999999);
                } else {
                    textArea.focus();
                    textArea.select();
                }

                const successful = document.execCommand('copy');
                if (successful) {
                    showSuccess();
                } else {
                    showError("execCommand 回傳 false (可能被瀏覽器安全機制攔截)");
                }
            } catch (err) {
                showError("例外錯誤: " + err.message);
            } finally {
                document.body.removeChild(textArea);
            }
        }
    }

    function appendMessageUI(rawText, role, animate = true, fileObj = null) {
        const dict = translations[appSettings.appLang || 'en']; // 🛑 核心修復點：防止腳本崩潰
        if (!rawText) return;
        const div = document.createElement('div');
        div.className = `message ${animate ? 'slide-up' : ''} ${role === 'user' ? 'user-message' : 'ai-message'}`;

        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper';

        const content = document.createElement('div');
        content.className = 'msg-content';
        let cleanText = rawText;
        
        // 🌟 同步升級正則防禦
        const voiceRegex = /\[\s*VOICE\s*\]([\s\S]*?)(?:\[\s*\/\s*VOICE\s*\]|$)/i;
        const textRegex = /\[\s*TEXT\s*\]([\s\S]*?)(?:\[\s*\/\s*TEXT\s*\]|$)/i;
        
        if (textRegex.test(cleanText)) {
            cleanText = cleanText.match(textRegex)[1].trim();
        } else if (voiceRegex.test(cleanText)) {
            cleanText = cleanText.replace(voiceRegex, '').trim();
        }
        
        // 🌟 終極防禦洗淨
        cleanText = cleanText.replace(/\[\s*\/?\s*(VOICE|TEXT)\s*\]/gi, '').trim();
        
        content.innerHTML = role === 'user' ? rawText.replace(/\n/g, '<br>') : marked.parse(cleanText);
        content.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));

        // =======================================================
        // 🌟 核心新增：如果訊息內包含檔案物件，將其優雅地渲染在文字最上方
        // =======================================================
        if (fileObj) {
            if (fileObj.type === 'image') {
                if (fileObj.data) {
                    const imgEl = document.createElement('img');
                    imgEl.src = fileObj.data;
                    imgEl.style.maxWidth = '180px';
                    imgEl.style.maxHeight = '180px';
                    imgEl.style.borderRadius = '12px';
                    imgEl.style.display = 'block';
                    imgEl.style.marginBottom = '8px';
                    imgEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                    imgEl.style.cursor = 'pointer';
                    // 點擊可以放大全螢幕檢視圖片
                    // 🌟 點擊觸發 Gemini 風格的懸浮圖片放大鏡 (Lightbox)
                    imgEl.onclick = () => {
                        // 檢查畫面中是否已經有放大鏡容器，沒有就現場造一個
                        let lightbox = document.getElementById('hkiit-image-lightbox');
                        if (!lightbox) {
                            lightbox = document.createElement('div');
                            lightbox.id = 'hkiit-image-lightbox';
                            lightbox.className = 'image-lightbox-overlay';
                            
                            const closeBtn = document.createElement('div');
                            closeBtn.className = 'image-lightbox-close';
                            closeBtn.innerHTML = '×';
                            
                            const img = document.createElement('img');
                            img.className = 'image-lightbox-content';
                            
                            lightbox.appendChild(closeBtn);
                            lightbox.appendChild(img);
                            document.body.appendChild(lightbox);
                            
                            // 點擊背景或關閉按鈕時，收起放大鏡
                            lightbox.onclick = () => {
                                lightbox.classList.remove('active');
                            };
                        }
                        
                        // 將當前點擊的圖片數據塞入放大鏡中
                        const lightboxImg = lightbox.querySelector('.image-lightbox-content');
                        lightboxImg.src = fileObj.data;
                        
                        // 防止點擊事件冒泡，並呼叫瀏覽器在下一幀渲染動畫
                        requestAnimationFrame(() => {
                            lightbox.classList.add('active');
                        });
                    };
                    content.insertBefore(imgEl, content.firstChild);
                } else {
                    // 快取空間飽和降維後的優雅小標籤
                    const imgFallback = document.createElement('div');
                    imgFallback.style.fontSize = '13px'; imgFallback.style.opacity = '0.7'; imgFallback.style.marginBottom = '6px';
                    imgFallback.innerText = `🖼️ 圖片: ${fileObj.name} (已成功上傳)`;
                    content.insertBefore(imgFallback, content.firstChild);
                }
            } else if (fileObj.type === 'file') {
                const fileBox = document.createElement('div');
                fileBox.style.display = 'flex'; fileBox.style.alignItems = 'center'; fileBox.style.gap = '6px';
                fileBox.style.padding = '6px 12px'; 
                // 根據使用者或 AI 自動變更適配底色
                fileBox.style.background = role === 'user' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(128, 128, 128, 0.1)';
                fileBox.style.borderRadius = '10px'; fileBox.style.marginBottom = '8px'; fileBox.style.fontSize = '13px';
                fileBox.style.width = 'max-content'; fileBox.style.maxWidth = '100%';
                fileBox.innerHTML = `📄 <span style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${fileObj.name}</span>`;
                content.insertBefore(fileBox, content.firstChild);
            }
        }

        const footer = document.createElement('div');
        footer.className = 'msg-footer';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        
        // 🌟 防禦型抓取字典，只保留 SVG 並加上 hover 介紹框
        const dictSafe = translations[appSettings.appLang || 'en'];
        const btnCopyRaw = dictSafe ? dictSafe.btn_copy : "Copy";
        const copyText = btnCopyRaw ? btnCopyRaw.replace(/<[^>]*>?/gm, '').trim() : "Copy";
        
        copyBtn.innerHTML = typeof svgCopy !== 'undefined' ? svgCopy : "📋";
        copyBtn.setAttribute('data-tooltip', copyText);
        if (window.bindTooltipEvents) window.bindTooltipEvents(copyBtn); 
        
        copyBtn.onclick = () => copyTextToClipboard(rawText, copyBtn);
        footer.appendChild(copyBtn);
        
        wrapper.appendChild(content);
        wrapper.appendChild(footer);

        if (role === 'ai') {
            const avatar = document.createElement('div');
            avatar.className = 'ai-avatar'; avatar.innerText = '';
            div.appendChild(avatar);
        }
        div.appendChild(wrapper);
        
        dom.chatHistory.appendChild(div);
        smoothScrollToBottom();
    }


    // ==========================================
    // 6. 核心串流發送邏輯
    // ==========================================
    async function sendMessage(text) {
        const dict = translations[appSettings.appLang || 'en'];

        if (!text.trim() && !fileContentBuffer) return;
        if (isProcessingRequest) return;
        isProcessingRequest = true;

        const lowerText = text.trim().toLowerCase();
        if (lowerText === "clear system cache" || lowerText === "強制清除緩存") {
            alert("🚨 收到強制清除指令！正在抹除本地所有緩存並重啟系統...");
            localStorage.clear(); window.location.reload(); return;
        }

        const userText = text.trim() ? text : ` `;
        
        let currentFilePayload = null;
        if (attachedFile) {
            currentFilePayload = { name: attachedFile.name, type: attachedFile.type, data: attachedFile.data };
        }

        // 🌟 核心修復：提取完檔案數據後，立刻呼叫引擎瞬間洗淨畫面的預覽縮圖！
        if (window.clearAttachment) window.clearAttachment();

        let msgObj = { role: 'user', content: userText };
        if (currentFilePayload) {
            msgObj.file = { ...currentFilePayload };
        }
        currentMessages.push(msgObj);
        saveSession();
        
        appendMessageUI(userText, 'user', true, currentFilePayload); 
        
        dom.chatInput.value = '';
        dom.chatInput.style.height = 'auto'; 

        if (appSettings.model === 'gemini' && !appSettings.apiKey) {
            appendMessageUI(dict.err_no_api_key, 'ai');
            isProcessingRequest = false; 
            return;
        }

        const div = document.createElement('div');
        div.className = 'message ai-message slide-up';
        const avatar = document.createElement('div');
        avatar.className = 'ai-avatar'; avatar.innerText = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper';
        const content = document.createElement('div');
        content.className = 'msg-content';
        content.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
        
        wrapper.appendChild(content); div.appendChild(avatar); div.appendChild(wrapper);
        dom.chatHistory.appendChild(div);
        
        smoothScrollToBottom();
        dom.header.classList.remove('hide-up');
        
        const recentHistory = currentMessages.slice(0, -1).slice(-5);

        const requestBody = {
            message: text, 
            history: recentHistory, 
            mode: currentMode, 
            input_lang: appSettings.inputLang, output_lang: appSettings.outputLang, text_lang: appSettings.textLang,
            ai_model: appSettings.model, api_key: appSettings.apiKey, 
            file_context: currentFilePayload ? currentFilePayload.data : "", // 🌟 重點防禦：從安全載體讀取
            local_url: appSettings.localUrl,
            local_model_name: appSettings.localModel,
            app_lang: appSettings.appLang
        };

        try {
            const response = await fetch('/api/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error(`Server Error: ${response.status}`);
            
            const reader = response.body.getReader();
            // ... (下方的 const decoder = new TextDecoder... 保持原樣不動)
            const decoder = new TextDecoder("utf-8");
            let aiTextContent = "";
            let isFirstChunk = true;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunkString = decoder.decode(value, { stream: true });
                const lines = chunkString.split("\n\n");
                
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const dataStr = line.substring(6);
                        if (dataStr === "[DONE]") break;
                        try {
                            const dataObj = JSON.parse(dataStr);
                            
                            // 👇 新增這個判斷：一旦抓到後端的特製標籤，立刻引爆清空緩存！
                            if (dataObj.text && dataObj.text.includes('[CLEAR_LOCAL_STORAGE]')) {
                                alert(dataObj.text.replace('[CLEAR_LOCAL_STORAGE]', ''));
                                localStorage.clear(); // 💥 抹除包括對話紀錄、API Key、主題等所有緩存
                                window.location.reload(); // 🔄 強制刷洗網頁
                                return;
                            }
                            
                            // ... (在 dataObj.text 判斷之後)
                            aiTextContent += dataObj.text;
                            
                            // 🌟 即時淨化串流文字，防止使用者在打字過程中看到標籤
                            let liveCleanText = aiTextContent;
                            const liveTextRegex = /\[\s*TEXT\s*\]([\s\S]*?)(?:\[\s*\/\s*TEXT\s*\]|$)/i;
                            const liveVoiceRegex = /\[\s*VOICE\s*\]([\s\S]*?)(?:\[\s*\/\s*VOICE\s*\]|$)/i;

                            if (liveTextRegex.test(liveCleanText)) {
                                liveCleanText = liveCleanText.match(liveTextRegex)[1];
                            } else if (liveVoiceRegex.test(liveCleanText)) {
                                liveCleanText = liveCleanText.replace(liveVoiceRegex, '');
                            }
                            
                            // 暴力刮除尚未閉合或已閉合的標籤
                            liveCleanText = liveCleanText.replace(/\[\s*\/?\s*(VOICE|TEXT)\s*\]/gi, '').trim();

                            // 串流初期如果正在生成 VOICE 標籤，畫面先顯示思考中
                            if (liveCleanText === "" && liveVoiceRegex.test(aiTextContent)) {
                                liveCleanText = "💭 思考中...";
                            }
                            
                            if (currentMode === 'chat') {
                                if (isFirstChunk) { content.innerHTML = ""; isFirstChunk = false; }
                                content.innerHTML = marked.parse(liveCleanText);
                                smoothScrollToBottom(); 
                            } else {
                                dom.live2dSubtitle.innerText = liveCleanText;
                            }
                        } catch (e) {}
                    }
                }
            }

            content.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
            currentMessages.push({role: 'ai', content: aiTextContent});
            saveSession();

            const footer = document.createElement('div');
            footer.className = 'msg-footer';
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn slide-up'; 
            
            const dictSafe = translations[appSettings.appLang || 'en'];
            const btnCopyRaw = dictSafe ? dictSafe.btn_copy : "Copy";
            const copyText = btnCopyRaw ? btnCopyRaw.replace(/<[^>]*>?/gm, '').trim() : "Copy";
            
            copyBtn.innerHTML = typeof svgCopy !== 'undefined' ? svgCopy : "📋";
            copyBtn.setAttribute('data-tooltip', copyText);
            if (window.bindTooltipEvents) window.bindTooltipEvents(copyBtn);
            
            copyBtn.onclick = () => copyTextToClipboard(aiTextContent, copyBtn);
            footer.appendChild(copyBtn);
            wrapper.appendChild(footer);
            

        } catch (err) {
            console.error("Chat Mode Error:", err);
            // 🌟 溫和的錯誤處理：如果已經有生成文字，就把錯誤訊息「加在下面」，而不是清空畫面！
            if (typeof aiTextContent !== 'undefined' && aiTextContent.length > 0) {
                content.innerHTML += `<br><br><span style="color:#ff3b30; font-weight:bold;">⚠️ 系統提示：${dict.err_network}</span>`;
            } else {
                content.innerText = dict.err_network;
            }
        } finally {
            // 🌟 極度重要：不管成功還是失敗 (Error)，最後一定要解除防連點鎖！
            isProcessingRequest = false;
        }
    }

    // =======================================================
    // 🌟 手機版終極防呆：獨立計時器、支援電腦模擬、無震動
    // =======================================================
    let isTouchDevice = false; // 全域標記是否使用觸控

    // 將 Tooltip 邏輯封裝，方便給後續新加入的按鈕綁定
    window.bindTooltipEvents = function(btn) {
        if (btn.hasTooltipBound) return; // 防止重複綁定
        btn.hasTooltipBound = true;
        
        let pressTimer = null;
        let isLongPress = false;

        const startPress = (e) => {
            if (window.innerWidth > 768) return; 
            if (e.type === 'touchstart') isTouchDevice = true;
            if (e.type === 'mousedown' && isTouchDevice) return;

            isLongPress = false;
            clearTimeout(pressTimer);
            
            document.querySelectorAll('.mobile-show-tooltip').forEach(b => {
                if (b !== btn) b.classList.remove('mobile-show-tooltip');
            });
            
            pressTimer = setTimeout(() => {
                isLongPress = true;
                btn.classList.add('mobile-show-tooltip'); 
            }, 400); 
        };

        const cancelPress = () => {
            if (window.innerWidth > 768) return;
            clearTimeout(pressTimer);
            if (!isLongPress) btn.classList.remove('mobile-show-tooltip');
        };

        const endPress = (e) => {
            if (window.innerWidth > 768) return;
            clearTimeout(pressTimer);
            if (isLongPress) {
                if (e.cancelable) e.preventDefault(); 
                setTimeout(() => btn.classList.remove('mobile-show-tooltip'), 1500);
            } else {
                btn.classList.remove('mobile-show-tooltip');
            }
        };

        btn.addEventListener('touchstart', startPress, { passive: true });
        btn.addEventListener('touchmove', cancelPress, { passive: true });
        btn.addEventListener('touchend', endPress);
        btn.addEventListener('touchcancel', cancelPress);
        btn.addEventListener('mousedown', startPress);
        btn.addEventListener('mouseleave', cancelPress);
        btn.addEventListener('mouseup', endPress);
        btn.addEventListener('contextmenu', (e) => { if (window.innerWidth <= 768) e.preventDefault(); });
        btn.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && (isLongPress || btn.classList.contains('mobile-show-tooltip'))) {
                e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
            }
        }, true); 
    };

    // 初始化頁面上已有的 tooltip 元素
    document.querySelectorAll('[data-tooltip], [data-i18n-tooltip]').forEach(window.bindTooltipEvents);

    // ==========================================
    // 7. 其他事件綁定
    // ==========================================
    dom.chatSend.addEventListener('click', () => sendMessage(dom.chatInput.value));

    // 自動調整輸入框高度
    dom.chatInput.addEventListener('input', function() {
        this.style.height = 'auto'; 
        this.style.height = (this.scrollHeight) + 'px'; 
        if(this.value === '') this.style.height = 'auto'; 
    });
    
    // 完美的 Enter 鍵發送邏輯 (防中文選字送出，支援 Shift+Enter 換行)
    dom.chatInput.addEventListener('keydown', (e) => {
        // 防止中文輸入法拼音/注音選字時按下 Enter 意外送出
        if (e.isComposing || e.keyCode === 229) return;
        
        // 監聽 Enter 鍵
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // 阻止原本的換行
            sendMessage(dom.chatInput.value); 
            dom.chatInput.style.height = 'auto'; 
        }
    });

    // ===== 圖片與附件上拉式選單邏輯 =====
    const btnUploadToggle = document.getElementById('btn-upload-toggle');
    const uploadPopup = document.getElementById('upload-popup');
    const btnUploadImg = document.getElementById('btn-upload-img');
    const btnUploadFile = document.getElementById('btn-upload-file');
    const imageUpload = document.getElementById('image-upload');

    if (btnUploadToggle) {
        // 展開/收合上拉選單
        btnUploadToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            uploadPopup.classList.toggle('hidden');
        });

        // 點擊空白處關閉選單
        document.addEventListener('click', (e) => {
            if (!btnUploadToggle.contains(e.target) && !uploadPopup.contains(e.target)) {
                uploadPopup.classList.add('hidden');
            }
        });

        // 點擊附件選項
        btnUploadFile.addEventListener('click', () => {
            dom.fileUpload.click();
            uploadPopup.classList.add('hidden');
        });

        // 點擊圖片選項
        btnUploadImg.addEventListener('click', () => {
            imageUpload.click();
            uploadPopup.classList.add('hidden');
        });
    }

    // 🌟 全域取消附件引擎：供 X 按鈕呼叫，也供發送後瞬間清空呼叫
    window.clearAttachment = function(e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        attachedFile = null;
        fileContentBuffer = "";
        const upPreview = document.getElementById('upload-preview');
        if (upPreview) { upPreview.innerHTML = ""; upPreview.classList.add('hidden'); }
        const l2dPreview = document.getElementById('l2d-upload-preview');
        if (l2dPreview) { l2dPreview.innerHTML = ""; l2dPreview.classList.add('hidden'); }
    };

    if (imageUpload) {
        imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                fileContentBuffer = evt.target.result; 
                attachedFile = { name: file.name, type: 'image', data: evt.target.result }; 
                
                // 🌟 加入右上角紅色 X 刪除按鈕
                const thumbnailHtml = `
                    <div style="position: relative; display: inline-block;">
                        <img src="${evt.target.result}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px; display: block; box-shadow: 0 4px 12px rgba(0,0,0,0.2); border: 1px solid rgba(128,128,128,0.2);">
                        <div onclick="window.clearAttachment(event)" style="position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; background: #ff3b30; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.3); line-height: 1; padding-bottom: 2px;">×</div>
                    </div>`;

                if (currentMode === 'live2d') {
                    const l2dPreview = document.getElementById('l2d-upload-preview');
                    if (l2dPreview) { l2dPreview.innerHTML = thumbnailHtml; l2dPreview.classList.remove('hidden'); }
                } else {
                    dom.uploadPreview.innerHTML = thumbnailHtml; dom.uploadPreview.classList.remove('hidden');
                }
            };
            reader.readAsDataURL(file); 
            e.target.value = ''; 
        });
    }

    if (dom.fileUpload) {
        dom.fileUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                fileContentBuffer = evt.target.result;
                attachedFile = { name: file.name, type: 'file', data: evt.target.result }; 
                
                // 🌟 加入右上角紅色 X 刪除按鈕
                const fileHtml = `
                    <div style="position: relative; display: inline-block;">
                        <div style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: rgba(128, 128, 128, 0.15); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 1px solid var(--border-color);">
                            ${typeof svgFileIcon !== 'undefined' ? svgFileIcon : '📄'}
                        </div>
                        <div onclick="window.clearAttachment(event)" style="position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; background: #ff3b30; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.3); line-height: 1; padding-bottom: 2px;">×</div>
                    </div>`;

                if (currentMode === 'live2d') {
                    const l2dPreview = document.getElementById('l2d-upload-preview');
                    if (l2dPreview) { l2dPreview.innerHTML = fileHtml; l2dPreview.classList.remove('hidden'); }
                } else {
                    dom.uploadPreview.innerHTML = fileHtml; dom.uploadPreview.classList.remove('hidden');
                }
            };
            reader.readAsText(file); 
            e.target.value = ''; 
        });
    }

    // 處理一般文字/文檔附件上傳 (使用 SVG 替換 Emoji)
    dom.fileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            fileContentBuffer = evt.target.result;
            attachedFile = { name: file.name, type: 'file', data: evt.target.result }; 
            
            // 🌟 採用 SVG 圖示的文件預覽
            const fileHtml = `<div style="display:flex; align-items:center; gap:6px;">
                ${svgFileIcon}
                <span style="font-size:13px; font-weight:600;">已附加附件: <span style="font-weight:400; opacity:0.8; max-width:120px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:inline-block; vertical-align:bottom;">${file.name}</span></span>
            </div>`;

            if (currentMode === 'live2d') {
                const l2dPreview = document.getElementById('l2d-upload-preview');
                if (l2dPreview) {
                    l2dPreview.innerHTML = fileHtml;
                    l2dPreview.classList.remove('hidden');
                }
            } else {
                dom.uploadPreview.innerHTML = fileHtml;
                dom.uploadPreview.classList.remove('hidden');
            }
        };
        reader.readAsText(file); 
        e.target.value = ''; 
    });

    // ===== 模式切換 (Chat vs Live2D) =====
    function switchMode(targetMode) {
        if (targetMode === 'live2d') {
            dom.btnLive2DSettings.classList.remove('hidden'); 
            
            if (!appSettings.live2dLangSet) {
                dom.selOutputLang.disabled = false;
                dom.langModal.classList.remove('hidden');
            } else {
                dom.viewChat.classList.add('hidden'); 
                
                // 👇 🌟 修正 1-A：確保同時移除 'hidden' 和 'l2d-hidden'，防止第一次載入時 PIXI 抓到 0 寬高而黑屏！
                dom.viewLive2D.classList.remove('hidden', 'l2d-hidden'); 
                
                dom.btnModeLive2D.classList.add('active'); dom.btnModeChat.classList.remove('active');
                currentMode = 'live2d'; 

                if (!live2dApp) { 
                    initLive2D(); 
                } else { 
                    live2dApp.start(); 
                    // 切換回來時，確保畫布重繪與大小自適應
                    setTimeout(() => {
                        live2dApp.resize();
                        updateLive2DScale(live2dModelInstance);
                    }, 50); 
                }
            }
        } else {
            dom.btnLive2DSettings.classList.add('hidden'); 
            dom.viewChat.classList.remove('hidden'); 
            // 👇 離開時不殺死它，只隱藏
            dom.viewLive2D.classList.add('l2d-hidden'); 
            dom.btnModeChat.classList.add('active'); dom.btnModeLive2D.classList.remove('active');
            currentMode = 'chat'; smoothScrollToBottom();
            if (live2dApp) live2dApp.stop();
        }
    }
    dom.btnModeChat.addEventListener('click', () => switchMode('chat'));
    dom.btnModeLive2D.addEventListener('click', () => switchMode('live2d'));

    dom.btnStartLive2D.addEventListener('click', () => {
        appSettings.inputLang = dom.selInputLang.value; 
        appSettings.outputLang = dom.selOutputLang.value; 
        appSettings.textLang = dom.selTextLang.value;
        appSettings.live2dLangSet = true; 
        localStorage.setItem('hkiit_settings', JSON.stringify(appSettings)); 

        dom.langModal.classList.add('hidden'); 
        switchMode('live2d');
    });

    dom.btnLive2DSettings.addEventListener('click', () => {
        dom.selOutputLang.disabled = false;
        dom.selInputLang.value = appSettings.inputLang || 'cantonese';
        dom.selOutputLang.value = appSettings.outputLang || 'cantonese';
        dom.selTextLang.value = appSettings.textLang || 'chinese';
        dom.langModal.classList.remove('hidden');
        closeSidebarHandler();
    });

    function smoothScrollToBottom() { dom.chatHistory.scrollTo({ top: dom.chatHistory.scrollHeight, behavior: 'smooth' }); }

    // ==========================================
    // 🌟 Live2D 核心架構、語音識別與仿生模擬 (放這裡！)
    // ==========================================
    let l2dInputMode = 'auto'; 
    let recognition = null;
    let isSpeechRecording = false;
    let live2dModelInstance = null; 

    const sttLangMap = { 'cantonese': 'zh-HK', 'mandarin': 'zh-CN', 'japanese': 'ja-JP', 'english': 'en-US' };
    const ttsLangMap = { 'cantonese': 'zh-HK', 'mandarin': 'zh-CN', 'japanese': 'ja-JP', 'english': 'en-US' };

    function initWebSpeechAPI() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        // 🌟 防呆 1：如果瀏覽器不支援，或沒有使用 HTTPS (Web Speech 嚴格要求安全連線)
        if (!SpeechRecognition) {
            alert("⚠️ 您的瀏覽器不支援語音識別 (請使用 Chrome, Edge 或 Safari)，或請確保您正在使用 HTTPS 安全連線。");
            return false;
        }
        
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isSpeechRecording = true;
            document.getElementById('l2d-mic-btn').classList.add('recording');
        };

        recognition.onresult = (event) => {
            const resultText = event.results[0][0].transcript;
            const inputTextArea = document.getElementById('l2d-chat-input');
            inputTextArea.value = resultText;

            if (l2dInputMode === 'auto') {
                // 直發模式：直接呼叫後端發送
                sendLive2DMessage(resultText);
            }
        };

        // 🌟 防呆 2：捕捉各種權限與環境錯誤，並明確告知使用者
        recognition.onerror = (event) => {
            console.error("語音識別錯誤:", event.error);
            if (event.error === 'not-allowed') {
                alert("⚠️ 麥克風權限被拒絕！\n請在瀏覽器網址列左側點擊 🔒 (鎖頭) 圖示，允許麥克風存取後重整網頁。");
            } else if (event.error === 'network') {
                alert("⚠️ 語音識別需要網路連線，請檢查您的網路狀態。");
            }
            stopL2dRecognition();
        };

        recognition.onend = () => { 
            stopL2dRecognition(); 
        };
        
        return true;
    }

    // =======================================================
    // 🎤 終極強化版：拋棄式語音識別引擎 (徹底解決手機卡死問題)
    // =======================================================
    function toggleL2dSpeech() {
        // 1. 如果正在錄音中，點擊就是「停止」
        if (isSpeechRecording && recognition) {
            recognition.stop();
            return;
        }

        // 2. 檢查環境是否支援 (防呆：揪出非 HTTPS 連線)
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("⚠️ 無法啟動麥克風！\n原因 1：瀏覽器不支援 (請使用 Safari 或 Chrome)。\n原因 2：您目前未使用 HTTPS 安全連線 (手機端嚴格要求)。\n👉 解決方案：請確保您是用 Cloudflare Tunnel (https://...) 的網址開啟此網頁！");
            return;
        }

        // 3. 🌟 核心修復：每次都宣告一個「全新」的識別實例，徹底避開底層狀態卡死
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        
        // 套用使用者在設定面板選擇的語言
        recognition.lang = sttLangMap[appSettings.inputLang] || 'zh-HK';

        recognition.onstart = () => {
            isSpeechRecording = true;
            const micBtn = document.getElementById('l2d-mic-btn');
            if (micBtn) micBtn.classList.add('recording');
        };

        recognition.onresult = (event) => {
            const resultText = event.results[0][0].transcript;
            const inputTextArea = document.getElementById('l2d-chat-input');
            inputTextArea.value = resultText;

            // 如果是直發模式，拿到文字就直接送出
            if (l2dInputMode === 'auto') {
                sendLive2DMessage(resultText);
            }
        };

        recognition.onerror = (event) => {
            console.error("語音識別錯誤:", event.error);
            if (event.error === 'not-allowed') {
                alert("⚠️ 麥克風權限被拒絕！\n請在手機瀏覽器的網址列旁邊點擊「AA」或「鎖頭」圖示，手動允許網站存取麥克風。");
            } else if (event.error === 'network') {
                alert("⚠️ 語音識別需要網路連線，或您的系統正處於省電/隱私阻擋模式。");
            }
            // no-speech (沒講話) 屬於正常現象，不跳警告，直接安靜關閉即可
            stopL2dRecognition();
        };

        recognition.onend = () => { 
            stopL2dRecognition(); 
            // 🌟 引擎任務結束，徹底釋放變數，下次點擊會產生新的
            recognition = null; 
        };

        // 4. 喚醒音訊上下文 (解決 iOS 靜音播放問題)
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') audioContext.resume();

        // 5. 點火啟動！
        try {
            recognition.start();
        } catch (e) {
            console.warn("麥克風啟動異常:", e);
            stopL2dRecognition();
        }
    }

    function stopL2dRecognition() {
        isSpeechRecording = false;
        const micBtn = document.getElementById('l2d-mic-btn');
        if (micBtn) micBtn.classList.remove('recording');
    }

    function speakFrontendTTS(fullText) {
        ttsInterruptToken++; // 🌟 每次呼叫就換一個新 Token
        const myToken = ttsInterruptToken; // 🌟 記住當下這句話的專屬 Toke

        let textToSpeak = fullText;
        let textToDisplay = fullText;

        // 🌟 升級版正則：忽略大小寫(i)、容忍缺少閉合標籤($)、容忍標籤內有空白
        const voiceRegex = /\[\s*VOICE\s*\]([\s\S]*?)(?:\[\s*\/\s*VOICE\s*\]|$)/i;
        const textRegex = /\[\s*TEXT\s*\]([\s\S]*?)(?:\[\s*\/\s*TEXT\s*\]|$)/i;
        
        const voiceMatch = fullText.match(voiceRegex);
        const textMatch = fullText.match(textRegex);

        if (voiceMatch) textToSpeak = voiceMatch[1].trim(); 
        
        if (textMatch) {
            textToDisplay = textMatch[1].trim(); 
        } else if (voiceMatch) {
            // 防呆：如果 AI 真的沒寫 TEXT 標籤，把 VOICE 部分挖掉，剩下的當顯示文字
            textToDisplay = fullText.replace(voiceRegex, '').trim(); 
        }

        // 🌟 終極防禦：暴力清除畫面上任何殘留的 [TEXT] 或 [VOICE] 相關標籤殘骸
        textToDisplay = textToDisplay.replace(/\[\s*\/?\s*(VOICE|TEXT)\s*\]/gi, '').trim();
        textToSpeak = textToSpeak.replace(/\[\s*\/?\s*(VOICE|TEXT)\s*\]/gi, '').trim();

        // 過濾 Markdown 符號以免語音引擎誤讀
        textToSpeak = textToSpeak.replace(/[*#_`~]/g, '');

        const targetLang = appSettings.outputLang || 'cantonese';
        // ... (下方 langMap 與 playNextQueue 保持不變) ...
        
        // 🌟 建立語言映射表 (把後端的邏輯搬到前端)
        const langMap = { 'cantonese': 'yue', 'mandarin': 'zh', 'japanese': 'ja', 'english': 'en' };
        const mappedLang = langMap[targetLang] || 'yue';

        // 🚀 核心優化 1：極限切分！加入「逗號(,)」與「頓號(、)」
        const splitRegex = /[^，。、！？,.!?\n]+[，。、！？,.!?\n]*/g;
        const voiceSentences = textToSpeak.match(splitRegex) || [textToSpeak];
        const textSentences = textToDisplay.match(splitRegex) || [textToDisplay];
        
        if (currentAudio) {
            // 🌟 徹底殺死舊語音，拔除所有事件監聽與 src，釋放記憶體
            currentAudio.onplaying = null;
            currentAudio.onerror = null;
            currentAudio.onended = null;
            currentAudio.pause();
            currentAudio.removeAttribute('src'); 
            currentAudio.load(); 
            currentAudio = null;
        }
        
        sentenceQueue = [];
        for (let i = 0; i < voiceSentences.length; i++) {
            let v = voiceSentences[i].trim();
            let t = textSentences[i] ? textSentences[i].trim() : "";
            
            if (i === voiceSentences.length - 1 && textSentences.length > voiceSentences.length) {
                t = textSentences.slice(i).join(" ").trim();
            }
            if (v.length > 0) { sentenceQueue.push({ voice: v, text: t }); }
        }

        let accumulatedText = ""; 

        function playNextQueue() {
            // 🛑 絕對防護 1：如果這時候 Token 變了（代表被新語音覆蓋），立刻終止！
            if (myToken !== ttsInterruptToken) return;

            if (sentenceQueue.length === 0) {
                ttsSpeaking = false;
                setTimeout(() => { 
                    // 🛑 絕對防護 2：收合氣泡前也要檢查是否被中斷
                    if(!ttsSpeaking && myToken === ttsInterruptToken) {
                        document.getElementById('live2d-speech-bubble').classList.add('hidden'); 
                    }
                }, 3000);
                return;
            }
            
            const currentItem = sentenceQueue.shift();
            const encodedText = encodeURIComponent(currentItem.voice);
            const primaryUrl = `https://tts-api.hiruynk.com/?text=${encodedText}&text_language=${mappedLang}`;
            const backupUrl = `https://tts-mac-api.hiruynk.com/?text=${encodedText}&text_language=${mappedLang}`;

            let baseText = accumulatedText;
            if (baseText !== "") baseText += " ";
            const textToType = currentItem.text;

            function triggerTypewriter(audioObj) {
                ttsSpeaking = true;
                const bubble = document.getElementById('live2d-speech-bubble');
                let duration = audioObj.duration;
                if (isNaN(duration) || !isFinite(duration) || duration === 0) {
                    duration = textToType.length * 0.2; 
                }
                
                // 🌟 修正 1：移除原本 -2000 的舊補償！改為扣除 200 毫秒，讓文字剛好在語音結束前打完
                let typingTime = (duration * 1000) - 200;
                if (typingTime < textToType.length * 20) {
                    typingTime = (duration * 1000); 
                }
                // 調快最低打字速度，防止過慢
                const speed = Math.max(20, typingTime / textToType.length);

                let charIndex = 0;
                if (window.live2dTypeInterval) clearInterval(window.live2dTypeInterval);
                if (window.live2dTypeDelay) clearTimeout(window.live2dTypeDelay);

                // 🌟 修正 2：將延遲從 2000 改為 0！(聲音一出，文字秒出)
                window.live2dTypeDelay = setTimeout(() => {
                    bubble.className = `live2d-bubble mood-${live2dMood}`;
                    window.live2dTypeInterval = setInterval(() => {
                        charIndex++;
                        bubble.querySelector('.bubble-text').innerText = baseText + textToType.substring(0, charIndex);
                        if (charIndex >= textToType.length) {
                            clearInterval(window.live2dTypeInterval);
                        }
                    }, speed);
                }, 0); 
            }

            function handleAudioEnded() {
                // 🛑 絕對防護 3：如果語音結束時 Token 已變，不准播下一句舊台詞！
                if (myToken !== ttsInterruptToken) return;

                if (window.live2dTypeDelay) clearTimeout(window.live2dTypeDelay);
                if (window.live2dTypeInterval) clearInterval(window.live2dTypeInterval);
                accumulatedText = baseText + textToType; 
                const bubble = document.getElementById('live2d-speech-bubble');
                if (bubble) {
                    bubble.className = `live2d-bubble mood-${live2dMood}`;
                    bubble.querySelector('.bubble-text').innerText = accumulatedText;
                }
                playNextQueue();
            }

            // 👇 🌟 核心新增：終極無聲打字救援模式
            function executeSilentTyping() {
                console.warn("⚠️ 所有 TTS API 無回應，啟動無聲逐字顯示模式");
                
                // 估算打字時間：每個字 0.2 秒 (最少給予 1 秒的緩衝)
                const estimatedSeconds = Math.max(1.0, textToType.length * 0.2);
                
                // 傳入一個帶有假 duration 的物件，騙過打字機讓它啟動
                triggerTypewriter({ duration: estimatedSeconds });
                
                // 根據打字機的邏輯，2秒延遲 + 實際打字時間 + 800ms 停頓緩衝後，自動呼叫下一句
                setTimeout(() => {
                    handleAudioEnded();
                }, 2000 + (estimatedSeconds * 1000) + 800);
            }

            // ... (前面的 triggerTypewriter 和 handleAudioEnded 保持不變)

            currentAudio = new Audio(primaryUrl);
            currentAudio.crossOrigin = "anonymous"; 

            let isFallbackTriggered = false;

            // 🌟 核心修復 1：從 onplay 改為 onplaying！
            // 確保 TTS 伺服器推理完畢，且瀏覽器真正開始發聲的那一刻，才解鎖口型與打字機！
            currentAudio.onplaying = () => { 
                if (myToken !== ttsInterruptToken) { currentAudio.pause(); return; } 
                triggerTypewriter(currentAudio);
                
                if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
                if (audioContext.state === 'suspended') audioContext.resume();

                if (!audioAnalyser) {
                    audioAnalyser = audioContext.createAnalyser();
                    audioAnalyser.fftSize = 256; 
                    audioAnalyser.connect(audioContext.destination); 
                }

                if (!currentAudio.sourceNode) {
                    try {
                        currentAudio.sourceNode = audioContext.createMediaElementSource(currentAudio);
                        currentAudio.sourceNode.connect(audioAnalyser);
                    } catch(e) { console.warn("分析器綁定失敗:", e); }
                }
            };

            // 🌟 嚴格鎖定的錯誤處理鏈
            currentAudio.onerror = () => {
                // 🛑 絕對防護 5：錯誤重試時也要檢查
                if (myToken !== ttsInterruptToken) return; 
                
                if (isFallbackTriggered) return;
                isFallbackTriggered = true;
                console.warn("⚡ 主伺服器失效，切換安全播放模式...");
                const safeAudio = new Audio(primaryUrl);
                currentAudio = safeAudio; 
                let safeFailed = false;

                safeAudio.onplaying = () => {
                    if (myToken !== ttsInterruptToken) { safeAudio.pause(); return; }
                    triggerTypewriter(safeAudio);
                };
                safeAudio.onended = handleAudioEnded;
                
                safeAudio.onerror = () => { 
                    if (myToken !== ttsInterruptToken) return;
                    if (safeFailed) return;
                    safeFailed = true;

                    console.warn("⚡ 安全模式失效，嘗試備用伺服器...");
                    const backupAudio = new Audio(backupUrl);
                    currentAudio = backupAudio; 
                    let backupFailed = false;

                    backupAudio.onplaying = () => {
                        if (myToken !== ttsInterruptToken) { backupAudio.pause(); return; }
                        triggerTypewriter(backupAudio);
                    };
                    backupAudio.onended = handleAudioEnded;
                    
                    backupAudio.onerror = () => {
                        if (backupFailed) return;
                        backupFailed = true;
                        executeSilentTyping();
                    };
                    
                    backupAudio.play().catch(e => {
                        if (e.name === 'NotAllowedError') handleAudioEnded();
                        else if (!backupFailed) {
                            backupFailed = true;
                            executeSilentTyping();
                        }
                    });
                };
                
                safeAudio.play().catch(e => {
                    if (e.name === 'NotAllowedError') handleAudioEnded();
                    else if (!safeFailed) {
                        safeFailed = true;
                        safeAudio.onerror(); 
                    }
                });
            };

            // ... (後面的 fetch nextUrl 和 currentAudio.play() 保持不變)

            if (sentenceQueue.length > 0) {
                const nextUrl = `https://tts-api.hiruynk.com/?text=${encodeURIComponent(sentenceQueue[0].voice)}&text_language=${mappedLang}`;
                fetch(nextUrl).catch(()=>{}); 
            }

            currentAudio.onended = handleAudioEnded;
            currentAudio.play().catch(e => {
                if (e.name === 'NotAllowedError') {
                    console.error("瀏覽器阻擋自動播放:", e);
                    handleAudioEnded();
                } else if (!isFallbackTriggered) {
                    currentAudio.onerror();
                }
            });
        }

        playNextQueue();
    }

    // =======================================================
    // 🤖 終極仿生動態引擎 (表情感測 + 優化嘴型同步)
    // =======================================================
    function setupHiyoriBiomimeticTicker(app, model) {
        const bubble = document.getElementById('live2d-speech-bubble');
        
        // 🌟 2. 徹底消滅卡頓：將時間變數與 PIXI 畫布刷新率完全鎖死
        if (typeof app.locals === 'undefined') app.locals = { tickTime: 0 };

        app.ticker.add(() => {
            if (!model || !model.internalModel || !model.internalModel.coreModel) return;

            try {
                // 使用 PIXI 精準流逝時間，達成 0 毫秒的微秒級同步
                app.locals.tickTime += app.ticker.elapsedMS * 0.001;
                const t = app.locals.tickTime;

                const core = model.internalModel.coreModel;

                if (core.setParameterValueById) {
                    const angleX = Math.sin(t * 0.6) * 12; 
                    const angleY = Math.cos(t * 0.8) * 8;  
                    const bodyAngleX = Math.sin(t * 0.4) * 3; 

                    core.setParameterValueById('ParamAngleX', angleX);
                    core.setParameterValueById('ParamAngleY', angleY);
                    core.setParameterValueById('ParamBodyAngleX', bodyAngleX);
                    core.setParameterValueById('ParamEyeBallX', Math.sin(t * 0.2) * 0.2);

                    if (live2dMood === 'excited') {
                        core.setParameterValueById('ParamEyeSmileL', 1);
                        core.setParameterValueById('ParamEyeSmileR', 1);
                        core.setParameterValueById('ParamBrowLY', 0.6); 
                        core.setParameterValueById('ParamBrowRY', 0.6);
                        core.setParameterValueById('ParamBrowLX', 0.1); 
                        core.setParameterValueById('ParamBrowRX', -0.1);
                        core.setParameterValueById('ParamMouthForm', 1.0); 
                    } else {
                        core.setParameterValueById('ParamEyeSmileL', 0.1);
                        core.setParameterValueById('ParamEyeSmileR', 0.1);
                        core.setParameterValueById('ParamBrowLY', 0.1); 
                        core.setParameterValueById('ParamBrowRY', 0.1);
                        core.setParameterValueById('ParamMouthForm', 0.2); 
                    }

                    // ==========================================
                    // 👄 終極重構：物理級 RMS 雙引擎 + 霸權覆蓋系統 + 🌟 影像延遲補償器
                    // ==========================================
                    let targetMouth = 0; 

                    if (ttsSpeaking) {
                        let currentRms = 0;
                        if (audioAnalyser) {
                            const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
                            audioAnalyser.getByteTimeDomainData(dataArray);
                            
                            let sumSquares = 0;
                            for (let i = 0; i < dataArray.length; i++) {
                                const amplitude = (dataArray[i] - 128) / 128.0; 
                                sumSquares += amplitude * amplitude;
                            }
                            currentRms = Math.sqrt(sumSquares / dataArray.length);
                        }

                        // 🌟 升級 1：實作「影像延遲緩衝區」 (讓畫面刻意「等」聲音)
                        if (!app.locals.rmsBuffer) app.locals.rmsBuffer = [];
                        app.locals.rmsBuffer.push(currentRms);
                        
                        // 👇 【這裡就是你可以手動微調的終極延遲開關！】
                        // 60fps 情況下，12 影格約等於 200 毫秒的延遲。
                        // 如果你用藍牙耳機覺得嘴巴太快，把 12 調大 (例如 15 或 20)。
                        // 如果你覺得嘴巴變太慢了，把它調小 (例如 0 或 5)。
                        const delayFrames = 12; 
                        
                        if (app.locals.rmsBuffer.length > delayFrames) {
                            app.locals.rmsBuffer.shift();
                        }
                        
                        // 取出「過去」的音量，來驅動「現在」的嘴巴
                        let delayedRms = app.locals.rmsBuffer[0] || 0;

                        if (delayedRms > 0.01) {
                            app.locals.hasRealAudio = true;
                        }

                        if (!app.locals.voiceStartTime) {
                            app.locals.voiceStartTime = t;
                        }

                        if (app.locals.hasRealAudio) {
                            if (delayedRms < 0.015) {
                                targetMouth = 0;
                            } else {
                                targetMouth = Math.min(1.0, delayedRms * 6.0);
                            }
                        } else {
                            let elapsedTime = t - app.locals.voiceStartTime;
                            // 🌟 升級 2：延長仿生引擎的靜音寬容度，從 0.1 秒改為 0.4 秒！
                            // 這樣就算 TTS 音檔開頭有長達 0.3 秒的無聲空白，嘴巴也會乖乖閉著等，不會亂搶跑。
                            if (elapsedTime > 0.4) {
                                let waveMain = Math.sin((elapsedTime - 0.4) * 16) * 0.7;
                                let waveDetail = Math.sin((elapsedTime - 0.4) * 26) * 0.3;
                                let combined = Math.abs(waveMain + waveDetail);
                                let microPause = Math.sin(t * 8) > 0.8 ? 0 : 1.0; 
                                targetMouth = combined * microPause;
                            } else {
                                targetMouth = 0;
                            }
                        }
                    } else {
                        if (app.locals) {
                            app.locals.hasRealAudio = false;
                            app.locals.voiceStartTime = undefined;
                            if (app.locals.rmsBuffer) app.locals.rmsBuffer = []; // 講完話務必清空緩衝區
                        }
                    }

                    // 🌟 獨立記憶體 + 霸權覆蓋機制 (防待機動作衝突)
                    if (typeof app.locals.lastMouthOpen === 'undefined') {
                        app.locals.lastMouthOpen = 0;
                    }
                    
                    let currentMouth = app.locals.lastMouthOpen;
                    let lerpFactor = targetMouth > currentMouth ? 0.8 : 0.5;
                    let finalMouth = currentMouth + (targetMouth - currentMouth) * lerpFactor; 
                    
                    app.locals.lastMouthOpen = finalMouth; 

                    if (ttsSpeaking || finalMouth > 0.01) {
                        core.setParameterValueById('ParamMouthOpenY', finalMouth);
                    }
                    // ==========================================

                    // 4. 💬 氣泡同步連動算法
                    if (bubble && bubble.dataset.baseX) {
                        const isMobile = window.innerWidth <= 768; 

                        // 刪除會造成卡頓的 Math.round 和強制的 transition none
                        
                        let offsetX, offsetY;
                        
                        // 保持內斂微小的移動幅度
                        if (isMobile) {
                            offsetX = (bodyAngleX * 1.5) - (angleX * 0.3);
                            offsetY = -(angleY * 0.6); 
                        } else {
                            offsetX = (bodyAngleX * 2.0) - (angleX * 0.6);
                            offsetY = -(angleY * 0.8); 
                        }

                        // 👇 🌟 終極殺手鐧：GPU 硬件加速 (translate3d)
                        // 不再修改 left 和 top！改用 transform 平移圖層。
                        // 這能保留小數點的「極致絲滑」，且瀏覽器不會重新計算內部文字排版，徹底解決所有問題！
                        bubble.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
                    }
                }
            } catch(e) { }
        });
    }

    async function sendLive2DMessage(text) {
        if (!text.trim() && !fileContentBuffer) return; 

        if (isProcessingRequest) return;
        isProcessingRequest = true;
        
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') audioContext.resume();

        const l2dInput = document.getElementById('l2d-chat-input');
        const l2dSendBtn = document.getElementById('l2d-send-btn');
        const l2dMicBtn = document.getElementById('l2d-mic-btn');

        l2dInput.readOnly = true;
        l2dSendBtn.disabled = true;
        l2dMicBtn.disabled = true;

        const userText = text.trim() ? text : ` `;

        let currentFilePayload = null;
        if (attachedFile) {
            currentFilePayload = { name: attachedFile.name, type: attachedFile.type, data: attachedFile.data };
        }

        // 🌟 核心修復：提取完檔案數據後，立刻呼叫引擎瞬間洗淨畫面的預覽縮圖！
        if (window.clearAttachment) window.clearAttachment();

        live2dFullHistory.push({ role: 'user', content: userText, file: currentFilePayload ? { ...currentFilePayload } : null });
        saveL2dHistory();
        renderL2dHistory(); 

        ttsSpeaking = false;
        const bubble = document.getElementById('live2d-speech-bubble');
        bubble.className = `live2d-bubble mood-${live2dMood}`;
        bubble.querySelector('.bubble-text').innerHTML = '<div class="typing-indicator" style="padding: 2px 8px; justify-content: center;"><span></span><span></span><span></span></div>';

        const recentHistory = live2dMessages.slice(-5);
        const requestBody = {
            message: text,
            history: recentHistory,
            mode: 'live2d', 
            input_lang: appSettings.inputLang,
            output_lang: appSettings.outputLang,
            text_lang: appSettings.textLang,
            ai_model: appSettings.model,
            api_key: appSettings.apiKey,
            file_context: currentFilePayload ? currentFilePayload.data : "", // 🌟 重點防禦
            local_url: appSettings.localUrl,
            local_model_name: appSettings.localModel,
            app_lang: appSettings.appLang
        };

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error(`Server Error: ${response.status}`);

            const reader = response.body.getReader();
            // ... (下方的 const decoder = new TextDecoder... 保持原樣不動)
            const decoder = new TextDecoder("utf-8");
            let fullAiResponse = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n\n");
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const dataStr = line.substring(6);
                        if (dataStr === "[DONE]") break;
                        try {
                            const dataObj = JSON.parse(dataStr);
                            
                            // 攔截清空緩存指令不變
                            if (dataObj.text && dataObj.text.includes('[CLEAR_LOCAL_STORAGE]')) {
                                alert(dataObj.text.replace('[CLEAR_LOCAL_STORAGE]', ''));
                                localStorage.clear(); window.location.reload(); return;
                            }

                            // 🌟 👇 修正 2：切換情緒時，把不小心加進去的 hidden 徹底刪除！
                            if (fullAiResponse.length < 10 && dataObj.text) {
                                if (/excited|激動|興奮|大喊|shout|intense/i.test(fullAiResponse + dataObj.text)) {
                                    live2dMood = 'excited';
                                    bubble.className = "live2d-bubble mood-excited"; // 🚨 刪除了 hidden！
                                } else {
                                    live2dMood = 'calm';
                                    bubble.className = "live2d-bubble mood-calm"; // 🚨 刪除了 hidden！
                                }
                            }

                            fullAiResponse += dataObj.text;
                        } catch (e) {}
                    }
                }
            }

            // 將全量回覆送入 TTS 與氣泡分離器
            speakFrontendTTS(fullAiResponse);

            // 👇 🌟 核心修復：補回缺失的 AI 紀錄儲存代碼
            live2dFullHistory.push({ role: 'ai', content: fullAiResponse });
            saveL2dHistory();
            renderL2dHistory();

            // 👇 儲存至專屬歷史紀錄，且不呼叫 saveSession()
            live2dMessages.push({ role: 'user', content: text });
            live2dMessages.push({ role: 'ai', content: fullAiResponse });

            // 清空輸入框
            document.getElementById('l2d-chat-input').value = "";

        } catch (err) {
            bubble.querySelector('.bubble-text').innerText = "⚠️ 網路連線失敗";
        } finally {
            // 👇 接收完畢後解除按鈕鎖定
            l2dSendBtn.disabled = false;
            l2dMicBtn.disabled = false;
            if (l2dInputMode === 'verify') {
                l2dInput.readOnly = false;
            }
            // 🌟 解除防連點鎖
            isProcessingRequest = false;
        }
    }

    // =======================================================
    // 🌟 動態模型自適應縮放器 (升級版：支援動態心跳氣泡基準點)
    // =======================================================
    // =======================================================
    // 🌟 動態模型自適應縮放器 (支援實時箭頭精準置中)
    // =======================================================
    // ===== 🌟 手機顯示還原版 =====
    function updateLive2DScale(model) {
        if (!model || !live2dApp) return;
        
        const isMobile = window.innerWidth <= 768;
        const logicalWidth = live2dApp.screen.width;
        const logicalHeight = live2dApp.screen.height;

        if (logicalWidth === 0 || logicalHeight === 0) {
            setTimeout(() => updateLive2DScale(model), 50);
            return;
        }

        if (isMobile) {
            // 🌟 1. 還原原來的手機顯示尺寸 (加大 Scale)
            model.scale.set(0.25); 
            // 🌟 2. 還原原來的手機靠左定位邏輯 (大幅度向左推)
            model.x = -model.width * 0.31; 
            model.y = logicalHeight - model.height + (model.height * 0.25); 
        } else {
            // 電腦版保持置中 (如果你希望電腦版也要靠左，請把電腦版的 model.x 修改為固定負值)
            const unscaledHeight = model.height / model.scale.y;
            let maxAllowableScale = (logicalHeight - 5) / (unscaledHeight * 0.75);
            let finalScale = Math.min(0.35, maxAllowableScale);
            model.scale.set(finalScale);
            
            model.x = (logicalWidth - model.width) / 2; // 電腦版強制置中
            model.y = logicalHeight - model.height + (model.height * 0.25);
        }

        // 💬 氣泡邏輯 (🛑 嚴格保留原本的動態偵測闊度邏輯)
        const bubble = document.getElementById('live2d-speech-bubble');
        const historyPanel = document.getElementById('l2d-history-panel'); // 🌟 新增

        if (bubble) {
            let headY = model.y + model.height * (isMobile ? 0.12 : 0.20);
            let headX = isMobile ? (logicalWidth * 0.51) : (logicalWidth / 2 + 100);

            // 👇 🌟 新增：偵測懸浮窗是否開啟，決定要往內縮減多少空間
            let panelOffset = 0;
            if (!isMobile && historyPanel && !historyPanel.classList.contains('hidden')) {
                panelOffset = 370; // 懸浮窗寬度 350 + 安全距離 20
            }

            // 🌟 減去 panelOffset，達成開窗瞬間氣泡自動內縮！
            let maxAvailableSpace = logicalWidth - headX - panelOffset - 20; 

            // 🌟 原有的絕對閥值限制邏輯
            let absoluteLimit = isMobile ? maxAvailableSpace : 700;

            // 🌟 原有的「兩者取其輕」寬度算法
            let bubbleMaxWidth = Math.min(maxAvailableSpace, absoluteLimit); 

            // 🚑 原有的手機螢幕防呆救援
            if (isMobile && bubbleMaxWidth < 180) {
                headX = logicalWidth * 0.20; // 氣泡往左移
                bubbleMaxWidth = logicalWidth - headX - 20; 
            }

            bubble.style.maxWidth = `${bubbleMaxWidth}px`;
            // ... (下面保持不變)
            
            bubble.style.minWidth = isMobile ? "80px" : "120px"; 

            bubble.dataset.baseX = headX;
            bubble.dataset.baseY = headY; 
            
            const bHeight = bubble.offsetHeight || 60;
            bubble.style.left = `${headX}px`;
            bubble.style.top = `${headY - (bHeight / 2)}px`;
        }
    }

    // 監聽螢幕旋轉或大小改變，即時縮放模型
    window.addEventListener('resize', () => {
        if (live2dModelInstance && currentMode === 'live2d') {
            setTimeout(() => updateLive2DScale(live2dModelInstance), 100);
        }
    });

    // ==========================================
    // 🌸 櫻花特效引擎 (支援效能偵測與安全開關)
    // ==========================================
    window.toggleSakuraPetals = function() {
        const container = document.getElementById('view-live2d');
        if (!container) return;

        // 🌟 1. 效能與相容性自動偵測 (Auto-Detect)
        // 偵測使用者系統是否在 OS 層級開啟了「減少動態效果」，以此判斷硬體是否受限
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (prefersReducedMotion) {
            console.warn("⚠️ 偵測到系統效能限制，已自動強制關閉櫻花特效");
            appSettings.sakuraEffect = false;
            if (dom.selSakuraEffect) dom.selSakuraEffect.value = 'off';
        }

        // 2. 清除畫面上現有的所有櫻花殘骸
        container.querySelectorAll('.sakura-petal').forEach(p => p.remove());

        // 3. 如果設定為關閉，就此中斷，不再耗費資源生成
        if (appSettings.sakuraEffect === false) return;

        // 4. 生成櫻花 (加入 try-catch 護盾，若有任何渲染阻擋自動關閉)
        try {
            for (let i = 0; i < 25; i++) {
                let petal = document.createElement('div');
                petal.className = 'sakura-petal';
                petal.style.left = (Math.random() * 100) + 'vw';
                petal.style.animationDuration = (Math.random() * 5 + 6) + 's, ' + (Math.random() * 3 + 3) + 's';
                petal.style.animationDelay = (Math.random() * 10) + 's, ' + (Math.random() * 5) + 's';
                let size = Math.random() * 6 + 6;
                petal.style.width = size + 'px';
                petal.style.height = size + 'px';
                
                container.insertBefore(petal, document.getElementById('live2d-stage-container'));
            }
        } catch (e) {
            console.warn("櫻花特效渲染失敗，已啟動安全保護自動關閉", e);
            appSettings.sakuraEffect = false; 
        }
    };

    async function initLive2D() {
        if (live2dApp) return;

        // 🌟 啟動櫻花引擎 (會自動判斷開關與效能)
        window.toggleSakuraPetals();

        const canvas = document.getElementById('live2d-canvas');
        const stageContainer = document.getElementById('live2d-stage-container');
        const bubble = document.getElementById('live2d-speech-bubble');
        
        // 👇 🌟 抓取 Loading 元件並顯示它
        const loadingOverlay = document.getElementById('live2d-loading');
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');

        // 🚨 診斷 1：檢查官方核心引擎是否被瀏覽器或擋廣告外掛(AdBlock)攔截！
        if (!window.Live2DCubismCore) {
            bubble.querySelector('.bubble-text').innerText = "⚠️ 核心引擎載入失敗！\n請關閉「擋廣告擴充套件(AdBlock)」或「Brave 護盾」後重整網頁。";
            bubble.classList.remove('hidden');
            if (loadingOverlay) loadingOverlay.classList.add('hidden'); // 出錯時隱藏 loading
            return;
        }

        live2dApp = new PIXI.Application({
            view: canvas,
            autoStart: true,
            transparent: true,
            resizeTo: stageContainer,
            resolution: window.devicePixelRatio || 1, 
            autoDensity: true 
        });

        const modelUrls = [
            "/static/hiyori_free/runtime/hiyori_free_t08.model3.json", 
            "./hiyori_free/runtime/hiyori_free_t08.model3.json",       
            "/hiyori_free/runtime/hiyori_free_t08.model3.json"         
        ];

        let lastError = null;

        for (const url of modelUrls) {
            try {
                // 模型下載通常是在這一行花費最多時間
                live2dModelInstance = await PIXI.live2d.Live2DModel.from(url);
                console.log("✅ 成功尋獲模型，使用路徑: " + url);
                break; 
            } catch (e) {
                console.warn(`❌ 路徑 ${url} 測試失敗`);
                lastError = e;
            }
        }

        if (!live2dModelInstance) {
            bubble.querySelector('.bubble-text').innerText = `⚠️ 找不到模型檔案！\n請確認 hiyori_free 資料夾是否真的放在正確位置。\n(錯誤代碼: ${lastError ? lastError.message : '未知'})`;
            bubble.classList.remove('hidden');
            if (loadingOverlay) loadingOverlay.classList.add('hidden'); // 出錯時隱藏 loading
            return; 
        }

        try {
            live2dApp.stage.addChild(live2dModelInstance);
            updateLive2DScale(live2dModelInstance); 

            setupHiyoriBiomimeticTicker(live2dApp, live2dModelInstance);
            setupLive2DControls();

        } catch (error) {
            console.error("Live2D 渲染失敗", error);
            bubble.querySelector('.bubble-text').innerText = "⚠️ 渲染器異常: " + error.message;
            bubble.classList.remove('hidden');
        } finally {
            // 👇 🌟 模型載入且渲染成功後 (或是發生 catch 錯誤後)，保證隱藏 Loading 畫面
            if (loadingOverlay) loadingOverlay.classList.add('hidden');
        }
    }
    // =======================================================
    // 🖊️ 升級版：單一開關控制島 (關閉校對自動切回直發模式)
    // =======================================================
    function setupLive2DControls() {
        const dict = translations[appSettings.appLang || 'en'];
        const btnVerify = document.getElementById('btn-l2d-mode-verify');
        const l2dInput = document.getElementById('l2d-chat-input');
        const l2dSendBtn = document.getElementById('l2d-send-btn');
        const l2dMicBtn = document.getElementById('l2d-mic-btn');
        const dashboard = document.querySelector('.live2d-dashboard');
        
        if (l2dMicBtn) l2dMicBtn.innerHTML = svgMic;

        // =======================================================
        // 🌟 核心動態注入：在畫筆左側現場鑄造「上傳功能套件」
        // =======================================================
        if (dashboard && btnVerify && !document.getElementById('l2d-upload-container')) {
            // 1. 建立總外殼容器
            const uploadContainer = document.createElement('div');
            uploadContainer.id = 'l2d-upload-container';
            uploadContainer.className = 'l2d-upload-container';

            // 2. 建立主觸發按鈕 (採用與普通模式相同的 icon-btn 質感與 + 號)
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'btn-l2d-upload-toggle';
            toggleBtn.className = 'icon-btn';
            toggleBtn.style.width = '38px'; toggleBtn.style.height = '38px';
            toggleBtn.style.fontSize = '22px'; toggleBtn.style.lineHeight = '38px';
            toggleBtn.innerHTML = '＋';

            // 3. 建立上拉彈出功能選單 (結構與普通模式 100% 複製)
            const popup = document.createElement('div');
            popup.id = 'l2d-upload-popup';
            popup.className = 'upload-popup hidden';

            const optImg = document.createElement('button');
            optImg.className = 'upload-option';
            optImg.innerHTML = `<span class="upload-icon">${typeof svgImageIcon !== 'undefined' ? svgImageIcon : '🖼️'}</span><span data-i18n="upload_image">${dict.upload_image}</span>`;
            optImg.onclick = () => { imageUpload.click(); popup.classList.add('hidden'); };

            const optFile = document.createElement('button');
            optFile.className = 'upload-option';
            optFile.innerHTML = `<span class="upload-icon">${typeof svgFileIcon !== 'undefined' ? svgFileIcon : '📄'}</span><span data-i18n="upload_file">${dict.upload_file}</span>`;
            optFile.onclick = () => { dom.fileUpload.click(); popup.classList.add('hidden'); };

            popup.appendChild(optImg);
            popup.appendChild(optFile);

            // 4. 建立浮動附加預覽框
            const preview = document.createElement('div');
            preview.id = 'l2d-upload-preview';
            preview.className = 'hidden';

            // 組裝並精準插入到畫筆按鈕的左邊
            uploadContainer.appendChild(toggleBtn);
            uploadContainer.appendChild(popup);
            uploadContainer.appendChild(preview);
            dashboard.insertBefore(uploadContainer, btnVerify.parentNode);

            // 5. 綁定彈出選單事件
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                popup.classList.toggle('hidden');
            };
            document.addEventListener('click', (e) => {
                if (!toggleBtn.contains(e.target) && !popup.contains(e.target)) {
                    popup.classList.add('hidden');
                }
            });
        }

        // 🌟 畫筆（校對模式）雙向開關舊邏輯完美保留
        if (btnVerify) {
            btnVerify.innerHTML = svgPen;
            btnVerify.setAttribute('data-i18n-tooltip', 'tooltip_l2d_verify');
            btnVerify.setAttribute('data-tooltip', dict.tooltip_l2d_verify);
            window.bindTooltipEvents(btnVerify);

            if (l2dInputMode === 'verify') {
                btnVerify.classList.add('active');
                l2dInput.readOnly = false;
                l2dInput.placeholder = dict.l2d_placeholder_verify;
                if (l2dSendBtn) l2dSendBtn.classList.remove('hidden');
            } else {
                btnVerify.classList.remove('active');
                l2dInput.readOnly = true;
                l2dInput.placeholder = dict.l2d_placeholder_auto;
                if (l2dSendBtn) l2dSendBtn.classList.add('hidden');
            }

            btnVerify.onclick = () => {
                if (l2dInputMode === 'auto') {
                    l2dInputMode = 'verify';
                    btnVerify.classList.add('active');
                    l2dInput.readOnly = false;
                    l2dInput.placeholder = dict.l2d_placeholder_verify;
                    if (l2dSendBtn) l2dSendBtn.classList.remove('hidden');
                } else {
                    l2dInputMode = 'auto';
                    btnVerify.classList.remove('active');
                    l2dInput.readOnly = true;
                    l2dInput.placeholder = dict.l2d_placeholder_auto;
                    if (l2dSendBtn) l2dSendBtn.classList.add('hidden');
                }
            };
        }

        if (l2dInput) {
            l2dInput.onkeydown = (e) => {
                if (e.isComposing || e.keyCode === 229) return; 
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (l2dInputMode === 'verify' && l2dSendBtn && !l2dSendBtn.classList.contains('hidden')) {
                        sendLive2DMessage(l2dInput.value);
                    }
                }
            };
        }

        if (l2dMicBtn) l2dMicBtn.onclick = () => { toggleL2dSpeech(); };
        if (l2dSendBtn) l2dSendBtn.onclick = () => { sendLive2DMessage(l2dInput.value); };
        if (l2dInput) l2dInput.placeholder = l2dInputMode === 'auto' ? dict.l2d_placeholder_auto : dict.l2d_placeholder_verify;
    }

    // =======================================================
    // 🌟 Live2D 獨立聊天紀錄面板系統
    // =======================================================
    const btnL2dHistory = document.getElementById('btn-l2d-history');
    const panelL2dHistory = document.getElementById('l2d-history-panel');
    const closeL2dHistory = document.getElementById('close-l2d-history');

    function saveL2dHistory() {
        // 👇 🌟 核心修復：為 Live2D 歷史紀錄加上 localStorage 容量防爆護盾！
        try {
            localStorage.setItem('hkiit_l2d_history', JSON.stringify(live2dFullHistory));
        } catch (e) {
            console.warn("Live2D 紀錄快取已滿，啟動 Base64 降維壓縮...");
            // 若空間爆滿，僅清除過往對話中沉重的圖片 base64 字串，保留檔名標籤，確保網站絕不崩潰
            live2dFullHistory.forEach(msg => {
                if (msg.file && msg.file.type === 'image') msg.file.data = "";
            });
            try {
                localStorage.setItem('hkiit_l2d_history', JSON.stringify(live2dFullHistory));
            } catch (err) {}
        }
    }

    function renderL2dHistory() {
        const contentBox = document.getElementById('l2d-history-content');
        if (!contentBox) return;
        contentBox.innerHTML = '';
        
        live2dFullHistory.forEach(msg => {
            const item = document.createElement('div');
            item.className = `l2d-log-item ${msg.role === 'user' ? 'log-user' : 'log-ai'}`;
            
            const roleEl = document.createElement('div');
            roleEl.className = 'l2d-log-role';
            let youStr = appSettings.appLang === 'en' ? '丨You' : '你';
            roleEl.innerText = msg.role === 'user' ? youStr : 'Hiyori';
            
            const textEl = document.createElement('div');
            textEl.className = 'l2d-log-text';
            
            let cleanText = msg.content;
            const textRegex = /\[\s*TEXT\s*\]([\s\S]*?)(?:\[\s*\/\s*TEXT\s*\]|$)/i;
            const voiceRegex = /\[\s*VOICE\s*\]([\s\S]*?)(?:\[\s*\/\s*VOICE\s*\]|$)/i;

            if (textRegex.test(cleanText)) {
                cleanText = cleanText.match(textRegex)[1].trim();
            } else {
                if (voiceRegex.test(cleanText)) cleanText = cleanText.replace(voiceRegex, '');
                cleanText = cleanText.replace(/\\[\\s*\\/?\\s*(VOICE|TEXT)\\s*\\]/gi, '').trim();
            }
            
            textEl.innerText = cleanText;
            item.appendChild(roleEl);
            item.appendChild(textEl);

            // =======================================================
            // 🌟 核心新增：在 Live2D 聊天紀錄中優雅還原使用者上傳的檔案
            // =======================================================
            if (msg.file) {
                if (msg.file.type === 'image' && msg.file.data) {
                    const imgEl = document.createElement('img');
                    imgEl.src = msg.file.data;
                    imgEl.style.maxWidth = '100px';
                    imgEl.style.maxHeight = '100px';
                    imgEl.style.borderRadius = '8px';
                    imgEl.style.display = 'block';
                    imgEl.style.marginTop = '8px';
                    imgEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                    imgEl.style.cursor = 'pointer';
                    imgEl.style.pointerEvents = 'auto'; // 活化點擊

                    // 完美對接雙軌 Lightbox 圖片懸浮放大鏡
                    imgEl.onclick = (e) => {
                        e.stopPropagation();
                        let lightbox = document.getElementById('hkiit-image-lightbox');
                        if (!lightbox) {
                            lightbox = document.createElement('div');
                            lightbox.id = 'hkiit-image-lightbox';
                            lightbox.className = 'image-lightbox-overlay';
                            const closeBtn = document.createElement('div');
                            closeBtn.className = 'image-lightbox-close';
                            closeBtn.innerHTML = '×';
                            const img = document.createElement('img');
                            img.className = 'image-lightbox-content';
                            lightbox.appendChild(closeBtn);
                            lightbox.appendChild(img);
                            document.body.appendChild(lightbox);
                            lightbox.onclick = () => lightbox.classList.remove('active');
                        }
                        const lightboxImg = lightbox.querySelector('.image-lightbox-content');
                        lightboxImg.src = msg.file.data;
                        requestAnimationFrame(() => lightbox.classList.add('active'));
                    };
                    item.appendChild(imgEl);
                } else if (msg.file.type === 'file') {
                    // 文件附件樣式還原
                    const fileBox = document.createElement('div');
                    fileBox.style.display = 'flex'; fileBox.style.alignItems = 'center'; fileBox.style.gap = '6px';
                    fileBox.style.padding = '4px 10px'; fileBox.style.marginTop = '6px';
                    fileBox.style.background = 'rgba(128, 128, 128, 0.1)';
                    fileBox.style.border = '1px solid var(--border-color)';
                    fileBox.style.borderRadius = '8px'; fileBox.style.fontSize = '12px';
                    fileBox.style.width = 'max-content'; fileBox.style.maxWidth = '100%';
                    fileBox.innerHTML = `📄 <span style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${msg.file.name}</span>`;
                    item.appendChild(fileBox);
                }
            }
            
            contentBox.appendChild(item);
        });

        setTimeout(() => {
            contentBox.scrollTo({ top: contentBox.scrollHeight, behavior: 'smooth' });
        }, 50);
    }

    if (btnL2dHistory && panelL2dHistory) {
        // 點擊懸浮按鈕：自動切換開關 (Toggle)
        btnL2dHistory.onclick = () => {
            panelL2dHistory.classList.toggle('hidden');
            renderL2dHistory();
            if (currentMode === 'live2d' && live2dModelInstance) {
                updateLive2DScale(live2dModelInstance);
            }
        };
        // (這裡原本的 closeL2dHistory.onclick 已經整段刪除)
    }
    // ==========================================
    // 🌟 終極安全版：全域拖曳上傳引擎 (Drag & Drop)
    // ==========================================
    // 同時監聽普通模式的輸入框與 Live2D 的輸入膠囊
    const dropZones = [
        document.querySelector('.input-box'), 
        document.querySelector('.l2d-input-bar')
    ];

    dropZones.forEach(zone => {
        if (!zone) return;

        // 1. 當檔案拖入區域上方時：啟動 CSS 發光特效
        zone.addEventListener('dragover', (e) => {
            e.preventDefault(); // 必須阻止預設行為，否則無法觸發 drop
            e.stopPropagation();
            zone.classList.add('drag-over');
        });

        // 2. 當檔案離開區域時：移除特效
        zone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('drag-over');
        });

        // 3. 當用戶鬆開滑鼠將檔案丟入時：
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('drag-over'); // 關閉發光特效

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                
                // 創造一個虛擬的檔案傳輸載體
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);

                // 🌟 核心黑魔法：智慧判斷檔案類型，然後把檔案「塞進」原本隱藏的上傳按鈕中，
                // 並用 dispatchEvent 假裝用戶點擊了它！這樣原本所有的防呆防爆邏輯都會自動執行！
                if (file.type.startsWith('image/')) {
                    if (imageUpload) {
                        imageUpload.files = dataTransfer.files;
                        imageUpload.dispatchEvent(new Event('change'));
                    }
                } else {
                    if (dom.fileUpload) {
                        dom.fileUpload.files = dataTransfer.files;
                        dom.fileUpload.dispatchEvent(new Event('change'));
                    }
                }
            }
        });
    });
}); // <--- 注意這裡保留了腳本結尾的右括號