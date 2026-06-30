document.addEventListener('DOMContentLoaded', () => {
    
    
    
    let currentMode = 'chat'; 
    let live2dApp = null; 
    let fileContentBuffer = ""; 
    let attachedFile = null; 

    let live2dFullHistory = JSON.parse(localStorage.getItem('hkiit_l2d_history')) || [];

    let chatSessions = JSON.parse(localStorage.getItem('hkiit_chat_sessions')) || [];
    let currentSessionId = Date.now();
    let currentMessages = [];

    
    let live2dModel, ttsSpeaking = false, live2dMessages = [];
    
    let live2dMood = 'calm';

    
    let sentenceQueue = [];
    let currentAudio = null;

    let ttsInterruptToken = 0; 

    let audioContext = null;
    let audioAnalyser = null;

    
    let isProcessingRequest = false;

    let appSettings = {
        model: 'gemini', apiKey: '', theme: 'auto',
        inputLang: 'cantonese', outputLang: 'cantonese', textLang: 'chinese',
        sakuraEffect: true, 
        voiceToggle: true, 
        live2dLangSet: false,
        appLang: 'zh-HK',
        ttsApiUrl: '' 
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
        selVoiceToggle: document.getElementById('sel-voice-toggle'), 
        selSakuraEffect: document.getElementById('sel-sakura-effect'), 
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
    
    
    const svgPower = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px; position: relative; top: -1px;"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>`;

    

    
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
            settings_sakura: "🌸 Sakura Effect:", sakura_on: "On (Default)", sakura_off: "Off (Performance)", 
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
            l2d_loading_text: "Loading model, please wait...", 
            local_help_title: "❓ Local LLM Startup Tutorial",
            tooltip_l2d_history: "Live2D Chat Log", l2d_history_title: "Chat History",
            tooltip_l2d_auto: "Voice Direct", tooltip_l2d_verify: "Verify Mode",
            voice_toggle: `${svgPower} Voice Toggle:`, voice_on: "On (Default)", voice_off: "Off (Silent Mode)",
            welcome_md: `Hello! Welcome to the **IVE HKIIT Open Day**! I am your official **AI Chatbot Assistant**.\n\nThe IVE IT Discipline has been upgraded to the **Hong Kong Institute of Information Technology (HKIIT)**! I'm here to provide you with syllabus details, tuition fees, and admission requirements for our Higher Diploma and Diploma of Foundation Studies programs, or navigate you through today's activities!\n\n**Try asking me:**\n* Syllabus: \`What will I learn in Higher Diploma in Data Science and AI (IT114126)?\`\n* Admission: \`What are the requirements for Real Estate (BA114037)?\`\n* Transport: \`How do I get to IVE Tsing Yi?\`\n\nHow can I help you today?`
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
            settings_sakura: "🌸 櫻花飄落特效：", sakura_on: "開啟 (預設)", sakura_off: "關閉 (提升效能)", 
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
            l2d_loading_text: "模型載入中，請稍候...", 
            local_help_title: "❓ 本地大模型啟動教學",
            tooltip_l2d_history: "Live2D 聊天紀錄", l2d_history_title: "聊天紀錄",
            tooltip_l2d_auto: "語音直發", tooltip_l2d_verify: "打字校對",
            voice_toggle: `${svgPower} 語音開關：`, voice_on: "開啟 (預設)", voice_off: "關閉 (靜音模式)", 
            welcome_md: `您好！歡迎來到 **IVE HKIIT 開放日**！我是您的官方 **AI Chatbot 智能升學諮詢助手**。\n\n香港專業教育學院（IVE）資訊科技學系已全新升級為 **香港資訊科技學院（HKIIT）**！在這裡，我能為您提供各項熱門的高級文憑 (Higher Diploma) 及基礎文憑 (Diploma of Foundation Studies) 的課程大綱、學費、入學要求，或是為您導航今天的開放日活動！\n\n**您可以試著這樣問我：**\n* 課程內容：\`IT114126 數據科學及人工智能高級文憑學咩？\`\n* 入學條件：\`BA114037 房地產高級文憑有咩入學要求？\`\n* 交通導航：\`青衣 IVE 點樣去？\` \n\n請問今天有甚麼我可以幫到您？`
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
            settings_sakura: "🌸 樱花飘落特效：", sakura_on: "开启 (默认)", sakura_off: "关闭 (提升效能)", 
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
            l2d_loading_text: "模型载入中，请稍候...", 
            local_help_title: "❓ 本地大模型启动教学",
            tooltip_l2d_history: "Live2D 聊天记录", l2d_history_title: "聊天记录",
            tooltip_l2d_auto: "语音直发", tooltip_l2d_verify: "打字校对",
            voice_toggle: `${svgPower} 语音开关：`, voice_on: "开启 (默认)", voice_off: "关闭 (静音模式)", 
            welcome_md: `您好！欢迎来到 **IVE HKIIT 开放日**！我是您的官方 **AI Chatbot 智能升学咨询助手**。\n\n香港专业教育学院（IVE）资讯科技学系已全新升级为 **香港资讯科技学院（HKIIT）**！在这里，我能为您提供各项热门的高级文凭 (Higher Diploma) 及基础文凭 (Diploma of Foundation Studies) 的课程大纲、学费、入学要求，或是为您导航今天的开放日活动！\n\n**您可以试着这样问我：**\n* 课程内容：\`IT114126 数据科学及人工智能高级文凭学什么？\`\n* 入学条件：\`BA114037 房地产高级文凭有什么入学要求？\`\n* 交通导航：\`青衣 IVE 怎么去？\` \n\n请问今天有什么我可以帮到您？`
        }
    };

    
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

    
    
    
    let currentUser = localStorage.getItem('hkiit_current_user');
    
    if (currentUser) {
        dom.btnLogin.querySelector('span').innerText = currentUser;
        fetch('/api/get_key', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({username: currentUser})
        }).then(r => r.json()).then(data => {
            if (data.status === 'success') {
                
                appSettings.apiKey = data.api_key || ""; 
                appSettings.localUrl = data.local_url || "";
                appSettings.localModel = data.local_model_name || "gemma4:12b";
                appSettings.ttsApiUrl = data.tts_api_url || ""; 
                
                localStorage.setItem('hkiit_settings', JSON.stringify(appSettings));
                updateModelBadge();
            }
        }).catch(e => console.log("[錯誤] 背景同步失敗:", e));
    }

    
    dom.dropdownTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.dropdownMenu.classList.toggle('hidden');
        dom.langDropdownMenu.classList.add('hidden'); 
    });

    
    dom.langDropdownTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.langDropdownMenu.classList.toggle('hidden');
        dom.dropdownMenu.classList.add('hidden'); 
    });

    document.addEventListener('click', (e) => {
        if (!dom.dropdownMenu.contains(e.target) && !dom.dropdownTrigger.contains(e.target)) {
            dom.dropdownMenu.classList.add('hidden');
        }
        if (!dom.langDropdownMenu.contains(e.target) && !dom.langDropdownTrigger.contains(e.target)) {
            dom.langDropdownMenu.classList.add('hidden');
        }
    });

    
    dom.dropdownItems.forEach(item => {
        item.addEventListener('click', () => {
            const newModel = item.getAttribute('data-value');
            
            
            if (appSettings.model !== newModel) {
                appSettings.model = newModel;
                localStorage.setItem('hkiit_settings', JSON.stringify(appSettings));
                updateModelBadge();
            }
            dom.dropdownMenu.classList.add('hidden');
        });
    });

    
    dom.langDropdownItems.forEach(item => {
        item.addEventListener('click', () => {
            appSettings.appLang = item.getAttribute('data-value');
            localStorage.setItem('hkiit_settings', JSON.stringify(appSettings));
            applyLanguage();
            
            if (currentMode === 'chat') {
                startNewChat(); 
            } else {
                setupLive2DControls(); 
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

        
        const selSakura = document.getElementById('sel-sakura-effect');
        if (selSakura) {
            selSakura.value = appSettings.sakuraEffect === false ? 'off' : 'on';
        }

        
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
                
                
                appSettings.apiKey = data.api_key || ""; 
                appSettings.localUrl = data.local_url || "";
                appSettings.localModel = data.local_model_name || "gemma4:12b";
                appSettings.ttsApiUrl = data.tts_api_url || "";
                
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

        
        const selSakura = document.getElementById('sel-sakura-effect');
        if (selSakura) {
            appSettings.sakuraEffect = (selSakura.value === 'on');
        }

        localStorage.setItem('hkiit_settings', JSON.stringify(appSettings));
        
        if (currentUser) {
            try {
                
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

        
        if (currentMode === 'live2d' && window.toggleSakuraPetals) {
            window.toggleSakuraPetals();
        }
        
        dom.settingsSuccess.style.display = 'block';
        setTimeout(() => { dom.settingsSuccess.style.display = 'none'; }, 2000); 
    });

    dom.closeLangModal.addEventListener('click', () => {
        dom.langModal.classList.add('hidden');
        
        
        
        if (currentMode === 'chat') {
            switchMode('chat');
        }
    });

    
    
    
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
                    
                    
                    let titleSpan = i.querySelector('.item-title');
                    let titleText = titleSpan ? titleSpan.textContent : i.textContent.trim();

                    if (i.getAttribute('data-value') === 'gemma' && titleSpan) {
                        titleSpan.textContent = formattedName;
                        titleText = formattedName; 
                    }

                    if(i.getAttribute('data-value') === appSettings.model) {
                        i.classList.add('active');
                        if(dom.selectedModelName) {
                            dom.selectedModelName.textContent = titleText; 
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

    
    
    
    function startNewChat() {
        currentSessionId = Date.now();
        currentMessages = [];
        live2dMessages = [];
        displayWelcomeMessage(true); 
        fileContentBuffer = "";
        dom.uploadPreview.classList.add('hidden');
        renderSidebar();
        
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

        let saved = false;
        
        
        while (!saved) {
            try {
                localStorage.setItem('hkiit_chat_sessions', JSON.stringify(chatSessions));
                renderSidebar();
                saved = true; 
            } catch (e) {
                console.warn("⚠️ 普通對話紀錄快取已滿，啟動智慧降維壓縮（尋找並清除最舊圖片）...");
                
                let foundOldestImage = false;
                
                
                for (let i = chatSessions.length - 1; i >= 0; i--) {
                    let session = chatSessions[i];
                    
                    
                    for (let j = 0; j < session.messages.length; j++) {
                        let msg = session.messages[j];
                        if (msg.file && msg.file.type === 'image' && msg.file.data) {
                            msg.file.data = ""; 
                            foundOldestImage = true;
                            break; 
                        }
                    }
                    if (foundOldestImage) break; 
                }
                
                
                if (!foundOldestImage) {
                    console.error("無法儲存：圖片已全數降維，強行刪除最舊的一筆對話紀錄以釋放空間...");
                    
                    if (chatSessions.length > 1) {
                        chatSessions.pop(); 
                    } else {
                        
                        break; 
                    }
                }
            }
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
        
        
        currentMessages.forEach(msg => appendMessageUI(msg.content, msg.role, false, msg.file)); 
        
        renderSidebar();
        closeSidebarHandler();
        setTimeout(smoothScrollToBottom, 100); 
    }

    
    
    
    function copyTextToClipboard(text, btn) {
        const dict = translations[appSettings.appLang || 'en'];
        const copyText = dict.btn_copy.replace(/<[^>]*>?/gm, '').trim();
        const copiedText = dict.btn_copied.replace(/<[^>]*>?/gm, '').trim();
        const failText = dict.btn_copy_fail.replace(/<[^>]*>?/gm, '').trim();

        function showSuccess() {
            btn.classList.add('success');
            btn.innerHTML = svgCheck; 
            btn.setAttribute('data-tooltip', copiedText); 
            setTimeout(() => { 
                btn.classList.remove('success'); 
                btn.innerHTML = svgCopy; 
                btn.setAttribute('data-tooltip', copyText); 
            }, 1800); 
        }

        function showError(errMessage) {
            alert("複製失敗: " + errMessage);
            btn.innerHTML = svgFail; 
            btn.setAttribute('data-tooltip', failText); 
            setTimeout(() => { 
                btn.innerHTML = svgCopy; 
                btn.setAttribute('data-tooltip', copyText); 
            }, 1800);
        }
        

        function showError(errMessage) {
            
            alert("複製失敗: " + errMessage);
            btn.innerHTML = dict.btn_copy_fail;
            setTimeout(() => { btn.innerHTML = dict.btn_copy; }, 1800);
        }

        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(showSuccess)
                .catch(err => {
                    console.warn("Clipboard API failed, trying fallback...", err);
                    fallbackCopy(text); 
                });
        } else {
            fallbackCopy(text);
        }

        
        function fallbackCopy(textToCopy) {
            let textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            
            
            textArea.contentEditable = true;
            textArea.readOnly = false;
            
            
            textArea.style.position = 'fixed';
            textArea.style.top = '-9999px';
            textArea.style.left = '-9999px';
            textArea.style.width = '2em';
            textArea.style.height = '2em';
            
            document.body.appendChild(textArea);

            try {
                
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
        const dict = translations[appSettings.appLang || 'en']; 
        if (!rawText) return;
        const div = document.createElement('div');
        div.className = `message ${animate ? 'slide-up' : ''} ${role === 'user' ? 'user-message' : 'ai-message'}`;

        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper';

        const content = document.createElement('div');
        content.className = 'msg-content';
        let cleanText = rawText;
        
        
        const voiceRegex = /\[\s*VOICE\s*\]([\s\S]*?)(?:\[\s*\/\s*VOICE\s*\]|$)/i;
        const textRegex = /\[\s*TEXT\s*\]([\s\S]*?)(?:\[\s*\/\s*TEXT\s*\]|$)/i;
        
        if (textRegex.test(cleanText)) {
            cleanText = cleanText.match(textRegex)[1].trim();
        } else if (voiceRegex.test(cleanText)) {
            cleanText = cleanText.replace(voiceRegex, '').trim();
        }
        
        
        cleanText = cleanText.replace(/\[\s*\/?\s*(VOICE|TEXT)\s*\]/gi, '').trim();
        
        content.innerHTML = role === 'user' ? rawText.replace(/\n/g, '<br>') : marked.parse(cleanText);
        content.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));

        
        
        
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
                    
                    
                    imgEl.onclick = () => {
                        
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
                            
                            
                            lightbox.onclick = () => {
                                lightbox.classList.remove('active');
                            };
                        }
                        
                        
                        const lightboxImg = lightbox.querySelector('.image-lightbox-content');
                        lightboxImg.src = fileObj.data;
                        
                        
                        requestAnimationFrame(() => {
                            lightbox.classList.add('active');
                        });
                    };
                    content.insertBefore(imgEl, content.firstChild);
                } else {
                    
                    const imgFallback = document.createElement('div');
                    imgFallback.style.fontSize = '13px'; imgFallback.style.opacity = '0.7'; imgFallback.style.marginBottom = '6px';
                    imgFallback.innerText = `🖼️ 圖片: ${fileObj.name} (已成功上傳)`;
                    content.insertBefore(imgFallback, content.firstChild);
                }
            } else if (fileObj.type === 'file') {
                const fileBox = document.createElement('div');
                fileBox.style.display = 'flex'; fileBox.style.alignItems = 'center'; fileBox.style.gap = '6px';
                fileBox.style.padding = '6px 12px'; 
                
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
            file_context: currentFilePayload ? currentFilePayload.data : "", 
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
            
            const decoder = new TextDecoder("utf-8");
            let aiTextContent = "";
            let isFirstChunk = true;

            
            let isRendering = false;
            let pendingCleanText = "";

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
                            
                            
                            if (dataObj.text && dataObj.text.includes('[CLEAR_LOCAL_STORAGE]')) {
                                alert(dataObj.text.replace('[CLEAR_LOCAL_STORAGE]', ''));
                                localStorage.clear(); 
                                window.location.reload(); 
                                return;
                            }
                            
                            
                            aiTextContent += dataObj.text;
                            
                            
                            let liveCleanText = aiTextContent;
                            const liveTextRegex = /\[\s*TEXT\s*\]([\s\S]*?)(?:\[\s*\/\s*TEXT\s*\]|$)/i;
                            const liveVoiceRegex = /\[\s*VOICE\s*\]([\s\S]*?)(?:\[\s*\/\s*VOICE\s*\]|$)/i;

                            if (liveTextRegex.test(liveCleanText)) {
                                liveCleanText = liveCleanText.match(liveTextRegex)[1];
                            } else if (liveVoiceRegex.test(liveCleanText)) {
                                liveCleanText = liveCleanText.replace(liveVoiceRegex, '');
                            }
                            
                            
                            liveCleanText = liveCleanText.replace(/\[\s*\/?\s*(VOICE|TEXT)\s*\]/gi, '').trim();

                            
                            if (liveCleanText === "" && liveVoiceRegex.test(aiTextContent)) {
                                liveCleanText = "💭 思考中...";
                            }
                            
                            
                            
                            
                            pendingCleanText = liveCleanText;
                            
                            if (!isRendering) {
                                isRendering = true;
                                
                                requestAnimationFrame(() => {
                                    if (currentMode === 'chat') {
                                        if (isFirstChunk) { content.innerHTML = ""; isFirstChunk = false; }
                                        
                                        
                                        content.innerHTML = marked.parse(pendingCleanText);
                                        
                                        
                                        dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight; 
                                    } else {
                                        dom.live2dSubtitle.innerText = pendingCleanText;
                                    }
                                    
                                    
                                    isRendering = false;
                                });
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
            
            if (typeof aiTextContent !== 'undefined' && aiTextContent.length > 0) {
                content.innerHTML += `<br><br><span style="color:#ff3b30; font-weight:bold;">⚠️ 系統提示：${dict.err_network}</span>`;
            } else {
                content.innerText = dict.err_network;
            }
        } finally {
            
            isProcessingRequest = false;
        }
    }

    
    
    
    let isTouchDevice = false; 

    
    window.bindTooltipEvents = function(btn) {
        if (btn.hasTooltipBound) return; 
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
                
                if (btn.id === 'l2d-mic-btn' || btn.id === 'l2d-send-btn' || btn.id === 'chat-send') {
                    return; 
                }
                e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
            }
        }, true);
    };

    
    document.querySelectorAll('[data-tooltip], [data-i18n-tooltip]').forEach(window.bindTooltipEvents);

    
    
    
    dom.chatSend.addEventListener('click', () => sendMessage(dom.chatInput.value));

    
    dom.chatInput.addEventListener('input', function() {
        this.style.height = 'auto'; 
        this.style.height = (this.scrollHeight) + 'px'; 
        if(this.value === '') this.style.height = 'auto'; 
    });
    
    
    dom.chatInput.addEventListener('keydown', (e) => {
        
        if (e.isComposing || e.keyCode === 229) return;
        
        
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            sendMessage(dom.chatInput.value); 
            dom.chatInput.style.height = 'auto'; 
        }
    });

    
    const btnUploadToggle = document.getElementById('btn-upload-toggle');
    const uploadPopup = document.getElementById('upload-popup');
    const btnUploadImg = document.getElementById('btn-upload-img');
    const btnUploadFile = document.getElementById('btn-upload-file');
    const imageUpload = document.getElementById('image-upload');

    if (btnUploadToggle) {
        
        btnUploadToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            uploadPopup.classList.toggle('hidden');
        });

        
        document.addEventListener('click', (e) => {
            if (!btnUploadToggle.contains(e.target) && !uploadPopup.contains(e.target)) {
                uploadPopup.classList.add('hidden');
            }
        });

        
        btnUploadFile.addEventListener('click', () => {
            dom.fileUpload.click();
            uploadPopup.classList.add('hidden');
        });

        
        btnUploadImg.addEventListener('click', () => {
            imageUpload.click();
            uploadPopup.classList.add('hidden');
        });
    }

    
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

    
    dom.fileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            fileContentBuffer = evt.target.result;
            attachedFile = { name: file.name, type: 'file', data: evt.target.result }; 
            
            
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

    
    function switchMode(targetMode) {
        if (targetMode === 'live2d') {
            dom.btnLive2DSettings.classList.remove('hidden'); 
            
            if (!appSettings.live2dLangSet) {
                dom.selOutputLang.disabled = false;
                dom.langModal.classList.remove('hidden');
            } else {
                dom.viewChat.classList.add('hidden'); 
                
                
                dom.viewLive2D.classList.remove('hidden', 'l2d-hidden'); 
                
                dom.btnModeLive2D.classList.add('active'); dom.btnModeChat.classList.remove('active');
                currentMode = 'live2d'; 

                if (!live2dApp) { 
                    initLive2D(); 
                } else { 
                    live2dApp.start(); 
                    
                    setTimeout(() => {
                        live2dApp.resize();
                        updateLive2DScale(live2dModelInstance);
                    }, 50); 
                }
            }
        } else {
            dom.btnLive2DSettings.classList.add('hidden'); 
            dom.viewChat.classList.remove('hidden'); 
            
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
        appSettings.voiceToggle = (dom.selVoiceToggle.value === 'on'); 
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
        
        dom.selVoiceToggle.value = appSettings.voiceToggle === false ? 'off' : 'on';
        dom.selVoiceToggle.dispatchEvent(new Event('change'));
        dom.langModal.classList.remove('hidden');
        closeSidebarHandler();
    });

    
    dom.selVoiceToggle.addEventListener('change', (e) => {
        const isOff = e.target.value === 'off';
        dom.selInputLang.disabled = isOff;
        dom.selOutputLang.disabled = isOff;
        
        
        dom.selInputLang.parentNode.style.opacity = isOff ? '0.4' : '1';
        dom.selOutputLang.parentNode.style.opacity = isOff ? '0.4' : '1';
        dom.selInputLang.style.cursor = isOff ? 'not-allowed' : 'pointer';
        dom.selOutputLang.style.cursor = isOff ? 'not-allowed' : 'pointer';
    });

    function smoothScrollToBottom() { dom.chatHistory.scrollTo({ top: dom.chatHistory.scrollHeight, behavior: 'smooth' }); }

    
    
    
    let l2dInputMode = 'auto'; 
    let recognition = null;
    let isSpeechRecording = false;
    let live2dModelInstance = null; 

    const sttLangMap = { 'cantonese': 'zh-HK', 'mandarin': 'zh-CN', 'japanese': 'ja-JP', 'english': 'en-US' };
    const ttsLangMap = { 'cantonese': 'zh-HK', 'mandarin': 'zh-CN', 'japanese': 'ja-JP', 'english': 'en-US' };

    function initWebSpeechAPI() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        
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
                
                sendLive2DMessage(resultText);
            }
        };

        
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

    
    
    
    function toggleL2dSpeech() {
        
        if (isSpeechRecording && recognition) {
            recognition.stop();
            return;
        }

        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("⚠️ 無法啟動麥克風！\n原因 1：瀏覽器不支援 (請使用 Safari 或 Chrome)。\n原因 2：您目前未使用 HTTPS 安全連線 (手機端嚴格要求)。\n👉 解決方案：請確保您是用 Cloudflare Tunnel (https://...) 的網址開啟此網頁！");
            return;
        }

        
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        
        
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
            
            stopL2dRecognition();
        };

        recognition.onend = () => { 
            stopL2dRecognition(); 
            
            recognition = null; 
        };

        
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') audioContext.resume();

        
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
        if (!window.audioContext) {
        window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (window.audioContext.state === 'suspended') {
            window.audioContext.resume();
        }

        ttsInterruptToken++; 
        const myToken = ttsInterruptToken; 

        
        const isVoiceEnabled = appSettings.voiceToggle !== false;

        let textToSpeak = fullText;
        let textToDisplay = fullText;

        
        const voiceRegex = /\[\s*VOICE\s*\]([\s\S]*?)(?:\[\s*\/\s*VOICE\s*\]|$)/i;
        const textRegex = /\[\s*TEXT\s*\]([\s\S]*?)(?:\[\s*\/\s*TEXT\s*\]|$)/i;
        
        const voiceMatch = fullText.match(voiceRegex);
        const textMatch = fullText.match(textRegex);

        if (voiceMatch) textToSpeak = voiceMatch[1].trim(); 
        
        if (textMatch) {
            textToDisplay = textMatch[1].trim(); 
        } else if (voiceMatch) {
            
            textToDisplay = fullText.replace(voiceRegex, '').trim(); 
        }

        
        textToDisplay = textToDisplay.replace(/\[\s*\/?\s*(VOICE|TEXT)\s*\]/gi, '').trim();
        textToSpeak = textToSpeak.replace(/\[\s*\/?\s*(VOICE|TEXT)\s*\]/gi, '').trim();

        
        textToSpeak = textToSpeak.replace(/[*#_`~]/g, '');

        const targetLang = appSettings.outputLang || 'cantonese';
        
        
        
        const langMap = { 'cantonese': 'yue', 'mandarin': 'zh', 'japanese': 'ja', 'english': 'en' };
        const mappedLang = langMap[targetLang] || 'yue';

        
        const splitRegex = /[^，。、！？,.!?\n]+[，。、！？,.!?\n]*/g;
        const voiceSentences = textToSpeak.match(splitRegex) || [textToSpeak];
        const textSentences = textToDisplay.match(splitRegex) || [textToDisplay];
        
        if (currentAudio) {
            
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
            if (myToken !== ttsInterruptToken) return;

            if (sentenceQueue.length === 0) {
                ttsSpeaking = false;
                setTimeout(() => { 
                    if(!ttsSpeaking && myToken === ttsInterruptToken) {
                        const bubble = document.getElementById('live2d-speech-bubble');
                        if (bubble) bubble.classList.add('hidden'); 
                    }
                }, 3000);
                return;
            }
            
            const currentItem = sentenceQueue.shift();
            const encodedText = encodeURIComponent(currentItem.voice);
            let baseUrl = appSettings.ttsApiUrl;

            
            
            
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
                
                let typingTime = (duration * 1000) - 200;
                if (typingTime < textToType.length * 20) {
                    typingTime = (duration * 1000); 
                }
                const speed = Math.max(20, typingTime / textToType.length);

                let charIndex = 0;
                if (window.live2dTypeInterval) clearInterval(window.live2dTypeInterval);
                if (window.live2dTypeDelay) clearTimeout(window.live2dTypeDelay);

                window.live2dTypeDelay = setTimeout(() => {
                    if (bubble) {
                        bubble.className = `live2d-bubble mood-${live2dMood}`;
                        window.live2dTypeInterval = setInterval(() => {
                            charIndex++;
                            const txtBox = bubble.querySelector('.bubble-text');
                            if(txtBox) txtBox.innerText = baseText + textToType.substring(0, charIndex);
                            if (charIndex >= textToType.length) {
                                clearInterval(window.live2dTypeInterval);
                            }
                        }, speed);
                    }
                }, 0); 
            }

            function handleAudioEnded() {
                if (myToken !== ttsInterruptToken) return;

                if (window.live2dTypeDelay) clearTimeout(window.live2dTypeDelay);
                if (window.live2dTypeInterval) clearInterval(window.live2dTypeInterval);
                accumulatedText = baseText + textToType; 
                const bubble = document.getElementById('live2d-speech-bubble');
                if (bubble) {
                    bubble.className = `live2d-bubble mood-${live2dMood}`;
                    const txtBox = bubble.querySelector('.bubble-text');
                    if(txtBox) txtBox.innerText = accumulatedText;
                }
                playNextQueue();
            }

            function executeSilentTyping(isGuest = false) {
                if (!isGuest) {
                    console.warn("⚠️ 所有 TTS API 無回應，啟動無聲逐字顯示模式");
                }
                const estimatedSeconds = Math.max(1.0, textToType.length * 0.2);
                triggerTypewriter({ duration: estimatedSeconds });
                setTimeout(() => {
                    handleAudioEnded();
                }, (estimatedSeconds * 1000) + 800);
            }

            
            if (!currentUser || !isVoiceEnabled || !baseUrl) {
                executeSilentTyping(true); 
                return;
            }

            if (!baseUrl.endsWith('/')) baseUrl += '/';
            const primaryUrl = `${baseUrl}?text=${encodedText}&text_language=${mappedLang}`;

            
            
            
            currentAudio = new Audio(primaryUrl);
            currentAudio.crossOrigin = "anonymous"; 

            let isFallbackTriggered = false;

            currentAudio.onplaying = () => { 
                if (myToken !== ttsInterruptToken) { currentAudio.pause(); return; } 
                triggerTypewriter(currentAudio);
                
                if (!window.audioAnalyser) {
                    window.audioAnalyser = window.audioContext.createAnalyser();
                    window.audioAnalyser.fftSize = 256; 
                    window.audioAnalyser.connect(window.audioContext.destination); 
                }
                if (!currentAudio.sourceNode) {
                    try {
                        currentAudio.sourceNode = window.audioContext.createMediaElementSource(currentAudio);
                        currentAudio.sourceNode.connect(window.audioAnalyser);
                    } catch(e) { 
                        console.warn("Live2D 分析器綁定失敗，可能因跨域限制。聲音將維持原始輸出:", e); 
                    }
                }
            };

            currentAudio.onerror = () => {
                if (myToken !== ttsInterruptToken) return; 
                
                if (isFallbackTriggered) return;
                isFallbackTriggered = true;
                console.warn("⚡ 主伺服器失效，嘗試安全重新播放一次...");
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
                    executeSilentTyping();
                };
                
                safeAudio.play().catch(e => {
                    if (e.name === 'NotAllowedError') handleAudioEnded();
                    else if (!safeFailed) {
                        safeFailed = true;
                        safeAudio.onerror(); 
                    }
                });
            };

            if (sentenceQueue.length > 0 && appSettings.ttsApiUrl) {
                let baseUrl = appSettings.ttsApiUrl;
                if (!baseUrl.endsWith('/')) baseUrl += '/';
                const nextUrl = `${baseUrl}?text=${encodeURIComponent(sentenceQueue[0].voice)}&text_language=${mappedLang}`;
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

    
    
    
    function setupHiyoriBiomimeticTicker(app, model) {
        const bubble = document.getElementById('live2d-speech-bubble');
        
        
        if (typeof app.locals === 'undefined') app.locals = { tickTime: 0 };

        app.ticker.add(() => {
            if (!model || !model.internalModel || !model.internalModel.coreModel) return;

            try {
                
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

                        
                        if (!app.locals.rmsBuffer) app.locals.rmsBuffer = [];
                        app.locals.rmsBuffer.push(currentRms);
                        
                        
                        
                        
                        
                        const delayFrames = 12; 
                        
                        if (app.locals.rmsBuffer.length > delayFrames) {
                            app.locals.rmsBuffer.shift();
                        }
                        
                        
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
                            if (app.locals.rmsBuffer) app.locals.rmsBuffer = []; 
                        }
                    }

                    
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
                    

                    
                    if (bubble && bubble.dataset.baseX) {
                        const isMobile = window.innerWidth <= 768; 

                        
                        
                        let offsetX, offsetY;
                        
                        
                        if (isMobile) {
                            offsetX = (bodyAngleX * 1.5) - (angleX * 0.3);
                            offsetY = -(angleY * 0.6); 
                        } else {
                            offsetX = (bodyAngleX * 2.0) - (angleX * 0.6);
                            offsetY = -(angleY * 0.8); 
                        }

                        
                        
                        
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
            file_context: currentFilePayload ? currentFilePayload.data : "", 
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
                            
                            
                            if (dataObj.text && dataObj.text.includes('[CLEAR_LOCAL_STORAGE]')) {
                                alert(dataObj.text.replace('[CLEAR_LOCAL_STORAGE]', ''));
                                localStorage.clear(); window.location.reload(); return;
                            }

                            
                            if (fullAiResponse.length < 10 && dataObj.text) {
                                if (/excited|激動|興奮|大喊|shout|intense/i.test(fullAiResponse + dataObj.text)) {
                                    live2dMood = 'excited';
                                    bubble.className = "live2d-bubble mood-excited"; 
                                } else {
                                    live2dMood = 'calm';
                                    bubble.className = "live2d-bubble mood-calm"; 
                                }
                            }

                            fullAiResponse += dataObj.text;
                        } catch (e) {}
                    }
                }
            }

            
            speakFrontendTTS(fullAiResponse);

            
            live2dFullHistory.push({ role: 'ai', content: fullAiResponse });
            saveL2dHistory();
            renderL2dHistory();

            
            
            let userMsgObj = { role: 'user', content: text };
            if (currentFilePayload) {
                userMsgObj.file = { ...currentFilePayload };
            }
            live2dMessages.push(userMsgObj);
            live2dMessages.push({ role: 'ai', content: fullAiResponse });

            
            document.getElementById('l2d-chat-input').value = "";

        } catch (err) {
            bubble.querySelector('.bubble-text').innerText = "⚠️ 網路連線失敗";
        } finally {
            
            l2dSendBtn.disabled = false;
            l2dMicBtn.disabled = false;
            if (l2dInputMode === 'verify') {
                l2dInput.readOnly = false;
            }
            
            isProcessingRequest = false;
        }
    }

    
    
    
    
    
    
    
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
            
            model.scale.set(0.25); 
            
            model.x = -model.width * 0.31; 
            model.y = logicalHeight - model.height + (model.height * 0.25); 
        } else {
            
            const unscaledHeight = model.height / model.scale.y;
            let maxAllowableScale = (logicalHeight - 5) / (unscaledHeight * 0.75);
            let finalScale = Math.min(0.35, maxAllowableScale);
            model.scale.set(finalScale);
            
            model.x = (logicalWidth - model.width) / 2; 
            model.y = logicalHeight - model.height + (model.height * 0.25);
        }

        
        const bubble = document.getElementById('live2d-speech-bubble');
        const historyPanel = document.getElementById('l2d-history-panel'); 

        if (bubble) {
            let headY = model.y + model.height * (isMobile ? 0.12 : 0.20);
            let headX = isMobile ? (logicalWidth * 0.51) : (logicalWidth / 2 + 100);

            
            let panelOffset = 0;
            if (!isMobile && historyPanel && !historyPanel.classList.contains('hidden')) {
                panelOffset = 370; 
            }

            
            let maxAvailableSpace = logicalWidth - headX - panelOffset - 20; 

            
            let absoluteLimit = isMobile ? maxAvailableSpace : 700;

            
            let bubbleMaxWidth = Math.min(maxAvailableSpace, absoluteLimit); 

            
            if (isMobile && bubbleMaxWidth < 180) {
                headX = logicalWidth * 0.20; 
                bubbleMaxWidth = logicalWidth - headX - 20; 
            }

            bubble.style.maxWidth = `${bubbleMaxWidth}px`;
            
            
            bubble.style.minWidth = isMobile ? "80px" : "120px"; 

            bubble.dataset.baseX = headX;
            bubble.dataset.baseY = headY; 
            
            const bHeight = bubble.offsetHeight || 60;
            bubble.style.left = `${headX}px`;
            bubble.style.top = `${headY - (bHeight / 2)}px`;
        }
    }

   
    window.addEventListener('resize', () => {
        if (live2dModelInstance && currentMode === 'live2d') {
            
            
            if (window.innerWidth !== window.physicalWidth) {
                setTimeout(() => updateLive2DScale(live2dModelInstance), 100);
            }
        }
    });

    
    
    
    window.toggleSakuraPetals = function() {
        const container = document.getElementById('view-live2d');
        if (!container) return;

        
        
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (prefersReducedMotion) {
            console.warn("⚠️ 偵測到系統效能限制，已自動強制關閉櫻花特效");
            appSettings.sakuraEffect = false;
            if (dom.selSakuraEffect) dom.selSakuraEffect.value = 'off';
        }

        
        container.querySelectorAll('.sakura-petal').forEach(p => p.remove());

        
        if (appSettings.sakuraEffect === false) return;

        
        try {
            for (let i = 0; i < 50; i++) {
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

        
        window.toggleSakuraPetals();

        const canvas = document.getElementById('live2d-canvas');
        const stageContainer = document.getElementById('live2d-stage-container');
        const bubble = document.getElementById('live2d-speech-bubble');
        
        
        const loadingOverlay = document.getElementById('live2d-loading');
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');

        
        if (!window.Live2DCubismCore) {
            bubble.querySelector('.bubble-text').innerText = "⚠️ 核心引擎載入失敗！\n請關閉「擋廣告擴充套件(AdBlock)」或「Brave 護盾」後重整網頁。";
            bubble.classList.remove('hidden');
            if (loadingOverlay) loadingOverlay.classList.add('hidden'); 
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
            if (loadingOverlay) loadingOverlay.classList.add('hidden'); 
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
            
            if (loadingOverlay) loadingOverlay.classList.add('hidden');
        }
    }
    
    
    
    function setupLive2DControls() {
        const dict = translations[appSettings.appLang || 'en'];
        const btnVerify = document.getElementById('btn-l2d-mode-verify');
        const l2dInput = document.getElementById('l2d-chat-input');
        const l2dSendBtn = document.getElementById('l2d-send-btn');
        const l2dMicBtn = document.getElementById('l2d-mic-btn');
        const dashboard = document.querySelector('.live2d-dashboard');
        
        if (l2dMicBtn) l2dMicBtn.innerHTML = svgMic;

        
        
        
        if (dashboard && btnVerify && !document.getElementById('l2d-upload-container')) {
            
            const uploadContainer = document.createElement('div');
            uploadContainer.id = 'l2d-upload-container';
            uploadContainer.className = 'l2d-upload-container';

            
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'btn-l2d-upload-toggle';
            toggleBtn.className = 'icon-btn';
            toggleBtn.style.width = '38px'; toggleBtn.style.height = '38px';
            toggleBtn.style.fontSize = '22px'; toggleBtn.style.lineHeight = '38px';
            toggleBtn.innerHTML = '＋';

            
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

            
            const preview = document.createElement('div');
            preview.id = 'l2d-upload-preview';
            preview.className = 'hidden';

            
            uploadContainer.appendChild(toggleBtn);
            uploadContainer.appendChild(popup);
            uploadContainer.appendChild(preview);
            dashboard.insertBefore(uploadContainer, btnVerify.parentNode);

            
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

        
        if (btnVerify) {
            btnVerify.innerHTML = svgPen;
            
            window.bindTooltipEvents(btnVerify);

            
            if (l2dInputMode === 'verify') {
                btnVerify.classList.add('active');
                l2dInput.readOnly = false;
                l2dInput.placeholder = dict.l2d_placeholder_verify;
                if (l2dSendBtn) l2dSendBtn.classList.remove('hidden');
                
                
                btnVerify.setAttribute('data-i18n-tooltip', 'tooltip_l2d_verify');
                btnVerify.setAttribute('data-tooltip', dict.tooltip_l2d_verify);
            } else {
                btnVerify.classList.remove('active');
                l2dInput.readOnly = true;
                l2dInput.placeholder = dict.l2d_placeholder_auto;
                if (l2dSendBtn) l2dSendBtn.classList.add('hidden');
                
                
                btnVerify.setAttribute('data-i18n-tooltip', 'tooltip_l2d_auto');
                btnVerify.setAttribute('data-tooltip', dict.tooltip_l2d_auto);
            }

            btnVerify.onclick = () => {
                if (l2dInputMode === 'auto') {
                    l2dInputMode = 'verify';
                    btnVerify.classList.add('active');
                    l2dInput.readOnly = false;
                    l2dInput.placeholder = dict.l2d_placeholder_verify;
                    if (l2dSendBtn) l2dSendBtn.classList.remove('hidden');
                    
                    
                    btnVerify.setAttribute('data-i18n-tooltip', 'tooltip_l2d_verify');
                    btnVerify.setAttribute('data-tooltip', dict.tooltip_l2d_verify);
                } else {
                    l2dInputMode = 'auto';
                    btnVerify.classList.remove('active');
                    l2dInput.readOnly = true;
                    l2dInput.placeholder = dict.l2d_placeholder_auto;
                    if (l2dSendBtn) l2dSendBtn.classList.add('hidden');
                    
                    
                    btnVerify.setAttribute('data-i18n-tooltip', 'tooltip_l2d_auto');
                    btnVerify.setAttribute('data-tooltip', dict.tooltip_l2d_auto);
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

    
    
    
    const btnL2dHistory = document.getElementById('btn-l2d-history');
    const panelL2dHistory = document.getElementById('l2d-history-panel');
    const closeL2dHistory = document.getElementById('close-l2d-history');

    function saveL2dHistory() {
        let saved = false;
        
        
        while (!saved) {
            try {
                localStorage.setItem('hkiit_l2d_history', JSON.stringify(live2dFullHistory));
                saved = true; 
            } catch (e) {
                console.warn("⚠️ Live2D 紀錄快取已滿，啟動智慧降維壓縮（逐一清除最舊圖片）...");
                
                
                let oldestImageMsgIndex = -1;
                for (let i = 0; i < live2dFullHistory.length; i++) {
                    const msg = live2dFullHistory[i];
                    if (msg.file && msg.file.type === 'image' && msg.file.data) {
                        oldestImageMsgIndex = i;
                        break; 
                    }
                }
                
                
                if (oldestImageMsgIndex !== -1) {
                    live2dFullHistory[oldestImageMsgIndex].file.data = ""; 
                    
                } else {
                    
                    console.error("無法儲存：圖片已全數降維，強行清理最舊的對話以釋放空間...");
                    if (live2dFullHistory.length > 10) {
                        
                        live2dFullHistory.splice(0, 10); 
                    } else {
                        
                        break; 
                    }
                }
            }
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
            textEl.style.display = 'flex';
            textEl.style.flexDirection = 'column';
            textEl.style.alignItems = 'flex-start';
            textEl.style.gap = '8px'; 
            
            let cleanText = msg.content || '';
            const textRegex = /\[\s*TEXT\s*\]([\s\S]*?)(?:\[\s*\/\s*TEXT\s*\]|$)/i;
            const voiceRegex = /\[\s*VOICE\s*\]([\s\S]*?)(?:\[\s*\/\s*VOICE\s*\]|$)/i;

            if (textRegex.test(cleanText)) {
                cleanText = cleanText.match(textRegex)[1].trim();
            } else {
                if (voiceRegex.test(cleanText)) cleanText = cleanText.replace(voiceRegex, '');
                cleanText = cleanText.replace(/\[\s*\/?\s*(VOICE|TEXT)\s*\]/gi, '').trim();
            }

            
            
            
            if (msg.file) {
                if (msg.file.type === 'image') {
                    if (msg.file.data) {
                        const imgEl = document.createElement('img');
                        imgEl.src = msg.file.data;
                        imgEl.style.maxWidth = '180px';
                        imgEl.style.maxHeight = '180px';
                        imgEl.style.borderRadius = '12px';
                        imgEl.style.display = 'block';
                        imgEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                        imgEl.style.cursor = 'pointer';
                        
                        
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
                        textEl.appendChild(imgEl); 
                    } else {
                        
                        const imgFallback = document.createElement('div');
                        imgFallback.style.fontSize = '13px'; imgFallback.style.opacity = '0.7';
                        imgFallback.innerText = `🖼️ 圖片: ${msg.file.name} (已成功上傳)`;
                        textEl.appendChild(imgFallback); 
                    }
                } else if (msg.file.type === 'file') {
                    const fileBox = document.createElement('div');
                    fileBox.style.display = 'flex'; fileBox.style.alignItems = 'center'; fileBox.style.gap = '6px';
                    fileBox.style.padding = '6px 12px'; 
                    fileBox.style.background = msg.role === 'user' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(128, 128, 128, 0.1)';
                    fileBox.style.borderRadius = '10px'; fileBox.style.fontSize = '13px';
                    fileBox.style.width = 'max-content'; fileBox.style.maxWidth = '100%';
                    fileBox.innerHTML = `📄 <span style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${msg.file.name}</span>`;
                    textEl.appendChild(fileBox); 
                }
            }

            
            
            
            if (cleanText) {
                const textSpan = document.createElement('div');
                textSpan.innerText = cleanText;
                textEl.appendChild(textSpan);
            }

            
            item.appendChild(roleEl);
            item.appendChild(textEl);
            contentBox.appendChild(item);
        });

    setTimeout(() => {
        contentBox.scrollTo({ top: contentBox.scrollHeight, behavior: 'smooth' });
    }, 50);
}

    if (btnL2dHistory && panelL2dHistory) {
        
        btnL2dHistory.onclick = () => {
            panelL2dHistory.classList.toggle('hidden');
            renderL2dHistory();
            if (currentMode === 'live2d' && live2dModelInstance) {
                updateLive2DScale(live2dModelInstance);
            }
        };
        
    }
    
    
    
    
    const dropZones = [
        document.querySelector('.input-box'), 
        document.querySelector('.l2d-input-bar')
    ];

    dropZones.forEach(zone => {
        if (!zone) return;

        
        zone.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            e.stopPropagation();
            zone.classList.add('drag-over');
        });

        
        zone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('drag-over');
        });

        
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('drag-over'); 

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                
                
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);

                
                
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

    
    
    
    const syncRealHeight = () => {
        const realHeight = window.innerHeight;
        
        document.documentElement.style.setProperty('--app-height', `${realHeight}px`);
        
        document.documentElement.style.setProperty('--physical-height', `${realHeight}px`);
    };
    window.addEventListener('resize', syncRealHeight);
    syncRealHeight(); 

    
    
    
    window.lastVvHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

    const setAppHeight = () => {
        const vv = window.visualViewport;
        if (!vv) return;

        const newHeight = vv.height;
        const deltaY = window.lastVvHeight - newHeight;

        const targets = [
            document.getElementById('chat-history'),
            document.querySelector('.input-container'),
            document.getElementById('live2d-stage-container'),
            document.querySelector('.live2d-dashboard'),
            document.getElementById('live2d-speech-bubble')
        ].filter(e => e);

        targets.forEach(el => el.classList.add('flip-anim-target'));

        if (Math.abs(deltaY) > 40 && window.innerWidth <= 768) {
            document.documentElement.style.setProperty('--kb-offset', `${deltaY}px`);
            targets.forEach(el => { el.classList.remove('kb-animating'); el.classList.add('kb-setup'); });

            document.documentElement.style.setProperty('--app-height', `${newHeight}px`);

            if (currentMode === 'chat') {
                dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;
            } else if (currentMode === 'live2d' && window.live2dModelInstance) {
                updateLive2DScale(window.live2dModelInstance);
            }

            void document.documentElement.offsetHeight;

            targets.forEach(el => { el.classList.remove('kb-setup'); el.classList.add('kb-animating'); });
            document.documentElement.style.setProperty('--kb-offset', `0px`);

            clearTimeout(window.kbAnimTimer);
            window.kbAnimTimer = setTimeout(() => {
                targets.forEach(el => el.classList.remove('kb-animating'));
            }, 380);
        } else {
            document.documentElement.style.setProperty('--app-height', `${newHeight}px`);
            if (currentMode === 'chat') {
                dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;
            }
        }

        window.lastVvHeight = newHeight;

        
        const header = document.getElementById('app-header');
        const sidebar = document.getElementById('sidebar');
        const isAndroid = /Android/i.test(navigator.userAgent);

        if (!isAndroid) {
            
            const offsetTop = vv.offsetTop;
            if (offsetTop > 0) window.scrollTo(0, 0);
            if (header) header.style.transform = `translate3d(0, ${offsetTop}px, 0)`;
            if (sidebar) sidebar.style.top = `${offsetTop}px`;
        } else {
            
            if (header) header.style.transform = `translate3d(0, 0, 0)`;
        }
    };

    if (window.visualViewport) {
        let isUpdating = false;
        const onViewportChange = () => {
            if (!isUpdating) {
                isUpdating = true;
                requestAnimationFrame(() => { setAppHeight(); isUpdating = false; });
            }
        };
        window.visualViewport.addEventListener('resize', onViewportChange);
        window.visualViewport.addEventListener('scroll', onViewportChange);
    }
    
    window.addEventListener('resize', setAppHeight);
    setAppHeight();

    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(inp => {
        inp.addEventListener('focus', () => {
            setTimeout(() => {
                window.scrollTo(0, 0);
                if (currentMode === 'chat') dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;
            }, 80);
        });
    });

    
    
    
    
    const headerLeft = document.querySelector('.header-left');
    const langContainer = document.querySelector('.lang-container');
    if (headerLeft && langContainer) {
        headerLeft.appendChild(langContainer);
    }

}); 