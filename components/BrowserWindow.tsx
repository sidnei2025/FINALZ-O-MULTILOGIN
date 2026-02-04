import React, { useEffect, useState, useRef } from 'react';
import { RefreshCw, ShieldCheck, Lock, ChevronLeft, ChevronRight, Globe, Key, UploadCloud, Database, MessageSquare, Ban, X, Power, PlayCircle, MessageCircle, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { Profile } from '../types';

interface BrowserWindowProps {
  profile: Profile;
  isVisible: boolean;
  onClose: () => void;
  onTerminate: () => void;
  onToast?: (msg: string, type: 'info' | 'error' | 'success') => void;
  blockedUrls?: string[];
  // Fix: Added missing onSyncSession prop to resolve TypeScript error in App.tsx
  onSyncSession?: (profileId: string, cookies: string, localStorageData: string) => void | Promise<void>;
}

interface DownloadStatus {
  fileName: string;
  progress: number;
  state: 'downloading' | 'success' | 'error';
}

const COMPATIBLE_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

export const BrowserWindow: React.FC<BrowserWindowProps> = ({ profile, isVisible, onClose, onTerminate, onToast, blockedUrls = [], onSyncSession }) => {
  const [tabs] = useState<string[]>(profile.urls && profile.urls.length > 0 ? profile.urls : ['https://google.com']);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState({ width: 1000, height: 700 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState<string | null>(null);
  const [autoFillEnabled, setAutoFillEnabled] = useState(profile.autoLoginEnabled ?? true);
  const [download, setDownload] = useState<DownloadStatus | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  const dragStartRef = useRef({ x: 0, y: 0, winX: 0, winY: 0, w: 0, h: 0 });
  const webviewRefs = useRef<Array<any | null>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReadyToNavigate, setIsReadyToNavigate] = useState(false);
  const lastProfileId = useRef<string | null>(null);

  // TRAVA DE 60 SEGUNDOS - REFERÊNCIA DE TEMPO
  const lastSyncTimeRef = useRef<number>(0);

  useEffect(() => {
    if (profile && lastProfileId.current === profile.id) return;
    setIsReadyToNavigate(false);
    setIsRestoringSession(true);
    lastProfileId.current = profile.id;

    const prepareSession = async () => {
      let retry = 0;
      // 🔥 CORREÇÃO: Timeout máximo de 3 segundos se nebulaAPI não existir
      while (!window.nebulaAPI && retry < 30) {
        await new Promise(r => setTimeout(r, 100));
        retry++;
      }

      // Se nebulaAPI existir, configura proxy e cookies
      if (window.nebulaAPI) {
        const partition = "persist:" + profile.id;
        try {
          await window.nebulaAPI.setProxy(profile.proxy || '', partition);
          if (profile.cookies) {
            await window.nebulaAPI.setCookies(profile.cookies, partition);
          }
          await new Promise(r => setTimeout(r, 800));
        } catch (err) { console.error(err); }
      } else {
        // 🔥 FALLBACK: Se não tem nebulaAPI (modo web), não bloqueia
        console.warn('⚠️ nebulaAPI não disponível, carregando em modo web...');
        await new Promise(r => setTimeout(r, 500));
      }

      setIsRestoringSession(false);
      setIsReadyToNavigate(true);
    };
    prepareSession();

    // LISTENER DE DOWNLOAD (ADICIONADO)
    if (window.nebulaAPI?.onDownloadProgress) {
      window.nebulaAPI.onDownloadProgress((data: any) => {
        if (data.profileId === profile.id) {
          setDownload({
            fileName: data.fileName,
            progress: data.progress,
            state: data.state
          });
          if (data.state !== 'downloading') {
            setTimeout(() => setDownload(null), 5000);
          }
        }
      });
    }
  }, [profile.id]);

  const performCloudSync = async (isManual = false) => {
    const activeWebview = webviewRefs.current[activeTabIndex];
    if (!activeWebview || !profile || !window.nebulaAPI) return;

    // APLICAÇÃO DA TRAVA DE 60 SEGUNDOS (THROTTLING)
    const now = Date.now();
    if (!isManual && now - lastSyncTimeRef.current < 60000) {
      return; // Se não for manual e não passou 60s, cancela o envio para poupar CPU
    }

    if (isManual) setIsSyncing(true);
    try {
      const partition = "persist:" + profile.id;
      const cookieResult = await window.nebulaAPI.getCookies(partition);
      let lsData = "{}";
      try { lsData = await activeWebview.executeJavaScript("JSON.stringify(window.localStorage)"); } catch (e) { }
      if (cookieResult?.status === 'success') {
        // Fix: Call onSyncSession if provided to handle cloud sync via App.tsx
        if (onSyncSession) {
          const cookiesStr = JSON.stringify(cookieResult.cookies || []);
          await onSyncSession(profile.id, cookiesStr, lsData);
        } else {
          // Fallback to legacy local agent if onSyncSession is not available
          await fetch('http://127.0.0.1:19999/sync-cookies', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: profile.id, cookies: cookieResult.cookies || [], localStorage: lsData })
          });
        }

        // ATUALIZA O TEMPO DO ÚLTIMO SYNC
        lastSyncTimeRef.current = Date.now();

        if (isManual && onToast) onToast('Sincronizado!', 'success');
      }
    } catch (e) { if (isManual) onToast('Erro Sync', 'error'); }
    finally { if (isManual) setTimeout(() => setIsSyncing(false), 800); }
  };

  const executeDiscordTokenLogin = async (webview: any) => {
    if (!profile.discordToken || !webview) return;
    const tokenScript = `
      (function() {
        const token = "${profile.discordToken}";
        function login(token) {
            setInterval(() => {
                if (document.body) {
                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    document.body.appendChild(iframe);
                    const local = iframe.contentWindow.localStorage;
                    if (local.token !== '"' + token + '"') {
                        local.token = '"' + token + '"';
                        location.reload();
                    }
                }
            }, 1000);
        }
        login(token);
      })();
    `;
    try {
      await webview.executeJavaScript(tokenScript);
      if (onToast) onToast('Injetando Token...', 'info');
    } catch (e) { console.error(e); }
  };

  const runCustomAutomation = async (webview: any) => {
    if (!profile.automationScript || !webview) return;
    const safeScript = `
      (function() {
        if (!sessionStorage.getItem('nebula_script_run')) {
          try {
            ${profile.automationScript}
            sessionStorage.setItem('nebula_script_run', 'true');
          } catch(e) { console.error(e); }
        }
      })();
    `;
    try {
      await webview.executeJavaScript(safeScript);
      if (onToast) onToast('Script Iniciado!', 'success');
    } catch (e) { if (onToast) onToast('Erro no Script', 'error'); }
  };

  useEffect(() => {
    if (!isReadyToNavigate) return;

    tabs.forEach((_, idx) => {
      const webview = webviewRefs.current[idx];
      if (!webview) return;

      const handleDomReady = () => {
        if (idx === activeTabIndex) setIsLoading(false);

        webview.insertCSS(`
          input::-ms-reveal, input::-ms-clear { display: none !important; }
          .password-toggle, .show-password, [class*="eye"], [id*="eye"], svg[class*="eye"], 
          button[class*="eye"], .reveal-password, [class*="PasswordToggle"],
          button[aria-label*="senha"], button[aria-label*="password"], 
          .toggle-password, i[class*="eye"], [data-testid*="eye"], [aria-label*="Show password"] { 
              display: none !important; 
          }
        `);

        if (profile.customCSS) webview.insertCSS(profile.customCSS);

        if (profile.discordToken && webview.getURL().includes('discord.com')) {
          executeDiscordTokenLogin(webview);
        }
        if (profile.automationScript) {
          runCustomAutomation(webview);
        }

        // 🔥 SCRIPT ANTI-DETECÇÃO ULTRA AVANÇADO (PARA GOOGLE/MICROSOFT)
        const antiDetectionScript = `
          (function() {
            if (window.__antiDetectRan) return;
            window.__antiDetectRan = true;
            
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });
            
            // 🔥 CRÍTICO PARA GOOGLE: Faz parecer que não é iframe/webview
            try {
              Object.defineProperty(window, 'self', { get: () => window.top, configurable: true });
              Object.defineProperty(window, 'frameElement', { get: () => null, configurable: true });
            } catch(e) {}
            
            // 🔥 GOOGLE VERIFICA: window.opener (se foi aberto como popup)
            if (!window.opener) {
              Object.defineProperty(window, 'opener', { get: () => null, configurable: true });
            }
            
            // 🔥 GOOGLE VERIFICA: outerWidth/outerHeight (webviews tem valores diferentes)
            Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth, configurable: true });
            Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 100, configurable: true });
            
            // 🔥 GOOGLE VERIFICA: devicePixelRatio
            Object.defineProperty(window, 'devicePixelRatio', { get: () => 1, configurable: true });
            
            // Fake plugins (como Chrome real)
            const fakePlugins = [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
              { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 }
            ];
            fakePlugins.length = 3;
            fakePlugins.item = (i) => fakePlugins[i];
            fakePlugins.namedItem = (name) => fakePlugins.find(p => p.name === name);
            fakePlugins.refresh = () => {};
            Object.defineProperty(navigator, 'plugins', { get: () => fakePlugins, configurable: true });
            
            // Fake mimeTypes (Google verifica)
            const fakeMimeTypes = [
              { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: fakePlugins[0] },
              { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable', enabledPlugin: fakePlugins[2] }
            ];
            fakeMimeTypes.length = 2;
            fakeMimeTypes.item = (i) => fakeMimeTypes[i];
            fakeMimeTypes.namedItem = (type) => fakeMimeTypes.find(m => m.type === type);
            Object.defineProperty(navigator, 'mimeTypes', { get: () => fakeMimeTypes, configurable: true });
            
            // Fake languages
            Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'], configurable: true });
            Object.defineProperty(navigator, 'language', { get: () => 'pt-BR', configurable: true });
            
            // Fake platform
            Object.defineProperty(navigator, 'platform', { get: () => 'Win32', configurable: true });
            
            // Fake vendor
            Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.', configurable: true });
            
            // 🔥 GOOGLE VERIFICA: productSub e appVersion
            Object.defineProperty(navigator, 'productSub', { get: () => '20030107', configurable: true });
            Object.defineProperty(navigator, 'appVersion', { get: () => '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', configurable: true });
            
            // 🔥 GOOGLE VERIFICA: maxTouchPoints (desktop = 0)
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0, configurable: true });
            
            // 🔥 GOOGLE VERIFICA: hardwareConcurrency
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true });
            
            // 🔥 GOOGLE VERIFICA: deviceMemory
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });
            
            // 🔥 GOOGLE VERIFICA: connection
            Object.defineProperty(navigator, 'connection', { 
              get: () => ({ 
                effectiveType: '4g', 
                rtt: 50, 
                downlink: 10, 
                saveData: false,
                onchange: null,
                addEventListener: () => {},
                removeEventListener: () => {}
              }), 
              configurable: true 
            });
            
            // Chrome runtime (CRÍTICO para Google/Microsoft)
            window.chrome = {
              runtime: { 
                id: undefined, 
                connect: () => {}, 
                sendMessage: () => {}, 
                onMessage: { addListener: () => {}, removeListener: () => {} },
                onConnect: { addListener: () => {}, removeListener: () => {} },
                getManifest: () => null,
                getURL: () => ''
              },
              loadTimes: () => ({ 
                commitLoadTime: Date.now() / 1000, 
                connectionInfo: 'http/1.1', 
                finishDocumentLoadTime: Date.now() / 1000, 
                finishLoadTime: Date.now() / 1000, 
                firstPaintAfterLoadTime: 0, 
                firstPaintTime: Date.now() / 1000, 
                navigationType: 'Other', 
                npnNegotiatedProtocol: 'unknown', 
                requestTime: Date.now() / 1000, 
                startLoadTime: Date.now() / 1000, 
                wasAlternateProtocolAvailable: false, 
                wasFetchedViaSpdy: false, 
                wasNpnNegotiated: false 
              }),
              csi: () => ({ pageT: Date.now(), startE: Date.now(), onloadT: Date.now() }),
              app: { 
                isInstalled: false, 
                InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, 
                RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } 
              }
            };
            
            // Override permissions query
            if (navigator.permissions && navigator.permissions.query) {
              const originalQuery = navigator.permissions.query.bind(navigator.permissions);
              navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : originalQuery(parameters)
              );
            }
            
            // 🔥 GOOGLE VERIFICA: Notification constructor
            if (typeof Notification !== 'undefined') {
              const OriginalNotification = Notification;
              Notification = function(title, options) {
                return new OriginalNotification(title, options);
              };
              Notification.permission = OriginalNotification.permission || 'default';
              Notification.requestPermission = OriginalNotification.requestPermission?.bind(OriginalNotification) || (() => Promise.resolve('default'));
              Notification.maxActions = OriginalNotification.maxActions || 2;
            }
            
            // Remove automation indicators
            const propsToDelete = [
              'cdc_adoQpoasnfa76pfcZLmcfl_Array',
              'cdc_adoQpoasnfa76pfcZLmcfl_Promise', 
              'cdc_adoQpoasnfa76pfcZLmcfl_Symbol',
              '__webdriver_script_fn',
              '__driver_evaluate',
              '__webdriver_evaluate',
              '__selenium_evaluate',
              '__fxdriver_evaluate',
              '__driver_unwrapped',
              '__webdriver_unwrapped',
              '__selenium_unwrapped',
              '__fxdriver_unwrapped',
              '__lastWatirAlert',
              '__lastWatirConfirm',
              '__lastWatirPrompt',
              '$chrome_asyncScriptInfo',
              '__$webdriverAsyncExecutor'
            ];
            propsToDelete.forEach(p => { try { delete window[p]; } catch(e) {} });
            propsToDelete.forEach(p => { try { delete document[p]; } catch(e) {} });
            
            // 🔥 GOOGLE VERIFICA: Canvas fingerprint (retorna consistente)
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function(type) {
              if (this.width === 0 || this.height === 0) return originalToDataURL.apply(this, arguments);
              return originalToDataURL.apply(this, arguments);
            };
            
            // 🔥 GOOGLE VERIFICA: WebGL fingerprint
            const getParameterProxyHandler = {
              apply: function(target, ctx, args) {
                const param = args[0];
                const result = Reflect.apply(target, ctx, args);
                // Retorna valores de GPU comum
                if (param === 37445) return 'Intel Inc.'; // UNMASKED_VENDOR_WEBGL
                if (param === 37446) return 'Intel(R) UHD Graphics 630'; // UNMASKED_RENDERER_WEBGL
                return result;
              }
            };
            try {
              const canvas = document.createElement('canvas');
              const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
              if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                  gl.getParameter = new Proxy(gl.getParameter.bind(gl), getParameterProxyHandler);
                }
              }
            } catch(e) {}
            
            // Fake screen
            Object.defineProperty(screen, 'availWidth', { get: () => window.screen.width, configurable: true });
            Object.defineProperty(screen, 'availHeight', { get: () => window.screen.height - 40, configurable: true });
            Object.defineProperty(screen, 'colorDepth', { get: () => 24, configurable: true });
            Object.defineProperty(screen, 'pixelDepth', { get: () => 24, configurable: true });
            
            console.log('🛡️ Anti-detecção avançada ativada');
          })();
        `;
        webview.executeJavaScript(antiDetectionScript);

        const maintenanceScript = `
          (function() {
            const blocked = ${JSON.stringify(blockedUrls || [])};
            function check() {
              const cur = window.location.href.toLowerCase();
              if (blocked.some(i => i && cur.includes(i.toLowerCase()))) {
                document.body.innerHTML = '<div style="background:#000;color:red;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;text-align:center;"><h1 style="font-size:50px;">🚫</h1><h2 style="font-weight:900;">ACESSO RESTRITO</h2><p>Página bloqueada pelo administrador.</p></div>';
                window.stop();
              }
            }
            setInterval(check, 1000); check();

            const EMAIL = '${profile.email || ''}';
            const PASS = '${profile.password || ''}';
            function triggerNativeInput(el, val) {
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
              setter ? setter.call(el, val) : (el.value = val);
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
            function fill() {
              if (!${autoFillEnabled}) return;
              document.querySelectorAll('input').forEach(i => {
                const attr = (i.name + i.id + i.placeholder + (i.getAttribute('aria-label')||'')).toLowerCase();
                if (EMAIL && (i.type === 'email' || attr.includes('user') || attr.includes('login') || attr.includes('email'))) {
                  if (!i.value) triggerNativeInput(i, EMAIL);
                }
                if (PASS && (i.type === 'password' || attr.includes('pass') || attr.includes('senha'))) {
                  if (!i.value) triggerNativeInput(i, PASS);
                  if (i.type !== 'password') i.type = 'password';
                }
              });
            }
            setInterval(fill, 3000); fill();
          })();
        `;
        webview.executeJavaScript(maintenanceScript);
      };

      webview.addEventListener('dom-ready', handleDomReady);
      webview.addEventListener('did-start-loading', () => { if (idx === activeTabIndex) setIsLoading(true); });
      webview.addEventListener('did-stop-loading', () => {
        if (idx === activeTabIndex) {
          setIsLoading(false);
          performCloudSync();
        }
      });
    });

  }, [profile.id, isReadyToNavigate, autoFillEnabled, blockedUrls, profile.discordToken, profile.automationScript, activeTabIndex]);

  const startDrag = (e: React.MouseEvent) => { if (!isMaximized) { setIsDragging(true); dragStartRef.current = { x: e.clientX, y: e.clientY, winX: position.x, winY: position.y, w: size.width, h: size.height }; } };
  const startResize = (e: React.MouseEvent, d: string) => { if (!isMaximized) { e.stopPropagation(); setIsResizing(true); setResizeDir(d); dragStartRef.current = { x: e.clientX, y: e.clientY, winX: position.x, winY: position.y, w: size.width, h: size.height }; } };

  useEffect(() => {
    const handleMM = (e: MouseEvent) => {
      if (!isVisible) return;
      if (isDragging) setPosition({ x: dragStartRef.current.winX + (e.clientX - dragStartRef.current.x), y: Math.max(0, dragStartRef.current.winY + (e.clientY - dragStartRef.current.y)) });
      else if (isResizing && resizeDir) {
        const deltaX = e.clientX - dragStartRef.current.x, deltaY = e.clientY - dragStartRef.current.y;
        const s = dragStartRef.current;
        let w = s.w, h = s.h;
        if (resizeDir.includes('e')) w = Math.max(400, s.w + deltaX);
        if (resizeDir.includes('s')) h = Math.max(300, s.h + deltaY);
        setSize({ width: w, height: h });
      }
    };
    const handleMU = () => { setIsDragging(false); setIsResizing(false); };
    if (isVisible && (isDragging || isResizing)) { window.addEventListener('mousemove', handleMM); window.addEventListener('mouseup', handleMU); }
    return () => { window.removeEventListener('mousemove', handleMM); window.removeEventListener('mouseup', handleMU); };
  }, [isVisible, isDragging, isResizing, resizeDir]);

  const activeWebview = webviewRefs.current[activeTabIndex];

  return (
    <div
      className={`fixed z-[100] flex-col bg-[#1a1a1a] shadow-2xl border border-gray-700 overflow-hidden ${isMaximized ? '' : 'rounded-xl'}`}
      style={{ display: isVisible ? 'flex' : 'none', top: isMaximized ? 0 : position.y, left: isMaximized ? 0 : position.x, width: isMaximized ? '100%' : size.width, height: isMaximized ? '100%' : size.height }}
    >
      <div onMouseDown={(e) => startResize(e, 'se')} className="absolute bottom-0 right-0 w-4 h-4 z-50 cursor-nwse-resize" />

      <div onMouseDown={startDrag} onDoubleClick={() => setIsMaximized(!isMaximized)} className="bg-[#202020] flex items-center px-4 pt-2 justify-between border-b border-gray-800 cursor-grab active:cursor-grabbing select-none">
        <div className="flex gap-2 pb-2" onMouseDown={e => e.stopPropagation()}>
          <div onClick={onClose} className="w-3.5 h-3.5 rounded-full bg-red-500 cursor-pointer hover:bg-red-400" />
          <div onClick={() => setIsMaximized(!isMaximized)} className="w-3.5 h-3.5 rounded-full bg-green-500 cursor-pointer hover:bg-green-400" />
        </div>

        {/* BARRA DE ABAS - DINÂMICA */}
        <div className="flex-1 flex px-4 overflow-hidden gap-1">
          {tabs.map((url, idx) => (
            <div
              key={idx}
              onClick={() => setActiveTabIndex(idx)}
              className={`px-3 py-1 rounded-t text-[10px] flex items-center gap-2 max-w-[150px] cursor-pointer transition-all ${activeTabIndex === idx ? 'bg-[#333] text-white' : 'bg-black/20 text-gray-500 hover:bg-[#252525]'}`}
            >
              <Globe size={10} className={activeTabIndex === idx ? "text-purple-400" : "text-gray-600"} />
              <span className="truncate font-bold">Aba {idx + 1}</span>
            </div>
          ))}
        </div>

        <div className="text-gray-500 text-[10px] font-bold uppercase flex gap-3 items-center pb-2">
          <ShieldCheck size={12} className="text-green-500" /> Multilogin Sidnei
        </div>
      </div>

      <div className="h-9 bg-[#333] flex items-center px-3 gap-2 border-b border-gray-700">
        <div className="flex gap-1">
          <button onClick={() => activeWebview?.goBack()} className="text-gray-400 hover:text-white"><ChevronLeft size={16} /></button>
          <button onClick={() => activeWebview?.goForward()} className="text-gray-400 hover:text-white"><ChevronRight size={16} /></button>
          <button onClick={() => activeWebview?.reload()} className="text-gray-400 hover:text-white ml-1"><RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /></button>
        </div>
        <div className="flex-1 bg-[#1a1a1a] rounded h-6 flex items-center px-3 text-xs text-gray-400 border border-gray-700 overflow-hidden select-none">
          <Lock size={10} className="mr-2 text-green-500 flex-shrink-0" />
          <span className="truncate font-black uppercase tracking-tighter text-[9px]">Sessão Criptografada (Chrome 143) — {profile.name} — Aba {activeTabIndex + 1}</span>
        </div>

        <div className="flex gap-1">
          {profile.discordToken && (
            <button onClick={() => executeDiscordTokenLogin(activeWebview)} className="p-1.5 rounded text-indigo-400 hover:bg-indigo-900/20 transition-all" title="Login Discord">
              <MessageCircle size={16} />
            </button>
          )}
          {profile.automationScript && (
            <button onClick={() => runCustomAutomation(activeWebview)} className="p-1.5 rounded text-green-400 hover:bg-green-900/20 transition-all" title="Executar Script">
              <PlayCircle size={16} />
            </button>
          )}
          <button onClick={() => performCloudSync(true)} disabled={isSyncing} className={`p-1.5 rounded ${isSyncing ? 'text-purple-400' : 'text-gray-400 hover:text-white'}`} title="Sincronizar Nuvem">
            <UploadCloud size={16} className={isSyncing ? 'animate-bounce' : ''} />
          </button>
          <button onClick={() => setAutoFillEnabled(!autoFillEnabled)} className={`p-1.5 rounded ${autoFillEnabled ? 'text-green-500 bg-green-900/10' : 'text-gray-500'}`} title="Auto-Preenchimento"><Key size={16} /></button>
        </div>
      </div>

      {/* BARRA DE PROGRESSO DE DOWNLOAD */}
      {download && (
        <div className="bg-[#252525] border-b border-gray-700 px-4 py-2 flex items-center gap-4 animate-fade-in">
          <div className="p-1.5 bg-blue-600/20 rounded-lg text-blue-400">
            {download.state === 'downloading' ? <Download size={14} className="animate-bounce" /> : download.state === 'success' ? <CheckCircle size={14} className="text-green-500" /> : <AlertCircle size={14} className="text-red-500" />}
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
              <span className="truncate max-w-[200px]">{download.fileName}</span>
              <span>{download.state === 'downloading' ? `${download.progress}%` : download.state.toUpperCase()}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-300 ${download.state === 'success' ? 'bg-green-500' : download.state === 'error' ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${download.progress}%` }} />
            </div>
          </div>
          <button onClick={() => setDownload(null)} className="text-gray-600 hover:text-white"><X size={14} /></button>
        </div>
      )}

      <div className="flex-1 relative bg-white">
        {isReadyToNavigate && !isRestoringSession ? (
          tabs.map((url, idx) => (
            <webview
              key={idx}
              ref={el => { webviewRefs.current[idx] = el; }}
              src={url}
              partition={"persist:" + profile.id}
              // @ts-ignore
              allowpopups="true"
              useragent={COMPATIBLE_USER_AGENT}
              webpreferences="contextIsolation=yes, nodeIntegration=no, webSecurity=yes, spellcheck=yes, plugins=yes, javascript=yes, allowRunningInsecureContent=no, experimentalFeatures=no"
              style={{ width: '100%', height: '100%', display: activeTabIndex === idx ? 'flex' : 'none' }}
            />
          ))
        ) : (
          <div className="absolute inset-0 bg-[#0f0f0f] flex flex-col items-center justify-center gap-6">
            <Database className="w-16 h-16 text-purple-600 animate-pulse" />
            <h3 className="text-purple-400 font-black tracking-widest uppercase text-sm">Blindando Navegador (Chrome 143)...</h3>
          </div>
        )}
        {isLoading && !isRestoringSession && (
          <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-10">
            <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};