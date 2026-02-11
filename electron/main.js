const { app, BrowserWindow, ipcMain, session, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const proxyChain = require('proxy-chain');

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// Aumenta o limite de listeners para evitar avisos em perfis com muitas abas
process.setMaxListeners(0);

// 🔥 CORREÇÃO: Verificar se app existe antes de configurar
if (app && app.commandLine) {
    app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
    app.commandLine.appendSwitch('no-sandbox');
}

const SYNC_PORT = 19999;
let mainWindow;
const GLOBAL_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";


// 🔥 ARMAZENA PROXIES ANÔNIMOS ATIVOS PARA LIMPEZA
const activeProxies = new Map();

// 🔥 ARMAZENA PROCESSOS CHROME NATIVOS ATIVOS
const activeNativeProcesses = new Map();

// 🔥 ARMAZENA JANELAS OVERLAY DE BOTÕES FLUTUANTES
const floatingButtonWindows = new Map();

// 🔥 ARMAZENA INSTÂNCIAS PUPPETEER PARA CONTROLE DOS BOTÕES FLUTUANTES
const activePuppeteerInstances = new Map(); // { profileId: { browser, page } }

// 🔌 CAMINHO DAS EXTENSÕES EMBUTIDAS
function getExtensionsPath() {
    // Tenta encontrar a pasta de extensões em diferentes locais
    const possiblePaths = [
        path.join(app.getAppPath(), 'extensions'),
        path.join(process.cwd(), 'extensions'),
        path.join(path.dirname(app.getPath('exe')), 'extensions'),
        path.join(__dirname, '..', 'extensions')
    ];

    for (const extPath of possiblePaths) {
        if (fs.existsSync(extPath)) {
            console.log(`📦 [EXTENSÕES] Pasta encontrada: ${extPath}`);
            return extPath;
        }
    }
    console.log(`⚠️ [EXTENSÕES] Pasta de extensões não encontrada`);
    return null;
}

// 🔌 FUNÇÃO PARA LISTAR TODAS AS EXTENSÕES A SEREM CARREGADAS
function getExtensionsList() {
    const extensionsDir = getExtensionsPath();
    if (!extensionsDir) return [];

    const extensions = [];
    try {
        const subdirs = fs.readdirSync(extensionsDir);
        for (const subdir of subdirs) {
            const extFullPath = path.join(extensionsDir, subdir);
            const manifestPath = path.join(extFullPath, 'manifest.json');
            // Só adiciona se for um diretório com manifest.json (extensão válida)
            if (fs.statSync(extFullPath).isDirectory() && fs.existsSync(manifestPath)) {
                extensions.push(extFullPath);
                console.log(`🔌 [EXTENSÃO] Encontrada: ${subdir}`);
            }
        }
    } catch (e) {
        console.error(`❌ [EXTENSÕES] Erro ao listar extensões:`, e.message);
    }
    return extensions;
}

// 🍎🪟🐧 FUNÇÃO PARA ENCONTRAR O CHROME EM QUALQUER SISTEMA OPERACIONAL
function findChromePath(customBrowserPath) {
    // Se foi passado um caminho customizado e ele existe, usa
    if (customBrowserPath && fs.existsSync(customBrowserPath)) {
        console.log(`✅ [CHROME] Usando caminho customizado: ${customBrowserPath}`);
        return customBrowserPath;
    }

    const platform = process.platform;
    let possiblePaths = [];

    if (platform === 'win32') {
        // Windows
        possiblePaths = [
            path.join(process.cwd(), 'browser', 'chrome.exe'),
            path.join(app.getAppPath(), 'browser', 'chrome.exe'),
            path.join(path.dirname(app.getPath('exe')), 'browser', 'chrome.exe'),
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
        ];
    } else if (platform === 'darwin') {
        // macOS
        possiblePaths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            path.join(process.env.HOME || '', 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            path.join(process.cwd(), 'browser', 'Google Chrome'),
            path.join(app.getAppPath(), 'browser', 'Google Chrome'),
        ];
    } else {
        // Linux
        possiblePaths = [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/snap/bin/chromium',
            path.join(process.cwd(), 'browser', 'chrome'),
        ];
    }

    // Filtra paths nulos e encontra o primeiro que existe
    const validPaths = possiblePaths.filter(Boolean);
    const chromePath = validPaths.find(p => fs.existsSync(p));

    if (chromePath) {
        console.log(`✅ [CHROME] Encontrado em: ${chromePath}`);
        return chromePath;
    }

    console.error(`❌ [CHROME] Chrome não encontrado! Caminhos verificados:`, validPaths);
    return null;
}

// 🔥 FUNÇÃO PARA CRIAR BOTÕES FLUTUANTES SOBRE O CHROME PUPPETEER
function createFloatingButtons(profileId) {
    // Se já existe uma janela para este perfil, fecha
    if (floatingButtonWindows.has(profileId)) {
        try {
            floatingButtonWindows.get(profileId).close();
        } catch (e) { }
    }

    const floatingWin = new BrowserWindow({
        width: 220,
        height: 60,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        x: Math.floor((require('electron').screen.getPrimaryDisplay().workAreaSize.width - 220) / 2),
        y: require('electron').screen.getPrimaryDisplay().workAreaSize.height - 100,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // HTML inline para os botões flutuantes
    const buttonsHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                background: transparent;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                overflow: hidden;
            }
            .container {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 16px;
                background: rgba(30, 30, 40, 0.95);
                border-radius: 30px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.1);
                -webkit-app-region: drag; /* TODA A BARRA É ARRASTÁVEL */
                cursor: grab;
            }
            .container:active { cursor: grabbing; }
            .drag-handle {
                color: rgba(255, 255, 255, 0.3);
                margin-right: 4px;
                font-size: 14px;
                user-select: none;
            }
            button {
                width: 40px;
                height: 40px;
                border: none;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                transition: all 0.2s;
                color: white;
                -webkit-app-region: no-drag; /* BOTÕES PRECISAM DE NO-DRAG PARA SEREM CLICÁVEIS */
            }
            button:hover { transform: scale(1.1); filter: brightness(1.2); }
            .back { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
            .forward { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
            .reload { background: linear-gradient(135deg, #10b981, #059669); }
            .close { background: linear-gradient(135deg, #ef4444, #dc2626); }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="drag-handle">⠿</div>
            <button class="back" onclick="sendAction('back')" title="Voltar">←</button>
            <button class="forward" onclick="sendAction('forward')" title="Avançar">→</button>
            <button class="reload" onclick="sendAction('reload')" title="Recarregar">↻</button>
            <button class="close" onclick="sendAction('close')" title="Fechar">✕</button>
        </div>
        <script>
            const { ipcRenderer } = require('electron');
            function sendAction(action) {
                ipcRenderer.send('floating-button-action', { action, profileId: '${profileId}' });
            }
        </script>
    </body>
    </html>`;

    floatingWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buttonsHtml)}`);

    floatingButtonWindows.set(profileId, floatingWin);

    // Monitora o browser Puppeteer - fecha overlay quando browser fechar
    const checkBrowserInterval = setInterval(async () => {
        const instance = activePuppeteerInstances.get(profileId);
        if (!instance || !instance.browser) {
            clearInterval(checkBrowserInterval);
            if (floatingButtonWindows.has(profileId)) {
                try {
                    floatingButtonWindows.get(profileId).close();
                } catch (closeErr) { }
                floatingButtonWindows.delete(profileId);
            }
            return;
        }

        // Verifica se o browser ainda está conectado
        if (!instance.browser.isConnected()) {
            clearInterval(checkBrowserInterval);
            activePuppeteerInstances.delete(profileId);
            if (floatingButtonWindows.has(profileId)) {
                try {
                    floatingButtonWindows.get(profileId).close();
                } catch (closeErr) { }
                floatingButtonWindows.delete(profileId);
            }
        }
    }, 1000);

    floatingWin.on('closed', () => {
        clearInterval(checkBrowserInterval);
        floatingButtonWindows.delete(profileId);
    });

    console.log(`🎛️ [OVERLAY] Botões flutuantes criados para perfil: ${profileId}`);
}

// 🔥 FUNÇÃO DE PROTEÇÃO PARA SER INJETADA NO NAVEGADOR
async function injectProtection(targetPage) {
    try {
        // 1. Injeta script que roda ANTES de qualquer outro script da página
        await targetPage.evaluateOnNewDocument(() => {
            // Bloqueia Context Menu (Botão Direito)
            window.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, true);

            // Bloqueia teclas de atalho comuns (atalhos de devtools)
            window.addEventListener('keydown', (e) => {
                if (
                    e.key === 'F12' ||
                    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
                    (e.ctrlKey && e.key === 'U') ||
                    (e.metaKey && e.altKey && e.key === 'i')
                ) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }, true);

            // Bloqueia seleção de texto e drag-and-drop
            const style = document.createElement('style');
            style.innerHTML = `
                * { 
                    -webkit-user-select: none !important; 
                    user-select: none !important; 
                    -webkit-user-drag: none !important;
                } 
                input, textarea, [contenteditable="true"] { 
                    user-select: text !important; 
                }
            `;
            document.head.appendChild(style);

            // Truque Anti-Debugger: Trava o console se for aberto
            setInterval(() => {
                (function () {
                    (function a() {
                        try {
                            (function b(i) {
                                if (('' + (i / i)).length !== 1 || i % 20 === 0) {
                                    (function () { }).constructor('debugger')();
                                } else {
                                    debugger;
                                }
                                b(++i);
                            })(0);
                        } catch (e) {
                            setTimeout(a, 50);
                        }
                    })();
                })();
            }, 1000);
        });
    } catch (e) {
        console.error("Erro ao injetar proteção:", e.message);
    }
}

function registerIPCHandlers() {
    // ========== MODO NATIVO COM PRÉ-LOGIN SILENCIOSO (DRM + OCULTA SENHA) ==========
    // 1. Puppeteer HEADLESS faz login automático (invisível)
    // 2. Salva cookies no perfil
    // 3. Chrome NATIVO abre já logado (com DRM funcionando!)
    ipcMain.handle('launch-profile-native', async (event, profile, customBrowserPath) => {
        try {
            const userDataDir = path.join(app.getPath('userData'), 'profiles', profile.id);
            if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

            // 🔒 DESABILITA O GERENCIADOR DE SENHAS NO PERFIL
            const defaultDir = path.join(userDataDir, 'Default');
            if (!fs.existsSync(defaultDir)) fs.mkdirSync(defaultDir, { recursive: true });

            const prefsPath = path.join(defaultDir, 'Preferences');
            let prefs = {};
            if (fs.existsSync(prefsPath)) {
                try { prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8')); } catch (e) { }
            }

            prefs.credentials_enable_service = false;
            prefs.credentials_enable_autosignin = false;
            if (!prefs.profile) prefs.profile = {};
            prefs.profile.password_manager_enabled = false;
            if (!prefs.password_manager) prefs.password_manager = {};
            prefs.password_manager.credentials_enable_service = false;
            prefs.password_manager.save_password_bubble_opt_in = false;

            fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2));

            // 🍎🪟🐧 Encontra o Chrome usando função multiplataforma
            const executablePath = findChromePath(customBrowserPath);
            if (!executablePath) {
                throw new Error('Chrome não encontrado! Instale o Google Chrome ou configure o caminho nas configurações.');
            }

            const targetUrls = (profile.urls && profile.urls.length > 0) ? profile.urls : ['https://google.com'];

            // 🔥 PROXY-CHAIN: Cria proxy local anônimo para proxies autenticados
            let proxyUrl = null;
            if (profile.proxy) {
                try {
                    if (activeProxies.has(profile.id)) {
                        await proxyChain.closeAnonymizedProxy(activeProxies.get(profile.id), true);
                    }
                    console.log(`🔄 [NATIVO] Criando proxy anônimo para: ${profile.proxy}`);
                    const anonymizedProxy = await proxyChain.anonymizeProxy(profile.proxy);
                    proxyUrl = anonymizedProxy;
                    activeProxies.set(profile.id, anonymizedProxy);
                    console.log(`✅ [NATIVO] Proxy anônimo criado: ${anonymizedProxy}`);
                } catch (proxyErr) {
                    console.error(`❌ Erro ao criar proxy anônimo:`, proxyErr);
                    proxyUrl = profile.proxy;
                }
            }

            // 🔐 PRÉ-LOGIN SILENCIOSO: Se tiver email e senha, faz login headless primeiro
            // 🚫 SITES QUE USAM APENAS OAUTH (não tem campo de email/senha)
            const oauthOnlySites = [
                'suno.com', 'suno.ai',           // Suno - só OAuth
                'reddit.com',                     // Reddit - só OAuth
                'spotify.com',                    // Spotify - OAuth ou app
                'github.com',                     // GitHub - OAuth disponível
                'discord.com',                    // Discord - token/OAuth
                'twitch.tv',                      // Twitch - OAuth
                'google.com', 'youtube.com',      // Google - OAuth nativo
                'accounts.google.com',            // Google OAuth
                'microsoft.com', 'live.com',      // Microsoft - OAuth
                'apple.com',                      // Apple - OAuth
                'twitter.com', 'x.com',           // Twitter/X - OAuth
                'facebook.com',                   // Facebook - OAuth
                'instagram.com',                  // Instagram - OAuth
                'tiktok.com',                     // TikTok - OAuth
                'linkedin.com',                   // LinkedIn - OAuth
                'pinterest.com',                  // Pinterest - OAuth
                'notion.so',                      // Notion - OAuth
                'figma.com',                      // Figma - OAuth
                'canva.com',                      // Canva - OAuth
                'openai.com', 'chat.openai.com',  // OpenAI/ChatGPT - OAuth
                'claude.ai', 'anthropic.com',     // Claude - OAuth
                'midjourney.com',                 // Midjourney - Discord OAuth
                // 🔥 SITES COM PROTEÇÃO ANTI-BOT AVANÇADA (pulam pré-login)
                'dankicode.com', 'cursos.dankicode.com',  // DankiCode - Anti-bot
            ];

            const targetUrlLower = targetUrls[0].toLowerCase();
            const isOAuthOnlySite = oauthOnlySites.some(site => targetUrlLower.includes(site));

            if (isOAuthOnlySite) {
                console.log(`🔓 [NATIVO] Site OAuth detectado (${targetUrls[0]})`);
                console.log(`⚠️ [OAUTH] Google bloqueia automação. Abrindo Chrome nativo para login manual...`);
                console.log(`💡 [OAUTH] O usuário faz login UMA VEZ e os cookies são salvos para as próximas vezes.`);

                // Para sites OAuth, pula direto para o Chrome nativo
                // O usuário faz login manualmente UMA VEZ e os cookies são salvos
            }


            if (profile.email && profile.password && !isOAuthOnlySite) {
                console.log(`🔐 [PRÉ-LOGIN] Iniciando login silencioso para: ${profile.email}`);

                let headlessBrowser = null; // Declarado fora do try para poder fechar no catch
                try {
                    headlessBrowser = await puppeteer.launch({
                        executablePath,
                        headless: 'new', // Modo INVISÍVEL
                        userDataDir,
                        defaultViewport: { width: 1280, height: 720 },
                        args: [
                            '--no-first-run',
                            '--disable-infobars',
                            '--disable-notifications',
                            `--user-agent=${GLOBAL_UA}`,
                            // 🔥 PROTEÇÕES ANTI-DETECÇÃO
                            '--disable-blink-features=AutomationControlled',
                            '--disable-features=IsolateOrigins,site-per-process',
                            '--disable-dev-shm-usage',
                            '--disable-accelerated-2d-canvas',
                            '--disable-gpu',
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-web-security',
                            '--allow-running-insecure-content',
                            '--disable-features=TranslateUI',
                            '--lang=pt-BR,pt',
                            proxyUrl ? `--proxy-server=${proxyUrl}` : ''
                        ].filter(Boolean),
                        // 🔥 IGNORA FLAGS DE AUTOMAÇÃO
                        ignoreDefaultArgs: ['--enable-automation']
                    });

                    const page = await headlessBrowser.newPage();

                    // 🔥 SCRIPTS ANTI-DETECÇÃO - executados ANTES de qualquer navegação
                    await page.evaluateOnNewDocument(() => {
                        // Remove webdriver
                        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

                        // Chrome API falsa
                        window.chrome = {
                            runtime: {},
                            loadTimes: () => ({}),
                            csi: () => ({})
                        };

                        // Remove propriedades de automação
                        delete navigator.__proto__.webdriver;

                        // Plugins falsos
                        Object.defineProperty(navigator, 'plugins', {
                            get: () => [1, 2, 3, 4, 5].map(() => ({
                                name: 'Chrome PDF Plugin',
                                description: 'Portable Document Format',
                                filename: 'internal-pdf-viewer',
                                length: 1
                            }))
                        });

                        // Languages
                        Object.defineProperty(navigator, 'languages', {
                            get: () => ['pt-BR', 'pt', 'en-US', 'en']
                        });

                        // Permissions
                        const originalQuery = window.navigator.permissions.query;
                        window.navigator.permissions.query = (parameters) =>
                            parameters.name === 'notifications'
                                ? Promise.resolve({ state: Notification.permission })
                                : originalQuery(parameters);
                    });

                    // 🎬 DETECTA URLs DE LOGIN PARA STREAMING SERVICES
                    let loginUrl = targetUrls[0];
                    const urlLower = loginUrl.toLowerCase();
                    let isHboMax = false;
                    let isEnvato = false;

                    // HBO Max / Max
                    if (urlLower.includes('max.com') || urlLower.includes('hbomax.com')) {
                        loginUrl = 'https://auth.max.com/login';
                        isHboMax = true;
                        console.log(`🎬 [PRÉ-LOGIN] Detectado HBO Max, usando URL: ${loginUrl}`);
                    }
                    // Netflix
                    else if (urlLower.includes('netflix.com')) {
                        loginUrl = 'https://www.netflix.com/login';
                        console.log(`🎬 [PRÉ-LOGIN] Detectado Netflix, usando URL: ${loginUrl}`);
                    }
                    // Disney+
                    else if (urlLower.includes('disneyplus.com')) {
                        loginUrl = 'https://www.disneyplus.com/login';
                        console.log(`🎬 [PRÉ-LOGIN] Detectado Disney+, usando URL: ${loginUrl}`);
                    }
                    // Amazon Prime
                    else if (urlLower.includes('primevideo.com') || urlLower.includes('amazon.com/gp/video')) {
                        loginUrl = 'https://www.amazon.com/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.primevideo.com';
                        console.log(`🎬 [PRÉ-LOGIN] Detectado Prime Video, usando URL: ${loginUrl}`);
                    }
                    // 🎨 Envato Elements
                    else if (urlLower.includes('envato.com') || urlLower.includes('elements.envato')) {
                        loginUrl = 'https://account.envato.com/sign_in?to=elements';
                        isEnvato = true;
                        console.log(`🎨 [PRÉ-LOGIN] Detectado Envato Elements, usando URL: ${loginUrl}`);
                    }

                    // Navega para a URL de login
                    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                    console.log(`📄 [PRÉ-LOGIN] Página carregada: ${loginUrl}`);

                    // Aguarda carregamento inicial
                    await new Promise(r => setTimeout(r, 2000));

                    const email = profile.email;
                    const pass = profile.password;

                    // ========== LÓGICA ESPECIAL PARA HBO MAX (LOGIN EM 2 ETAPAS) ==========
                    if (isHboMax) {
                        console.log(`🎬 [PRÉ-LOGIN] Executando fluxo HBO Max em 2 etapas...`);

                        // ETAPA 1: Preenche o email
                        console.log(`📧 [PRÉ-LOGIN] ETAPA 1: Preenchendo email...`);

                        try {
                            // Aguarda qualquer input aparecer na página (HBO Max usa input type="text")
                            await page.waitForSelector('input', { timeout: 10000 });

                            // Tenta múltiplos seletores em ordem de prioridade
                            const emailSelectors = [
                                'input[type="email"]',
                                'input[name="email"]',
                                'input[id*="email"]',
                                'input[autocomplete="email"]',
                                'input[autocomplete="username"]',
                                'input[type="text"]',
                                'input:not([type="hidden"]):not([type="password"])'
                            ];

                            let emailInput = null;
                            for (const selector of emailSelectors) {
                                emailInput = await page.$(selector);
                                if (emailInput) {
                                    console.log(`✅ [PRÉ-LOGIN] Campo encontrado com seletor: ${selector}`);
                                    break;
                                }
                            }

                            if (emailInput) {
                                await emailInput.click();
                                await new Promise(r => setTimeout(r, 300));
                                await emailInput.type(email, { delay: 50 });
                                console.log(`✅ [PRÉ-LOGIN] Email digitado: ${email}`);
                            } else {
                                console.log(`⚠️ [PRÉ-LOGIN] Nenhum campo de input encontrado, tentando via evaluate...`);
                                // Fallback: usa evaluate para encontrar e preencher
                                await page.evaluate((emailValue) => {
                                    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="password"])');
                                    if (inputs.length > 0) {
                                        const input = inputs[0];
                                        input.focus();
                                        input.value = emailValue;
                                        input.dispatchEvent(new Event('input', { bubbles: true }));
                                        input.dispatchEvent(new Event('change', { bubbles: true }));
                                    }
                                }, email);
                                console.log(`✅ [PRÉ-LOGIN] Email preenchido via evaluate`);
                            }
                        } catch (e) {
                            console.log(`⚠️ [PRÉ-LOGIN] Erro ao preencher email: ${e.message}`);
                        }

                        await new Promise(r => setTimeout(r, 500));

                        // Clica no botão Continue
                        console.log(`▶️ [PRÉ-LOGIN] Clicando botão Continue...`);

                        try {
                            // Tenta encontrar o botão Continue do HBO Max
                            const continueClicked = await page.evaluate(() => {
                                // Procura por botões com texto Continue
                                const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
                                for (const btn of buttons) {
                                    const text = (btn.textContent || '').toLowerCase().trim();
                                    if (text === 'continue' || text === 'continuar') {
                                        btn.click();
                                        return true;
                                    }
                                }
                                // Fallback: procura submit do form
                                const form = document.querySelector('form');
                                if (form) {
                                    const submitBtn = form.querySelector('button[type="submit"], button');
                                    if (submitBtn) {
                                        submitBtn.click();
                                        return true;
                                    }
                                }
                                return false;
                            });

                            if (continueClicked) {
                                console.log(`✅ [PRÉ-LOGIN] Botão Continue clicado!`);
                            }
                        } catch (e) {
                            console.log(`⚠️ [PRÉ-LOGIN] Erro ao clicar Continue: ${e.message}`);
                        }

                        // Aguarda a transição para a página de senha (crítico!)
                        console.log(`⏳ [PRÉ-LOGIN] Aguardando página de senha carregar...`);
                        await new Promise(r => setTimeout(r, 3000));

                        // Aguarda o campo de senha aparecer
                        try {
                            await page.waitForSelector('input[type="password"]', { timeout: 15000 });
                            console.log(`✅ [PRÉ-LOGIN] Campo de senha detectado!`);
                        } catch (e) {
                            console.log(`⚠️ [PRÉ-LOGIN] Campo de senha não apareceu, tentando continuar...`);
                        }

                        // ETAPA 2: Preenche a senha
                        console.log(`🔑 [PRÉ-LOGIN] ETAPA 2: Preenchendo senha...`);

                        try {
                            const passwordInput = await page.$('input[type="password"]');
                            if (passwordInput) {
                                await passwordInput.click();
                                await passwordInput.type(pass, { delay: 30 });
                                console.log(`✅ [PRÉ-LOGIN] Senha digitada!`);
                            }
                        } catch (e) {
                            console.log(`⚠️ [PRÉ-LOGIN] Erro ao preencher senha: ${e.message}`);
                        }

                        await new Promise(r => setTimeout(r, 500));

                        // Clica no botão Sign In
                        console.log(`🚪 [PRÉ-LOGIN] Clicando botão Sign In...`);

                        try {
                            const signInClicked = await page.evaluate(() => {
                                const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
                                for (const btn of buttons) {
                                    const text = (btn.textContent || '').toLowerCase().trim();
                                    if (text === 'sign in' || text === 'entrar' || text === 'log in' || text === 'login') {
                                        btn.click();
                                        return true;
                                    }
                                }
                                // Fallback: submit do form
                                const form = document.querySelector('form');
                                if (form) {
                                    const submitBtn = form.querySelector('button[type="submit"], button');
                                    if (submitBtn) {
                                        submitBtn.click();
                                        return true;
                                    }
                                }
                                return false;
                            });

                            if (signInClicked) {
                                console.log(`✅ [PRÉ-LOGIN] Botão Sign In clicado!`);
                            }
                        } catch (e) {
                            console.log(`⚠️ [PRÉ-LOGIN] Erro ao clicar Sign In: ${e.message}`);
                        }

                        // Aguarda o login completar
                        console.log(`⏳ [PRÉ-LOGIN] Aguardando login completar...`);
                        await new Promise(r => setTimeout(r, 8000));

                    } else if (isEnvato) {
                        // ========== LÓGICA ESPECIAL PARA ENVATO ELEMENTS ==========
                        console.log(`🎨 [PRÉ-LOGIN] Executando fluxo Envato Elements...`);

                        // Envato tem email e senha na mesma página
                        try {
                            // Aguarda o formulário carregar
                            await page.waitForSelector('input[type="text"], input[type="email"], input[name="user[login]"]', { timeout: 10000 });
                            console.log(`✅ [PRÉ-LOGIN] Formulário Envato carregado!`);

                            // Preenche o email/username
                            console.log(`📧 [PRÉ-LOGIN] Preenchendo email...`);

                            const emailSelectors = [
                                'input[name="user[login]"]',
                                'input[id="user_login"]',
                                'input[type="email"]',
                                'input[type="text"]'
                            ];

                            let emailInput = null;
                            for (const selector of emailSelectors) {
                                emailInput = await page.$(selector);
                                if (emailInput) {
                                    console.log(`✅ [PRÉ-LOGIN] Campo email encontrado: ${selector}`);
                                    break;
                                }
                            }

                            if (emailInput) {
                                await emailInput.click();
                                await new Promise(r => setTimeout(r, 200));
                                await emailInput.type(email, { delay: 30 });
                                console.log(`✅ [PRÉ-LOGIN] Email digitado`);
                            }

                            await new Promise(r => setTimeout(r, 500));

                            // Preenche a senha
                            console.log(`🔑 [PRÉ-LOGIN] Preenchendo senha...`);

                            const passwordSelectors = [
                                'input[name="user[password]"]',
                                'input[id="user_password"]',
                                'input[type="password"]'
                            ];

                            let passwordInput = null;
                            for (const selector of passwordSelectors) {
                                passwordInput = await page.$(selector);
                                if (passwordInput) {
                                    console.log(`✅ [PRÉ-LOGIN] Campo senha encontrado: ${selector}`);
                                    break;
                                }
                            }

                            if (passwordInput) {
                                await passwordInput.click();
                                await new Promise(r => setTimeout(r, 200));
                                await passwordInput.type(pass, { delay: 30 });
                                console.log(`✅ [PRÉ-LOGIN] Senha digitada`);
                            }

                            await new Promise(r => setTimeout(r, 500));

                            // Clica no botão de login
                            console.log(`🚪 [PRÉ-LOGIN] Clicando botão de login...`);

                            const loginClicked = await page.evaluate(() => {
                                // Tenta encontrar o botão de submit do Envato
                                const submitSelectors = [
                                    'input[type="submit"]',
                                    'button[type="submit"]',
                                    'button[name="commit"]',
                                    'input[name="commit"]'
                                ];

                                for (const selector of submitSelectors) {
                                    const btn = document.querySelector(selector);
                                    if (btn) {
                                        btn.click();
                                        return selector;
                                    }
                                }

                                // Fallback: procura por botões com texto de login
                                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
                                for (const btn of buttons) {
                                    const text = (btn.textContent || btn.value || '').toLowerCase();
                                    if (text.includes('sign in') || text.includes('log in') ||
                                        text.includes('inicie') || text.includes('entrar') ||
                                        text.includes('sessão')) {
                                        btn.click();
                                        return 'text-match';
                                    }
                                }

                                // Último fallback: submete o form
                                const form = document.querySelector('form');
                                if (form) {
                                    form.submit();
                                    return 'form-submit';
                                }

                                return null;
                            });

                            if (loginClicked) {
                                console.log(`✅ [PRÉ-LOGIN] Botão de login clicado: ${loginClicked}`);
                            } else {
                                console.log(`⚠️ [PRÉ-LOGIN] Botão de login não encontrado, tentando Enter...`);
                                await page.keyboard.press('Enter');
                            }

                            // Aguarda o login processar
                            console.log(`⏳ [PRÉ-LOGIN] Aguardando login completar...`);
                            await new Promise(r => setTimeout(r, 8000));

                        } catch (e) {
                            console.log(`⚠️ [PRÉ-LOGIN] Erro no login Envato: ${e.message}`);
                        }

                    } else {
                        // ========== LÓGICA GENÉRICA PARA OUTROS SITES ==========
                        console.log(`📧 [PRÉ-LOGIN] Preenchendo email...`);

                        const emailSelector = await page.evaluate(() => {
                            const inputs = document.querySelectorAll('input');
                            for (const input of inputs) {
                                const attr = (
                                    (input.name || '') +
                                    (input.id || '') +
                                    (input.placeholder || '') +
                                    (input.getAttribute('aria-label') || '') +
                                    (input.getAttribute('autocomplete') || '') +
                                    (input.type || '')
                                ).toLowerCase();

                                if (attr.includes('email') || attr.includes('user') || attr.includes('login') ||
                                    input.type === 'email' || attr.includes('username')) {
                                    if (input.id) return `#${input.id}`;
                                    if (input.name) return `input[name="${input.name}"]`;
                                    return 'input[type="email"], input[type="text"]';
                                }
                            }
                            return 'input[type="email"], input[type="text"]';
                        });

                        try {
                            await page.waitForSelector(emailSelector, { timeout: 5000 });
                            await page.click(emailSelector);
                            await page.type(emailSelector, email, { delay: 50 });
                            console.log(`✅ [PRÉ-LOGIN] Email digitado`);
                        } catch (e) {
                            console.log(`⚠️ [PRÉ-LOGIN] Não encontrou campo de email, tentando alternativo...`);
                            await page.type('input:first-of-type', email, { delay: 50 });
                        }

                        await new Promise(r => setTimeout(r, 1000));

                        // Tenta preencher senha (se estiver na mesma página)
                        console.log(`🔑 [PRÉ-LOGIN] Preenchendo senha...`);
                        try {
                            const passField = await page.$('input[type="password"]');
                            if (passField) {
                                await passField.click();
                                await passField.type(pass, { delay: 50 });
                                console.log(`✅ [PRÉ-LOGIN] Senha digitada`);
                            }
                        } catch (e) {
                            console.log(`⚠️ [PRÉ-LOGIN] Campo de senha não encontrado`);
                        }

                        await new Promise(r => setTimeout(r, 1000));

                        // Clica no botão de login
                        console.log(`🚪 [PRÉ-LOGIN] Clicando Sign In/Entrar...`);

                        await page.evaluate(() => {
                            const buttons = document.querySelectorAll('button, input[type="submit"], a, span[role="button"]');
                            for (const btn of buttons) {
                                const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').toLowerCase();
                                if (text.includes('sign in') || text.includes('entrar') ||
                                    text.includes('login') || text.includes('acessar') ||
                                    text.includes('submit') || text.includes('iniciar') ||
                                    text.includes('continue') || text.includes('continuar')) {
                                    btn.click();
                                    return;
                                }
                            }
                            const form = document.querySelector('form');
                            if (form) form.submit();
                        });

                        await new Promise(r => setTimeout(r, 5000));
                    }

                    // Verifica se login foi bem sucedido
                    const currentUrl = page.url();
                    console.log(`📍 [PRÉ-LOGIN] URL atual: ${currentUrl}`);

                    if (!currentUrl.includes('login') && !currentUrl.includes('sign-in') && !currentUrl.includes('signin') && !currentUrl.includes('sign_in') && !currentUrl.includes('auth.max.com') && !currentUrl.includes('account.envato.com')) {
                        console.log(`🎉 [PRÉ-LOGIN] Login parece ter sido bem sucedido!`);
                    } else {
                        console.log(`⚠️ [PRÉ-LOGIN] Ainda na página de login, cookies serão salvos mesmo assim`);
                    }

                    console.log(`✅ [PRÉ-LOGIN] Login silencioso concluído! Fechando headless...`);

                    // Fecha o browser headless (cookies já estão salvos no userDataDir)
                    await headlessBrowser.close();

                } catch (loginErr) {
                    console.warn(`⚠️ [PRÉ-LOGIN] Erro no login silencioso (continuando mesmo assim):`, loginErr.message);
                    // 🔥 IMPORTANTE: Garante que o browser headless seja fechado mesmo em caso de erro
                    try {
                        if (headlessBrowser && headlessBrowser.isConnected()) {
                            await headlessBrowser.close();
                            console.log(`🔒 [PRÉ-LOGIN] Browser headless fechado após erro`);
                        }
                    } catch (closeErr) {
                        console.warn(`⚠️ [PRÉ-LOGIN] Erro ao fechar browser:`, closeErr.message);
                    }
                }

                // Aguarda um pouco para garantir que o userDataDir foi liberado
                await new Promise(r => setTimeout(r, 1000));
            }

            // ========== AGORA ABRE O CHROME NATIVO (JÁ LOGADO!) ==========
            const chromeArgs = [
                `--user-data-dir=${userDataDir}`,
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-infobars',
                '--disable-save-password-bubble',
                '--disable-notifications',
                '--disable-translate',
                '--autoplay-policy=no-user-gesture-required',
                `--user-agent=${GLOBAL_UA}`,
                // 🔒 FLAGS DE PROTEÇÃO
                '--disable-dev-tools',                    // Desabilita DevTools (F12)
                '--disable-client-side-phishing-detection',
                '--disable-default-apps',
                '--disable-features=TranslateUI',
            ];

            // 🔌 CARREGA EXTENSÕES EMBUTIDAS (se existirem)
            const extensionsList = getExtensionsList();
            if (extensionsList.length > 0) {
                // Formato: --load-extension=path1,path2,path3
                const extensionsArg = `--load-extension=${extensionsList.join(',')}`;
                chromeArgs.push(extensionsArg);
                console.log(`🔌 [NATIVO] Carregando ${extensionsList.length} extensão(ões)`);
            }

            if (proxyUrl) {
                chromeArgs.push(`--proxy-server=${proxyUrl}`);
            }

            // 🔒 SEMPRE usa modo --app para segurança (impede instalação de extensões)
            if (targetUrls.length === 1) {
                chromeArgs.push(`--app=${targetUrls[0]}`);
            } else if (targetUrls.length > 1) {
                chromeArgs.push(...targetUrls);
            }

            console.log(`🚀 [NATIVO] Lançando Chrome via PUPPETEER (visível): ${executablePath}`);

            const browser = await puppeteer.launch({
                executablePath,
                headless: false,
                userDataDir,
                defaultViewport: null,
                ignoreHTTPSErrors: true,
                ignoreDefaultArgs: ['--enable-automation'],
                args: [
                    ...chromeArgs,
                    '--disable-blink-features=AutomationControlled'
                ]
            });

            // Captura a página
            const pages = await browser.pages();
            const page = pages.length > 0 ? pages[0] : await browser.newPage();

            // 🍪 INJETAR COOKIES DO PERFIL (cadastrados no campo cookies do perfil)
            if (profile.cookies && profile.cookies.trim()) {
                try {
                    console.log(`🍪 [COOKIES] Perfil tem cookies cadastrados, injetando...`);

                    // Parse dos cookies (pode ser JSON array ou string separada por linha)
                    let cookiesToInject = [];
                    const cookieStr = profile.cookies.trim();

                    if (cookieStr.startsWith('[')) {
                        // JSON array
                        cookiesToInject = JSON.parse(cookieStr);
                    } else if (cookieStr.startsWith('{')) {
                        // JSON object único
                        cookiesToInject = [JSON.parse(cookieStr)];
                    } else {
                        // Formato Netscape ou texto simples
                        console.log(`⚠️ [COOKIES] Formato não reconhecido, tentando parse linha por linha`);
                        const lines = cookieStr.split('\n').filter(l => l.trim());
                        for (const line of lines) {
                            // Tenta múltiplos formatos
                            if (line.includes('\t')) {
                                // Formato Netscape: domain\tTRUE\t/\tFALSE\texpiry\tname\tvalue
                                const parts = line.split('\t');
                                if (parts.length >= 7) {
                                    cookiesToInject.push({
                                        domain: parts[0],
                                        path: parts[2],
                                        secure: parts[3] === 'TRUE',
                                        expires: parseInt(parts[4]) || -1,
                                        name: parts[5],
                                        value: parts[6]
                                    });
                                }
                            } else if (line.includes('=')) {
                                // Formato simples: name=value
                                const [name, ...valueParts] = line.split('=');
                                if (name && valueParts.length > 0) {
                                    cookiesToInject.push({
                                        name: name.trim(),
                                        value: valueParts.join('=').trim(),
                                        domain: new URL(targetUrls[0]).hostname
                                    });
                                }
                            }
                        }
                    }

                    if (cookiesToInject.length > 0) {
                        // Usa CDP para injetar cookies (mais robusto)
                        const client = await page.target().createCDPSession();

                        // Prepara cookies para CDP
                        const cdpCookies = cookiesToInject.map(c => ({
                            name: c.name,
                            value: c.value,
                            domain: c.domain || new URL(targetUrls[0]).hostname,
                            path: c.path || '/',
                            secure: c.secure !== false,
                            httpOnly: c.httpOnly || false,
                            sameSite: c.sameSite || 'Lax',
                            expires: c.expires || c.expirationDate || (Date.now() / 1000 + 31536000) // 1 ano
                        }));

                        // Injeta via CDP
                        await client.send('Network.setCookies', { cookies: cdpCookies });
                        console.log(`✅ [COOKIES] ${cdpCookies.length} cookies do perfil injetados via CDP!`);

                        // Log dos domínios
                        const domains = [...new Set(cdpCookies.map(c => c.domain))];
                        console.log(`📂 [COOKIES] Domínios: ${domains.join(', ')}`);
                    }
                } catch (cookieErr) {
                    console.error(`❌ [COOKIES] Erro ao injetar cookies do perfil:`, cookieErr.message);
                }
            }

            // 🔥 INJETAR COOKIES PENDENTES DA CLOUD (se existirem)
            const pendingCookiesFile = path.join(userDataDir, 'pending_cookies.json');
            if (fs.existsSync(pendingCookiesFile)) {
                try {
                    const pendingCookies = JSON.parse(fs.readFileSync(pendingCookiesFile, 'utf8'));
                    if (pendingCookies && pendingCookies.length > 0) {
                        console.log(`☁️ [SESSION] Injetando ${pendingCookies.length} cookies da Cloud...`);
                        const client = await page.target().createCDPSession();
                        await client.send('Network.setCookies', { cookies: pendingCookies });
                        console.log(`✅ [SESSION] Cookies da Cloud injetados com sucesso!`);
                    }
                    // Remove o arquivo após injetar
                    fs.unlinkSync(pendingCookiesFile);
                } catch (cookieErr) {
                    console.warn(`⚠️ [SESSION] Erro ao injetar cookies pendentes:`, cookieErr.message);
                }
            }

            // 🛡️ APLICA PROTEÇÃO (F12, Botão Direito, etc) via função global
            await injectProtection(page);

            // PROTEÇÃO GLOBAL: Novas abas
            browser.on('targetcreated', async (target) => {
                if (target.type() === 'page') {
                    const newPage = await target.page();
                    if (newPage) await injectProtection(newPage);
                }
            });

            // 🍪 Se tem cookies do perfil, recarrega a página para aplicar
            const hasCookies = profile.cookies && profile.cookies.trim();
            if (hasCookies && targetUrls.length > 0) {
                console.log(`🔄 [COOKIES] Recarregando página para aplicar cookies...`);
                // Aguarda a página carregar inicialmente
                await new Promise(r => setTimeout(r, 2000));
                // Recarrega para aplicar os cookies injetados
                await page.reload({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });
                console.log(`✅ [COOKIES] Página recarregada com cookies aplicados!`);
            } else if (targetUrls.length > 0 && page.url() === 'about:blank') {
                // Fallback: navega se estiver em branco
                await page.goto(targetUrls[0], { waitUntil: 'networkidle2', timeout: 30000 })
                    .catch(e => console.error("Erro navegação:", e.message));
            }

            // Armazena instâncias para controle
            activePuppeteerInstances.set(profile.id, { browser, page });

            // 🔥 CRIA JANELA OVERLAY COM BOTÕES FLUTUANTES
            createFloatingButtons(profile.id);

            return { status: 'success', mode: 'native', pid: browser.process().pid };
        } catch (e) {
            console.error("Erro ao iniciar perfil nativo:", e);
            return { status: 'error', message: e.message };
        }
    });

    // ========== MODO PUPPETEER (ANTIGO - SEM DRM) ==========
    ipcMain.handle('launch-profile', async (event, profile, customBrowserPath) => {
        try {
            const userDataDir = path.join(app.getPath('userData'), 'profiles', profile.id);
            if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

            // 🔒 DESABILITA O GERENCIADOR DE SENHAS NO PERFIL
            const defaultDir = path.join(userDataDir, 'Default');
            if (!fs.existsSync(defaultDir)) fs.mkdirSync(defaultDir, { recursive: true });

            const prefsPath = path.join(defaultDir, 'Preferences');
            let prefs = {};
            if (fs.existsSync(prefsPath)) {
                try { prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8')); } catch (e) { }
            }

            // Desabilita todas as opções de senha
            prefs.credentials_enable_service = false;
            prefs.credentials_enable_autosignin = false;
            if (!prefs.profile) prefs.profile = {};
            prefs.profile.password_manager_enabled = false;
            if (!prefs.password_manager) prefs.password_manager = {};
            prefs.password_manager.credentials_enable_service = false;
            prefs.password_manager.save_password_bubble_opt_in = false;

            fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2));

            // 🍎🪟🐧 Encontra o Chrome usando função multiplataforma
            const executablePath = findChromePath(customBrowserPath);
            if (!executablePath) {
                throw new Error('Chrome não encontrado! Instale o Google Chrome ou configure o caminho nas configurações.');
            }

            const targetUrls = (profile.urls && profile.urls.length > 0) ? profile.urls : ['https://google.com'];

            // 🔥 PROXY-CHAIN: Cria proxy local anônimo para proxies autenticados
            let proxyUrl = null;
            if (profile.proxy) {
                try {
                    // Fecha proxy anterior deste perfil se existir
                    if (activeProxies.has(profile.id)) {
                        await proxyChain.closeAnonymizedProxy(activeProxies.get(profile.id), true);
                    }

                    // Cria URL de proxy no formato correto para proxy-chain
                    // proxy-chain aceita: http://user:pass@ip:port ou socks5://user:pass@ip:port
                    console.log(`🔄 Criando proxy anônimo para: ${profile.proxy}`);
                    const anonymizedProxy = await proxyChain.anonymizeProxy(profile.proxy);
                    proxyUrl = anonymizedProxy;
                    activeProxies.set(profile.id, anonymizedProxy);
                    console.log(`✅ Proxy anônimo criado: ${anonymizedProxy}`);
                } catch (proxyErr) {
                    console.error(`❌ Erro ao criar proxy anônimo:`, proxyErr);
                    // Fallback: usa proxy direto
                    proxyUrl = profile.proxy;
                }
            }

            // Configurações de inicialização
            const launchArgs = [
                '--no-first-run',
                '--no-default-browser-check',
                `--user-agent=${GLOBAL_UA}`,
                '--disable-infobars',
                // 🔒 Desabilita COMPLETAMENTE o gerenciador de senhas do Chrome
                '--disable-save-password-bubble',
                '--disable-component-update',
                '--disable-default-apps',
                '--disable-sync',
                // Autoplay para vídeos
                '--autoplay-policy=no-user-gesture-required',
                // Desabilita avisos e notificações
                '--disable-notifications',
                '--disable-popup-blocking',
                '--disable-translate',
                '--disable-dev-tools', // 🔒 Proteção F12
                // Proxy se configurado
                proxyUrl ? `--proxy-server=${proxyUrl}` : ''
            ].filter(Boolean);

            // 🔌 CARREGA EXTENSÕES EMBUTIDAS (se existirem)
            const extensionsList = getExtensionsList();
            if (extensionsList.length > 0) {
                const extensionsArg = `--load-extension=${extensionsList.join(',')}`;
                launchArgs.push(extensionsArg);
                console.log(`🔌 [PUPPETEER] Carregando ${extensionsList.length} extensão(ões)`);
            }

            // IMPORTANTE: Se houver mais de uma aba, NÃO usamos --app. 
            // O modo APP esconde a barra de abas do Chrome, impedindo o usuário de ver as outras páginas.
            if (targetUrls.length === 1) {
                launchArgs.push(`--app=${targetUrls[0]}`);
            }

            const browser = await puppeteer.launch({
                executablePath,
                headless: false,
                userDataDir,
                defaultViewport: null,
                ignoreHTTPSErrors: true,
                // Remove apenas a flag que mostra "Chrome está sendo controlado"
                ignoreDefaultArgs: ['--enable-automation'],
                args: [
                    ...launchArgs,
                    // Esconde a detecção de automação
                    '--disable-blink-features=AutomationControlled'
                ]
            });

            // Captura as páginas iniciais
            const pages = await browser.pages();
            const page = pages.length > 0 ? pages[0] : await browser.newPage();

            // 🛡️ APLICA PROTEÇÃO (F12, Botão Direito, etc) via função global
            await injectProtection(page);

            // PROTEÇÃO GLOBAL: Novas abas
            browser.on('targetcreated', async (target) => {
                if (target.type() === 'page') {
                    const newPage = await target.page();
                    if (newPage) await injectProtection(newPage);
                }
            });

            // Loop para abrir todas as URLs cadastradas
            for (let i = 0; i < targetUrls.length; i++) {
                if (i === 0 && page.url() !== 'about:blank') continue; // Primeira já carregada pelo --app

                const p = (i === 0) ? page : await browser.newPage();
                if (i > 0) await injectProtection(p); // Protege novas páginas criadas aqui

                // 🔥 INJEÇÃO DE COOKIES para perfis com sessão por cookies
                if (profile.cookies && profile.cookies.trim()) {
                    try {
                        let cookiesToSet = [];
                        const cookiesRaw = profile.cookies.trim();

                        // Tenta parsear como JSON (formato Export Cookie)
                        if (cookiesRaw.startsWith('[')) {
                            const parsedCookies = JSON.parse(cookiesRaw);
                            cookiesToSet = parsedCookies.map(c => ({
                                name: c.name,
                                value: c.value,
                                domain: c.domain || c.host,
                                path: c.path || '/',
                                httpOnly: c.httpOnly || false,
                                secure: c.secure || false,
                                sameSite: c.sameSite || 'Lax',
                                expires: c.expirationDate || c.expires || -1
                            }));
                        } else {
                            // Formato Netscape (tab-separated)
                            const lines = cookiesRaw.split('\n').filter(l => l && !l.startsWith('#'));
                            cookiesToSet = lines.map(line => {
                                const parts = line.split('\t');
                                if (parts.length >= 7) {
                                    return {
                                        domain: parts[0],
                                        path: parts[2],
                                        secure: parts[3].toLowerCase() === 'true',
                                        expires: parseInt(parts[4]) || -1,
                                        name: parts[5],
                                        value: parts[6]
                                    };
                                }
                                return null;
                            }).filter(Boolean);
                        }

                        // Injeta os cookies na página
                        if (cookiesToSet.length > 0) {
                            await page.setCookie(...cookiesToSet);
                            console.log(`🍪 ${cookiesToSet.length} cookies injetados para perfil ${profile.name}`);
                        }
                    } catch (cookieErr) {
                        console.error('❌ Erro ao injetar cookies:', cookieErr.message);
                    }
                }

                // proxy-chain já cuida da autenticação, não precisa de page.authenticate()

                // Aplica o "Sidnei Shield" em cada aba individualmente
                await page.evaluateOnNewDocument((email, pass, customCSS) => {
                    // ========== EVASÃO ANTI-DETECÇÃO ==========
                    // Remove webdriver property
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });

                    // Fake plugins
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [
                            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
                        ],
                    });

                    // Fake languages
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['pt-BR', 'pt', 'en-US', 'en'],
                    });

                    // Fake chrome runtime
                    window.chrome = {
                        runtime: {
                            id: undefined,
                            connect: () => { },
                            sendMessage: () => { },
                        },
                        loadTimes: () => ({}),
                        csi: () => ({}),
                        app: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } },
                    };

                    // Override permissions query
                    const originalQuery = window.navigator.permissions.query;
                    window.navigator.permissions.query = (parameters) => (
                        parameters.name === 'notifications' ?
                            Promise.resolve({ state: Notification.permission }) :
                            originalQuery(parameters)
                    );

                    // Hide automation indicators
                    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
                    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
                    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;

                    // ========== FIM EVASÃO ==========

                    // ========== BARRA DE NAVEGAÇÃO FLUTUANTE ==========
                    window.addEventListener('DOMContentLoaded', () => {
                        if (document.getElementById('sidnei-nav-bar')) return;

                        // CSS para esconder a barra de aviso do Chrome e popup de senha
                        const hideInfobar = document.createElement('style');
                        hideInfobar.textContent = `
                            /* Esconde a barra de aviso do Chrome */
                            [role="alert"], 
                            .infobar, 
                            *[class*="infobar"],
                            *[id*="infobar"],
                            div[style*="background-color: rgb(255, 255, 224)"],
                            div[style*="background: rgb(255, 255, 224)"] {
                                display: none !important;
                                height: 0 !important;
                                visibility: hidden !important;
                            }
                            /* Esconde o popup de salvar senha do Chrome */
                            [data-testid*="password"],
                            [class*="password-bubble"],
                            [class*="save-password"],
                            [class*="credential"],
                            div[class*="PasswordSave"],
                            div[aria-label*="senha"],
                            div[aria-label*="password"],
                            form[class*="password"] {
                                display: none !important;
                                visibility: hidden !important;
                            }
                        `;
                        document.head.appendChild(hideInfobar);

                        const navBar = document.createElement('div');
                        navBar.id = 'sidnei-nav-bar';
                        navBar.innerHTML = `
                            <style>
                                #sidnei-nav-bar {
                                    position: fixed;
                                    top: 10px;
                                    left: 50%;
                                    transform: translateX(-50%);
                                    z-index: 2147483647;
                                    display: flex;
                                    gap: 8px;
                                    background: linear-gradient(135deg, rgba(20, 20, 35, 0.97) 0%, rgba(30, 25, 50, 0.97) 100%);
                                    padding: 8px 16px;
                                    border-radius: 30px;
                                    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(138, 43, 226, 0.3);
                                    backdrop-filter: blur(20px);
                                    cursor: move;
                                    user-select: none;
                                    border: 1px solid rgba(138, 43, 226, 0.3);
                                }
                                #sidnei-nav-bar button {
                                    width: 40px;
                                    height: 40px;
                                    border: none;
                                    cursor: pointer;
                                    border-radius: 12px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    transition: all 0.3s ease;
                                    position: relative;
                                    overflow: hidden;
                                }
                                #sidnei-nav-bar button::before {
                                    content: '';
                                    position: absolute;
                                    inset: 0;
                                    opacity: 0;
                                    transition: opacity 0.3s;
                                }
                                #sidnei-nav-bar button:hover::before {
                                    opacity: 1;
                                }
                                #sidnei-nav-bar button:hover {
                                    transform: translateY(-2px);
                                    box-shadow: 0 6px 20px rgba(0,0,0,0.4);
                                }
                                #sidnei-nav-bar button:active {
                                    transform: scale(0.95) translateY(0);
                                }
                                #sidnei-nav-bar svg {
                                    width: 20px;
                                    height: 20px;
                                    fill: white;
                                    position: relative;
                                    z-index: 1;
                                    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
                                }
                                /* Botão Voltar - Roxo */
                                #snb-back {
                                    background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
                                    box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
                                }
                                #snb-back:hover {
                                    box-shadow: 0 6px 25px rgba(139, 92, 246, 0.6);
                                }
                                /* Botão Avançar - Azul */
                                #snb-forward {
                                    background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
                                    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
                                }
                                #snb-forward:hover {
                                    box-shadow: 0 6px 25px rgba(59, 130, 246, 0.6);
                                }
                                /* Botão Atualizar - Verde/Cyan */
                                #snb-refresh {
                                    background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                                    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
                                }
                                #snb-refresh:hover {
                                    box-shadow: 0 6px 25px rgba(16, 185, 129, 0.6);
                                }
                                /* Botão Fechar - Discreto */
                                #snb-close {
                                    background: rgba(255,255,255,0.1);
                                    width: 28px;
                                    height: 28px;
                                    font-size: 12px;
                                    color: rgba(255,255,255,0.5);
                                    margin-left: 4px;
                                    align-self: center;
                                }
                                #snb-close:hover {
                                    background: rgba(239, 68, 68, 0.8);
                                    color: white;
                                    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
                                }
                            </style>
                            <button id="snb-back" title="Voltar">
                                <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                            </button>
                            <button id="snb-forward" title="Avançar">
                                <svg viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
                            </button>
                            <button id="snb-refresh" title="Atualizar">
                                <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                            </button>
                            <button id="snb-close" title="Fechar barra">✕</button>
                        `;
                        document.body.appendChild(navBar);

                        // Funções dos botões
                        document.getElementById('snb-back').onclick = () => history.back();
                        document.getElementById('snb-forward').onclick = () => history.forward();
                        document.getElementById('snb-refresh').onclick = () => location.reload();
                        document.getElementById('snb-close').onclick = () => navBar.style.display = 'none';

                        // Drag para mover a barra
                        let isDragging = false, offsetX, offsetY;
                        navBar.onmousedown = (e) => {
                            if (e.target.tagName === 'BUTTON') return;
                            isDragging = true;
                            offsetX = e.clientX - navBar.offsetLeft;
                            offsetY = e.clientY - navBar.offsetTop;
                            navBar.style.transform = 'none'; // Remove translateX ao arrastar
                        };
                        document.onmousemove = (e) => {
                            if (isDragging) {
                                navBar.style.left = (e.clientX - offsetX) + 'px';
                                navBar.style.top = (e.clientY - offsetY) + 'px';
                            }
                        };
                        document.onmouseup = () => isDragging = false;
                    });
                    // ========== FIM BARRA DE NAVEGAÇÃO ==========

                    // Bloqueio de inspeção
                    window.addEventListener('keydown', (e) => {
                        if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) || (e.ctrlKey && e.keyCode === 85)) {
                            e.preventDefault();
                        }
                    }, true);

                    // Bloqueio de menu de contexto
                    window.addEventListener('contextmenu', (e) => e.preventDefault(), true);

                    // Auto-fill e Injeção de Estilos
                    setInterval(() => {
                        if (!document.getElementById('sidnei-shield-style')) {
                            const style = document.createElement('style');
                            style.id = 'sidnei-shield-style';
                            style.textContent = `
                        input:: -ms - reveal, input:: -ms - clear { display: none!important; }
                                .password - toggle, .show - password, [class*= "eye"], [id *= "eye"], svg[class*= "eye"] {
                            display: none!important;
                            visibility: hidden!important;
                            pointer - events: none!important;
                        }
                                ${customCSS || ''}
                        `;
                            document.head.appendChild(style);
                        }

                        // Localiza campos de login e senha (melhorado para HBO Max)
                        const inputs = document.querySelectorAll('input:not([type="hidden"])');
                        inputs.forEach(i => {
                            const attr = (
                                (i.name || '') +
                                (i.id || '') +
                                (i.placeholder || '') +
                                (i.getAttribute('aria-label') || '') +
                                (i.getAttribute('data-testid') || '') +
                                (i.getAttribute('autocomplete') || '')
                            ).toLowerCase();

                            // Detecta campo de email/usuário (incluindo HBO Max)
                            const isEmail = email && (
                                i.type === 'email' ||
                                i.type === 'text' ||
                                attr.includes('user') ||
                                attr.includes('login') ||
                                attr.includes('email') ||
                                attr.includes('e-mail') ||
                                attr.includes('endereço') ||
                                attr.includes('username')
                            );

                            // Detecta campo de senha
                            const isPass = pass && (
                                i.type === 'password' ||
                                attr.includes('pass') ||
                                attr.includes('senha') ||
                                attr.includes('pwd')
                            );

                            const target = isEmail ? email : (isPass ? pass : null);

                            if (target && i.value !== target && !i.matches(':focus')) {
                                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                                nativeSetter.call(i, target);
                                i.dispatchEvent(new Event('input', { bubbles: true }));
                                i.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        });
                    }, 3000);
                }, profile.email, profile.password, profile.customCSS);

                // Navega para a URL correspondente
                // Se i === 0 e targetUrls.length === 1, o --app já cuidou da navegação
                if (i > 0 || targetUrls.length > 1) {
                    await page.goto(targetUrls[i], { waitUntil: 'domcontentloaded' }).catch(err => {
                        console.error(`Erro ao navegar para ${targetUrls[i]}: `, err.message);
                    });
                }
            }

            return { status: 'success' };
        } catch (e) {
            console.error("Erro ao iniciar perfil externo:", e);
            return { status: 'error', message: e.message };
        }
    });

    ipcMain.handle('set-proxy', async (e, { proxy, partition }) => {
        const ses = session.fromPartition(partition);

        if (!proxy) {
            // Limpa o proxy
            await ses.setProxy({ proxyRules: '' });
            return { status: 'success' };
        }

        try {
            // 🔥 PARSE PROXY COM AUTENTICAÇÃO: protocol://user:pass@ip:port
            let proxyRule = '';
            let proxyAuth = null;

            // Regex para extrair: protocol://user:pass@ip:port
            const authMatch = proxy.match(/^(socks5|socks4|socks|http|https):\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/);

            if (authMatch) {
                const [, protocol, user, pass, ip, port] = authMatch;
                // Formato para Electron: protocol://ip:port (sem auth na URL)
                proxyRule = `${protocol}://${ip}:${port}`;
                proxyAuth = { username: user, password: pass };
                console.log(`🔒 Proxy configurado: ${proxyRule} (com autenticação para ${user})`);
            } else {
                // Formato simples sem autenticação ou já formatado
                proxyRule = proxy;
                console.log(`🔒 Proxy configurado: ${proxyRule} (sem autenticação)`);
            }

            // Configura o proxy
            await ses.setProxy({ proxyRules: proxyRule });

            // Remove listeners anteriores para evitar duplicação
            ses.removeAllListeners('login');

            // Se tem autenticação, usa o evento 'login' que funciona para proxies
            if (proxyAuth) {
                ses.on('login', (event, webContents, details, authInfo, callback) => {
                    if (authInfo.isProxy) {
                        console.log(`🔑 Autenticando proxy: ${authInfo.host}`);
                        event.preventDefault();
                        callback(proxyAuth.username, proxyAuth.password);
                    } else {
                        callback();
                    }
                });
            }

            return { status: 'success' };
        } catch (err) {
            console.error('❌ Erro ao configurar proxy:', err);
            return { status: 'error', message: err.message };
        }
    });

    ipcMain.handle('get-cookies', async (e, { partition }) => {
        const ses = session.fromPartition(partition);
        const cookies = await ses.cookies.get({});
        return { status: 'success', cookies };
    });

    ipcMain.handle('set-cookies', async (e, { cookies, partition }) => {
        const ses = session.fromPartition(partition);
        try {
            const list = typeof cookies === 'string' ? JSON.parse(cookies) : cookies;
            for (let c of list) {
                const domain = c.domain.startsWith('.') ? c.domain.substring(1) : c.domain;
                await ses.cookies.set({
                    url: `https://${domain}${c.path || '/'}`,
                    name: c.name, value: c.value, domain: c.domain, path: c.path || '/',
                    secure: true, httpOnly: !!c.httpOnly
                }).catch(() => { });
            }
            return { status: 'success' };
        } catch (err) { return { status: 'error' }; }
    });

    // ========== SINCRONIZAÇÃO DE SESSÃO VIA CLOUD ==========

    // Captura cookies + localStorage do Chrome nativo (para o admin salvar sessão)
    ipcMain.handle('capture-session', async (event, { profileId, targetUrl }) => {
        console.log(`📸 [SESSION] Capturando sessão para perfil: ${profileId}`);

        try {
            const userDataDir = path.join(app.getPath('userData'), 'profiles', profileId);

            // 🍎🪟🐧 Encontra o Chrome usando função multiplataforma
            const executablePath = findChromePath();
            if (!executablePath) {
                return { status: 'error', message: 'Chrome não encontrado. Verifique a instalação.' };
            }

            console.log(`🌐 [SESSION] Usando Chrome em: ${executablePath}`);

            // 🔥 USA CHROME COM INTERFACE para garantir melhor compatibilidade
            const browser = await puppeteer.launch({
                executablePath,
                headless: false, // Não headless para melhor captura de cookies
                userDataDir,
                defaultViewport: null,
                args: [
                    '--no-first-run',
                    '--disable-notifications',
                    '--no-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--window-position=-2000,-2000', // Esconde a janela
                    '--window-size=1,1'
                ]
            });

            const page = await browser.newPage();

            // Navega para o site alvo
            console.log(`🌐 [SESSION] Navegando para: ${targetUrl}`);
            try {
                await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            } catch (e) {
                console.warn(`⚠️ [SESSION] Navegação parcial:`, e.message);
            }

            await new Promise(r => setTimeout(r, 3000)); // Espera mais tempo para cookies serem setados

            // 🔥 USA CDP PARA CAPTURAR TODOS OS COOKIES (incluindo outros domínios como Clerk)
            const client = await page.target().createCDPSession();
            const { cookies: allCookies } = await client.send('Network.getAllCookies');
            console.log(`🍪 [SESSION] ${allCookies.length} cookies capturados (todos os domínios)`);

            // Log dos domínios para debug
            const domains = [...new Set(allCookies.map(c => c.domain))];
            console.log(`📂 [SESSION] Domínios capturados: ${domains.join(', ')}`);

            // Captura localStorage
            const localStorageData = await page.evaluate(() => {
                const data = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    data[key] = localStorage.getItem(key);
                }
                return data;
            });
            console.log(`💾 [SESSION] ${Object.keys(localStorageData).length} itens localStorage capturados`);

            // Captura sessionStorage também
            const sessionStorageData = await page.evaluate(() => {
                const data = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    data[key] = sessionStorage.getItem(key);
                }
                return data;
            });
            console.log(`📦 [SESSION] ${Object.keys(sessionStorageData).length} itens sessionStorage capturados`);

            await page.close();
            await browser.close();

            const sessionData = {
                cookies: allCookies, // Usa todos os cookies capturados via CDP
                localStorage: localStorageData,
                sessionStorage: sessionStorageData,
                capturedAt: new Date().toISOString(),
                capturedFrom: targetUrl,
                domains: domains // Salva os domínios para referência
            };

            console.log(`✅ [SESSION] Sessão capturada com sucesso!`);

            return { status: 'success', sessionData };

        } catch (err) {
            console.error(`❌ [SESSION] Erro ao capturar sessão:`, err.message);
            return { status: 'error', message: err.message };
        }
    });

    // Injeta cookies + localStorage antes de abrir o Chrome nativo
    ipcMain.handle('inject-session', async (event, { profileId, sessionData, targetUrl }) => {
        console.log(`💉 [SESSION] Injetando sessão para perfil: ${profileId}`);

        try {
            if (!sessionData || !sessionData.cookies) {
                console.log(`⚠️ [SESSION] Nenhuma sessão para injetar`);
                return { status: 'success', message: 'No session to inject' };
            }

            const userDataDir = path.join(app.getPath('userData'), 'profiles', profileId);
            if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

            // 🍎🪟🐧 Encontra o Chrome usando função multiplataforma
            const executablePath = findChromePath();
            if (!executablePath) {
                return { status: 'error', message: 'Chrome não encontrado. Verifique a instalação.' };
            }

            console.log(`🌐 [SESSION] Usando Chrome em: ${executablePath}`);

            // 🔥 USA CHROME COM INTERFACE (não headless) para garantir persistência de cookies
            // O headless: 'new' não persiste cookies corretamente para o Chrome nativo
            const browser = await puppeteer.launch({
                executablePath,
                headless: false, // IMPORTANTE: headless não persiste cookies!
                userDataDir,
                defaultViewport: null, // Usa viewport padrão
                args: [
                    '--no-first-run',
                    '--disable-notifications',
                    '--no-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--window-position=-2000,-2000', // Esconde a janela fora da tela
                    '--window-size=1,1'
                ]
            });

            const page = await browser.newPage();

            // 🔥 USA CDP PARA INJETAR TODOS OS COOKIES (incluindo outros domínios como Clerk)
            if (sessionData.cookies && sessionData.cookies.length > 0) {
                console.log(`🍪 [SESSION] Injetando ${sessionData.cookies.length} cookies via CDP...`);

                const client = await page.target().createCDPSession();

                // Limpa cookies antigos do browser
                await client.send('Network.clearBrowserCookies');

                // Prepara cookies para CDP (remove propriedades problemáticas)
                const cleanCookies = sessionData.cookies.map(cookie => {
                    const clean = { ...cookie };
                    delete clean.session;
                    delete clean.storeId;
                    delete clean.hostOnly;
                    // Converte expires para o formato correto (timestamp in seconds)
                    if (clean.expires && typeof clean.expires === 'number' && clean.expires > 0) {
                        clean.expires = clean.expires;
                    } else {
                        delete clean.expires;
                    }
                    return clean;
                });

                // Usa Network.setCookies para injetar todos de uma vez
                try {
                    await client.send('Network.setCookies', { cookies: cleanCookies });
                    console.log(`🍪 [SESSION] ${cleanCookies.length} cookies injetados via CDP!`);

                    // Log dos domínios para verificação
                    const domains = [...new Set(cleanCookies.map(c => c.domain))];
                    console.log(`📂 [SESSION] Domínios injetados: ${domains.join(', ')}`);
                } catch (cdpErr) {
                    console.error(`⚠️ [SESSION] Erro CDP, tentando método alternativo:`, cdpErr.message);
                    // Fallback: injeta um por um
                    let injectedCount = 0;
                    for (const cookie of cleanCookies) {
                        try {
                            await page.setCookie(cookie);
                            injectedCount++;
                        } catch (e) { }
                    }
                    console.log(`🍪 [SESSION] ${injectedCount} cookies injetados (fallback)`);
                }
            }

            // Navega para o site para aplicar os cookies
            console.log(`🌐 [SESSION] Navegando para: ${targetUrl}`);
            try {
                await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            } catch (navErr) {
                console.warn(`⚠️ [SESSION] Navegação parcial:`, navErr.message);
            }

            // Injeta localStorage
            if (sessionData.localStorage && Object.keys(sessionData.localStorage).length > 0) {
                console.log(`💾 [SESSION] Injetando ${Object.keys(sessionData.localStorage).length} itens localStorage...`);
                await page.evaluate((data) => {
                    for (const [key, value] of Object.entries(data)) {
                        try { localStorage.setItem(key, value); } catch (e) { }
                    }
                }, sessionData.localStorage);
            }

            // 🔥 DELAY CRÍTICO: Espera o Chrome gravar os cookies no disco
            console.log(`⏳ [SESSION] Aguardando persistência no disco...`);
            await new Promise(r => setTimeout(r, 3000));

            // Fecha corretamente
            await page.close();
            await browser.close();

            console.log(`✅ [SESSION] Sessão injetada e persistida com sucesso!`);

            return { status: 'success' };

        } catch (err) {
            console.error(`❌ [SESSION] Erro ao injetar sessão:`, err.message);
            return { status: 'error', message: err.message };
        }
    });

    ipcMain.handle('open-popup', async (e, { url, partition }) => {
        let win = new BrowserWindow({
            width: 1000, height: 700,
            backgroundColor: '#050505',
            webPreferences: { partition, contextIsolation: true, nodeIntegration: false }
        });
        win.setMenu(null);
        win.loadURL(url);
        return { status: 'success' };
    });

    // 🔥 HANDLER PARA AÇÕES DOS BOTÕES FLUTUANTES
    ipcMain.on('floating-button-action', async (event, { action, profileId }) => {
        console.log(`🎛️ [OVERLAY] Ação: ${action} para perfil ${profileId}`);

        const instance = activePuppeteerInstances.get(profileId);
        if (!instance) {
            console.log(`⚠️ [OVERLAY] Instância não encontrada para ${profileId}`);
            return;
        }

        const { browser, page } = instance;

        try {
            switch (action) {
                case 'close':
                    await browser.close().catch(() => { });
                    activePuppeteerInstances.delete(profileId);
                    console.log(`✅ [OVERLAY] Browser fechado via botão flutuante`);
                    break;
                case 'back':
                    if (page) await page.goBack().catch(() => { });
                    break;
                case 'forward':
                    if (page) await page.goForward().catch(() => { });
                    break;
                case 'reload':
                    if (page) await page.reload().catch(() => { });
                    break;
            }
        } catch (err) {
            console.error(`❌ [OVERLAY] Erro na ação ${action}:`, err.message);
        }
    });
}

function createMainWindow() {
    Menu.setApplicationMenu(null);
    mainWindow = new BrowserWindow({
        width: 1400, height: 900, backgroundColor: '#050505',
        webPreferences: {
            nodeIntegration: false, contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webviewTag: true, webSecurity: false
        },
    });
    if (app.isPackaged) mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    else mainWindow.loadURL('http://localhost:5173');
}

registerIPCHandlers();
app.whenReady().then(() => {
    // 🔥 CORREÇÃO: Só configura o app depois que ele estiver pronto
    app.setMaxListeners(0);
    createMainWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });