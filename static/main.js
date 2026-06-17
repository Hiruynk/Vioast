document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. 狀態與設定管理
    // ==========================================
    let currentMode = 'chat'; 
    let isAmadeus = false;
    let live2dApp = null;
    let fileContentBuffer = ""; 

    let chatSessions = JSON.parse(localStorage.getItem('hkiit_chat_sessions')) || [];
    let currentSessionId = Date.now();
    let currentMessages = [];

    let appSettings = {
        model: 'gemini', apiKey: '', theme: 'auto',
        inputLang: 'cantonese', outputLang: 'cantonese', textLang: 'chinese',
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
        btnReturnSG: document.getElementById('btn-return-sg'),
        viewChat: document.getElementById('view-chat'),
        viewLive2D: document.getElementById('view-live2d'),
        langModal: document.getElementById('lang-modal'),
        closeLangModal: document.getElementById('close-lang-modal'),
        betaModal: document.getElementById('beta-modal'),
        btnStartLive2D: document.getElementById('btn-start-live2d'),
        selInputLang: document.getElementById('sel-input-lang'),
        selOutputLang: document.getElementById('sel-output-lang'),
        selTextLang: document.getElementById('sel-text-lang'),
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
            settings_local_url: `${svgLink} Local Node URL (Ngrok):`, settings_local_model: `${svgBot} Local Model Name:`,
            placeholder_local_url: "e.g., https://xxxx.ngrok-free.app", placeholder_local_model: "e.g., gemma4:12b",
            placeholder_api_key: "Enter your API Key",
            settings_theme: "🌗 Theme Appearance:", theme_auto: "Follow System (Auto)",
            theme_light: "Light Mode", theme_dark: "Dark Mode",
            settings_success: `${svgCheck} Saved successfully!`, settings_save_btn: "Save Settings",
            live2d_subtitle: "Click the microphone button on the bottom right to talk to me",
            voice_header: `${svgSettings} Voice Dialogue Settings`, voice_input_lang: `${svgMic} Your Input Language:`,
            voice_output_lang: `${svgSpeaker} AI Voice Output:`, voice_text_lang: `${svgPen} Screen Display Text:`,
            lang_cantonese: "Cantonese", lang_mandarin: "Mandarin", lang_japanese: "Japanese", lang_english: "English",
            lang_chinese_text: "Chinese", lang_english_text: "English", voice_start_btn: "Confirm and Enter",
            model_gemini_desc: "Fastest Response", model_gemma_desc: "Local Computing",
            err_no_api_key: `${svgWarn} Please click Settings (${svgSettingsInline}) in the sidebar to enter your Gemini API Key.`,
            err_network: "System connection error. Please ensure the backend server is running.",
            btn_copy: `${svgCopy} Copy`, btn_copied: `${svgCheck} Copied`, btn_copy_fail: `${svgFail} Failed`,
            upload_image: "Image", upload_file: "Attachment",
            tooltip_upload: "Upload",
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
            settings_local_url: `${svgLink} 本地節點 URL (Ngrok)：`, settings_local_model: `${svgBot} 本地模型名稱：`,
            placeholder_local_url: "例如 https://xxxx.ngrok-free.app", placeholder_local_model: "例如 gemma4:12b",
            placeholder_api_key: "輸入您的 API 密鑰",
            settings_theme: "🌗 外觀主題：", theme_auto: "跟隨系統 (Auto)",
            theme_light: "淺色模式 (Light)", theme_dark: "深色模式 (Dark)",
            settings_success: `${svgCheck} 儲存成功！`, settings_save_btn: "儲存設定",
            live2d_subtitle: "點擊右下角麥克風與我對話",
            voice_header: `${svgSettings} 語音對話設定`, voice_input_lang: `${svgMic} 您的輸入語言：`,
            voice_output_lang: `${svgSpeaker} AI 語音輸出：`, voice_text_lang: `${svgPen} 螢幕顯示文字：`,
            lang_cantonese: "廣東話", lang_mandarin: "普通話", lang_japanese: "日文", lang_english: "英文",
            lang_chinese_text: "中文", lang_english_text: "英文", voice_start_btn: "確認並進入",
            model_gemini_desc: "回覆最快", model_gemma_desc: "本地運算",
            err_no_api_key: `${svgWarn} 請先點擊側邊欄設定 (${svgSettingsInline}) 填寫您的 Gemini API Key。`,
            err_network: "系統連接錯誤。請確認後端伺服器運行中。",
            btn_copy: `${svgCopy} 複製`, btn_copied: `${svgCheck} 已複製`, btn_copy_fail: `${svgFail} 失敗`,
            upload_image: "圖片", upload_file: "附件",
            tooltip_upload: "上傳",
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
            settings_local_url: `${svgLink} 本地节点 URL (Ngrok)：`, settings_local_model: `${svgBot} 本地模型名称：`,
            placeholder_local_url: "例如 https://xxxx.ngrok-free.app", placeholder_local_model: "例如 gemma4:12b",
            placeholder_api_key: "输入您的 API 密钥",
            settings_theme: "🌗 外观主题：", theme_auto: "跟随系统 (Auto)",
            theme_light: "浅色模式 (Light)", theme_dark: "深色模式 (Dark)",
            settings_success: `${svgCheck} 储存成功！`, settings_save_btn: "储存设定",
            live2d_subtitle: "点击右下角麦克风与我对话",
            voice_header: `${svgSettings} 语音对话设定`, voice_input_lang: `${svgMic} 您的输入语言：`,
            voice_output_lang: `${svgSpeaker} AI 语音输出：`, voice_text_lang: `${svgPen} 屏幕显示文字：`,
            lang_cantonese: "广东话", lang_mandarin: "普通话", lang_japanese: "日文", lang_english: "英文",
            lang_chinese_text: "中文", lang_english_text: "英文", voice_start_btn: "确认并进入",
            model_gemini_desc: "回复最快", model_gemma_desc: "本地运算",
            err_no_api_key: `${svgWarn} 请先点击侧边栏设定 (${svgSettingsInline}) 填写您的 Gemini API Key。`,
            err_network: "系统连接错误。请确认后端服务器运行中。",
            btn_copy: `${svgCopy} 复制`, btn_copied: `${svgCheck} 已复制`, btn_copy_fail: `${svgFail} 失败`,
            upload_image: "图片", upload_file: "附件",
            tooltip_upload: "上传",
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
                appSettings.apiKey = data.api_key || ""; 
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
            appSettings.model = item.getAttribute('data-value');
            localStorage.setItem('hkiit_settings', JSON.stringify(appSettings));
            updateModelBadge();
            dom.dropdownMenu.classList.add('hidden');
        });
    });

    // 語言選擇監聽 (確保放置於全域作用域)
    dom.langDropdownItems.forEach(item => {
        item.addEventListener('click', () => {
            appSettings.appLang = item.getAttribute('data-value');
            localStorage.setItem('hkiit_settings', JSON.stringify(appSettings));
            applyLanguage();
            startNewChat(); 
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
        updateModelBadge(); 
        dom.settingsModal.classList.remove('hidden'); 
        closeSidebarHandler(); 
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
                // 將原本的 dom.btnLogin.innerText = `👤 ${user}`; 替換為：
                dom.btnLogin.querySelector('span').innerText = user;
                appSettings.apiKey = data.api_key || ""; 
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
        appSettings.apiKey = dom.inpApiKey.value.trim(); 
        appSettings.localUrl = dom.inputLocalUrl.value.trim();
        appSettings.localModel = dom.inputLocalModel.value.trim();
        appSettings.theme = dom.selTheme.value;
        localStorage.setItem('hkiit_settings', JSON.stringify(appSettings));
        
        if (currentUser) {
            try {
                await fetch('/api/save_key', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({username: currentUser, api_key: appSettings.apiKey})
                });
            } catch(e) {}
        }
        applyTheme(); updateModelBadge(); 
        
        dom.settingsSuccess.style.display = 'block';
        setTimeout(() => { dom.settingsSuccess.style.display = 'none'; }, 2000); 
    });

    dom.closeLangModal.addEventListener('click', () => {
        dom.langModal.classList.add('hidden');
        switchMode('chat');
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
        if (isAmadeus) return; 
        document.documentElement.removeAttribute('data-theme');
        if (appSettings.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
        else if (appSettings.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    }
    
    function updateModelBadge() {
        dom.dropdownItems.forEach(i => {
            if(i.getAttribute('data-value') === appSettings.model) {
                i.classList.add('active');
                if(dom.selectedModelName) dom.selectedModelName.innerText = i.querySelector('.item-title').innerText;
            } else {
                i.classList.remove('active');
            }
        });
        
        dom.inpApiKey.value = appSettings.apiKey;
        dom.inputLocalUrl.value = appSettings.localUrl || '';
        dom.inputLocalModel.value = appSettings.localModel || 'gemma4:12b';
        dom.selTheme.value = appSettings.theme;

        if (appSettings.model === 'gemini') {
            dom.apiKeyContainer.style.display = 'block';
            dom.localNodeContainer.style.display = 'none';
        } else {
            dom.apiKeyContainer.style.display = 'none';
            dom.localNodeContainer.style.display = 'block';
        }
    }

    // ==========================================
    // 4. 對話歷史管理
    // ==========================================
    function startNewChat() {
        currentSessionId = Date.now();
        currentMessages = [];
        displayWelcomeMessage(true); 
        fileContentBuffer = "";
        dom.uploadPreview.classList.add('hidden');
        renderSidebar();
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
        if (idx >= 0) chatSessions[idx] = sessionData;
        else chatSessions.unshift(sessionData);
        localStorage.setItem('hkiit_chat_sessions', JSON.stringify(chatSessions));
        renderSidebar();
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
        
        // 修正 1：每次切換歷史對話時，確保首句歡迎詞優先被渲染
        displayWelcomeMessage(false); 
        
        currentMessages.forEach(msg => appendMessageUI(msg.content, msg.role, false));
        
        renderSidebar();
        closeSidebarHandler();
        setTimeout(smoothScrollToBottom, 100); 
    }

    // ==========================================
    // 5. 複製功能與 UI 渲染
    // ==========================================
    function copyTextToClipboard(text, btn) {
        const dict = translations[appSettings.appLang || 'en'];
        
        function showSuccess() {
            btn.classList.add('success');
            btn.innerHTML = dict.btn_copied;
            setTimeout(() => { 
                btn.classList.remove('success'); 
                btn.innerHTML = dict.btn_copy; 
            }, 1800); 
        }

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

    function appendMessageUI(rawText, role, animate = true) {
        const dict = translations[appSettings.appLang || 'en']; // 🛑 核心修復點：防止腳本崩潰
        if (!rawText) return;
        const div = document.createElement('div');
        div.className = `message ${animate ? 'slide-up' : ''} ${role === 'user' ? 'user-message' : 'ai-message'}`;

        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper';

        const content = document.createElement('div');
        content.className = 'msg-content';
        let cleanText = rawText;
        const voiceRegex = /\[VOICE\]([\s\S]*?)\[\/VOICE\]/;
        if (voiceRegex.test(cleanText)) {
            cleanText = cleanText.replace(voiceRegex, '').trim();
        }
        content.innerHTML = role === 'user' ? rawText.replace(/\n/g, '<br>') : marked.parse(rawText);

        const footer = document.createElement('div');
        footer.className = 'msg-footer';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.setAttribute('data-i18n', 'btn_copy');
        copyBtn.innerHTML = dict.btn_copy;
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

        if (text.trim() === "El Psy Kongroo" && !isAmadeus) {
            dom.betaModal.classList.remove('hidden'); dom.chatInput.value = ''; return;
        }

        const userText = text.trim() ? text : `[傳送了參考檔案]`;
        currentMessages.push({role: 'user', content: userText});
        saveSession();
        appendMessageUI(userText, 'user');
        dom.chatInput.value = '';

        if (appSettings.model === 'gemini' && !appSettings.apiKey) {
            appendMessageUI(dict.err_no_api_key, 'ai'); return;
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
            mode: currentMode, is_amadeus: isAmadeus,
            input_lang: appSettings.inputLang, output_lang: appSettings.outputLang, text_lang: appSettings.textLang,
            ai_model: appSettings.model, api_key: appSettings.apiKey, file_context: fileContentBuffer, 
            local_url: appSettings.localUrl,
            local_model_name: appSettings.localModel,
            app_lang: appSettings.appLang
        };

        fileContentBuffer = ""; dom.uploadPreview.classList.add('hidden');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody)
            });

            const reader = response.body.getReader();
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
                            aiTextContent += dataObj.text;
                            
                            if (currentMode === 'chat') {
                                if (isFirstChunk) { content.innerHTML = ""; isFirstChunk = false; }
                                content.innerHTML = marked.parse(aiTextContent);
                                smoothScrollToBottom(); 
                            } else {
                                dom.live2dSubtitle.innerText = aiTextContent;
                            }
                        } catch (e) {}
                    }
                }
            }

            currentMessages.push({role: 'ai', content: aiTextContent});
            saveSession();

            const footer = document.createElement('div');
            footer.className = 'msg-footer';
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn slide-up'; 
            copyBtn.setAttribute('data-i18n', 'btn_copy');
            copyBtn.innerHTML = dict.btn_copy;
            copyBtn.onclick = () => copyTextToClipboard(aiTextContent, copyBtn);
            footer.appendChild(copyBtn);
            wrapper.appendChild(footer);
            

        } catch (err) {
            content.innerText = dict.err_network;
        }
    }

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

    // 處理圖片上傳
    if (imageUpload) {
        imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                fileContentBuffer = evt.target.result; 
                dom.uploadPreview.innerText = `🖼️ 已附加圖片: ${file.name}`;
                dom.uploadPreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file); 
            e.target.value = ''; 
        });
    }

    // 處理一般文字/文檔附件上傳
    dom.fileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            fileContentBuffer = evt.target.result;
            dom.uploadPreview.innerText = `📄 已附加檔案: ${file.name}`;
            dom.uploadPreview.classList.remove('hidden');
        };
        reader.readAsText(file); 
        e.target.value = ''; 
    });

    // ===== 模式切換 (Chat vs Live2D) =====
    function switchMode(targetMode) {
        if (targetMode === 'live2d') {
            dom.btnLive2DSettings.classList.remove('hidden'); 
            if (!appSettings.live2dLangSet) {
                if (isAmadeus) { dom.selOutputLang.value = 'japanese'; dom.selOutputLang.disabled = true; } 
                else dom.selOutputLang.disabled = false;
                dom.langModal.classList.remove('hidden');
            } else {
                dom.viewChat.classList.add('hidden'); dom.viewLive2D.classList.remove('hidden');
                dom.btnModeLive2D.classList.add('active'); dom.btnModeChat.classList.remove('active');
                currentMode = 'live2d'; initLive2D();
            }
        } else {
            dom.btnLive2DSettings.classList.add('hidden'); 
            dom.viewChat.classList.remove('hidden'); dom.viewLive2D.classList.add('hidden');
            dom.btnModeChat.classList.add('active'); dom.btnModeLive2D.classList.remove('active');
            currentMode = 'chat'; smoothScrollToBottom();
        }
    }
    dom.btnModeChat.addEventListener('click', () => switchMode('chat'));
    dom.btnModeLive2D.addEventListener('click', () => switchMode('live2d'));

    dom.btnStartLive2D.addEventListener('click', () => {
        appSettings.inputLang = dom.selInputLang.value; appSettings.outputLang = dom.selOutputLang.value; appSettings.textLang = dom.selTextLang.value;
        appSettings.live2dLangSet = true; 
        localStorage.setItem('hkiit_settings', JSON.stringify(appSettings)); 

        dom.langModal.classList.add('hidden'); dom.viewChat.classList.add('hidden'); dom.viewLive2D.classList.remove('hidden');
        dom.btnModeLive2D.classList.add('active'); dom.btnModeChat.classList.remove('active');
        currentMode = 'live2d'; initLive2D();
    });

    dom.btnLive2DSettings.addEventListener('click', () => {
        if (isAmadeus) { dom.selOutputLang.value = 'japanese'; dom.selOutputLang.disabled = true; } 
        else dom.selOutputLang.disabled = false;
        dom.langModal.classList.remove('hidden');
        closeSidebarHandler();
    });

    // ===== Beta 世界線彩蛋 =====
    document.getElementById('btn-beta-yes').addEventListener('click', () => {
        isAmadeus = true; document.body.classList.add('amadeus-theme'); dom.betaModal.classList.add('hidden');
        dom.headerTitle.innerText = "Amadeus System"; dom.btnReturnSG.classList.remove('hidden');
        appendMessageUI("【系統提示】成功連接 Beta 世界線，Amadeus 系統已啟動。", 'ai');
    });
    document.getElementById('btn-beta-no').addEventListener('click', () => dom.betaModal.classList.add('hidden'));
    dom.btnReturnSG.addEventListener('click', () => {
        isAmadeus = false; document.body.classList.remove('amadeus-theme'); dom.btnReturnSG.classList.add('hidden');
        dom.headerTitle.innerText = "Open Day Assistant"; applyTheme(); switchMode('chat'); 
        appendMessageUI("【系統提示】已返回 Steins;Gate 世界線。", 'ai');
    });

    function smoothScrollToBottom() { dom.chatHistory.scrollTo({ top: dom.chatHistory.scrollHeight, behavior: 'smooth' }); }

    // ==========================================
    // 🌟 Live2D 核心架構、語音識別與仿生模擬 (放這裡！)
    // ==========================================
    let l2dInputMode = 'auto'; 
    let recognition = null;
    let isSpeechRecording = false;
    let live2dModelInstance = null; 
    let ttsSpeaking = false;

    const sttLangMap = { 'cantonese': 'zh-HK', 'mandarin': 'zh-CN', 'english': 'en-US' };
    const ttsLangMap = { 'cantonese': 'zh-HK', 'mandarin': 'zh-CN', 'japanese': 'ja-JP', 'english': 'en-US' };

    function initWebSpeechAPI() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("此瀏覽器不支援 Web Speech API");
            return;
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
                // 直發模式：直接呼叫後端發送，且不允許修改
                sendLive2DMessage(resultText);
            }
        };

        recognition.onerror = () => { stopL2dRecognition(); };
        recognition.onend = () => { stopL2dRecognition(); };
    }

    function toggleL2dSpeech() {
        if (!recognition) initWebSpeechAPI();
        if (isSpeechRecording) {
            recognition.stop();
        } else {
            recognition.lang = sttLangMap[appSettings.inputLang] || 'zh-HK';
            recognition.start();
        }
    }

    function stopL2dRecognition() {
        isSpeechRecording = false;
        document.getElementById('l2d-mic-btn').classList.remove('recording');
    }

    function speakFrontendTTS(fullText) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel(); // 斬斷前一個未說完的話

        let textToSpeak = fullText;
        let textToDisplay = fullText;

        // 解析 [VOICE] 標籤分離器
        const voiceRegex = /\[VOICE\]([\s\S]*?)\[\/VOICE\]/;
        const match = fullText.match(voiceRegex);

        if (match) {
            textToSpeak = match[1]; // 日文或其他語音
            textToDisplay = fullText.replace(voiceRegex, ''); // 純中/英顯示文字
        }

        // 更新對話氣泡 UI
        const bubble = document.getElementById('live2d-speech-bubble');
        bubble.querySelector('.bubble-text').innerText = textToDisplay;
        bubble.classList.remove('hidden');

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = ttsLangMap[appSettings.outputLang] || 'zh-HK';

        utterance.onstart = () => { ttsSpeaking = true; };
        utterance.onend = () => { 
            ttsSpeaking = false; 
            // 說完話後 3 秒自動隱藏對話氣泡
            setTimeout(() => {
                if(!ttsSpeaking) bubble.classList.add('hidden');
            }, 3000);
        };
        utterance.onerror = () => { ttsSpeaking = false; };

        window.speechSynthesis.speak(utterance);
    }

    function setupHiyoriBiomimeticTicker(app, model) {
        app.ticker.add(() => {
            if (!model) return;

            const time = Date.now() / 1000;

            // 1. 仿 Neuro-sama 閒置身體微調 (微幅正弦波晃動頭部與身體)
            model.internalModel.coreModel.setParameterValueById('ParamAngleX', Math.sin(time * 0.6) * 4);
            model.internalModel.coreModel.setParameterValueById('ParamAngleY', Math.cos(time * 0.8) * 3);
            model.internalModel.coreModel.setParameterValueById('ParamBodyAngleX', Math.sin(time * 0.4) * 2);
            model.internalModel.coreModel.setParameterValueById('ParamEyeBallX', Math.sin(time * 0.2) * 0.2);

            // 2. 嘴型張合同步 (TTS 說話時自動大幅擺動口部參數)
            if (ttsSpeaking) {
                // 產生隨機快速的說話口型律動
                const mouthOpen = Math.abs(Math.sin(Date.now() / 70)) * 0.85;
                model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', mouthOpen);
            } else {
                // 沒說話時閉口
                model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', 0);
            }
        });
    }

    async function sendLive2DMessage(text) {
        if (!text.trim()) return;

        // 顯示為思考狀態
        ttsSpeaking = false; 
        const bubble = document.getElementById('live2d-speech-bubble');
        bubble.querySelector('.bubble-text').innerText = "🤔 ...";
        bubble.classList.remove('hidden');

        const recentHistory = currentMessages.slice(-5);
        const requestBody = {
            message: text,
            history: recentHistory,
            mode: 'live2d', // 強制標註 live2d 模式
            is_amadeus: false,
            input_lang: appSettings.inputLang,
            output_lang: appSettings.outputLang,
            text_lang: appSettings.textLang,
            ai_model: appSettings.model,
            api_key: appSettings.apiKey,
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
                            fullAiResponse += dataObj.text;
                        } catch (e) {}
                    }
                }
            }

            // 將全量回覆送入 TTS 與氣泡分離器
            speakFrontendTTS(fullAiResponse);

            // 同步記錄對話至歷史
            currentMessages.push({ role: 'user', content: text });
            currentMessages.push({ role: 'ai', content: fullAiResponse });
            saveSession();

            // 清空輸入框
            document.getElementById('l2d-chat-input').value = "";

        } catch (err) {
            bubble.querySelector('.bubble-text').innerText = "⚠️ 網路連線失敗";
        }
    }
    // 重寫 initLive2D 引擎掛載器
    async function initLive2D() {
        if (live2dApp) return; // 避免重複初始化

        const canvas = document.getElementById('live2d-canvas');
        const stageContainer = document.getElementById('live2d-stage-container');
        
        // 建立 PIXI 應用程式，並將畫布大小綁定到我們新建的 stageContainer
        live2dApp = new PIXI.Application({ 
            view: canvas, 
            autoStart: true, 
            transparent: true, 
            resizeTo: stageContainer 
        });

        // 桃瀨日和 (Hiyori) 經典 Cubism 3 官方模型 CDN 路徑
        let modelUrl = "hiyori_free/runtime/hiyori_free_t08.model3.json";
        
        try {
            // 載入模型
            live2dModelInstance = await PIXI.live2d.Live2DModel.from(modelUrl);
            live2dApp.stage.addChild(live2dModelInstance); 
            
            // 完美適配畫面比例與位置設定
            live2dModelInstance.scale.set(0.18); 
            live2dModelInstance.x = canvas.width / 2 - live2dModelInstance.width / 2; 
            live2dModelInstance.y = canvas.height / 2 - live2dModelInstance.height / 2 + 60;

            // 啟動 Neuro-sama 風格的仿生運動計時器 (處理嘴型同步與身體微動)
            setupHiyoriBiomimeticTicker(live2dApp, live2dModelInstance);

            // 綁定 Live2D 專屬控制台的按鈕與輸入事件
            setupLive2DControls();

        } catch (error) { 
            console.error("Live2D 模型載入失敗", error); 
            const bubble = document.getElementById('live2d-speech-bubble');
            if (bubble) {
                bubble.querySelector('.bubble-text').innerText = "模型載入失敗，請檢查網路連線。";
                bubble.classList.remove('hidden');
            }
        }
    }
    function setupLive2DControls() {
        const btnAuto = document.getElementById('btn-l2d-mode-auto');
        const btnVerify = document.getElementById('btn-l2d-mode-verify');
        const l2dInput = document.getElementById('l2d-chat-input');
        const l2dSendBtn = document.getElementById('l2d-send-btn');
        const l2dMicBtn = document.getElementById('l2d-mic-btn');

        // 切換為直發模式
        btnAuto.onclick = () => {
            l2dInputMode = 'auto';
            btnAuto.classList.add('active');
            btnVerify.classList.remove('active');
            l2dInput.readOnly = true;
            l2dInput.placeholder = "已開啟直發，請按麥克風語音對話...";
            l2dSendBtn.classList.add('hidden');
        };

        // 切換為校對模式
        btnVerify.onclick = () => {
            l2dInputMode = 'verify';
            btnVerify.classList.add('active');
            btnAuto.classList.remove('active');
            l2dInput.readOnly = false;
            l2dInput.placeholder = "請用語音或直接打字輸入後發送...";
            l2dSendBtn.classList.remove('hidden');
        };

        // 點擊麥克風按鈕
        l2dMicBtn.onclick = () => { toggleL2dSpeech(); };

        // 校對模式下的點擊發送按鈕
        l2dSendBtn.onclick = () => {
            sendLive2DMessage(l2dInput.value);
        };

        // 初始化狀態
        l2dInput.readOnly = true;
        l2dInput.placeholder = "已開啟直發，請按麥克風語音對話...";
    }
}); // <--- 注意這裡保留了腳本結尾的右括號