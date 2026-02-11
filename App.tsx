
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
   User as UserIcon, Settings, Users, LogOut, Search,
   Plus, Clock, Save, Monitor, Shield, Trash2, Ban, Filter, ExternalLink, RefreshCw, MessageCircle, MessageSquare, Bell, Type, Image as ImageIcon, Video, Palette, Globe, Chrome, CloudSnow, Flame, Sun, CloudRain, Cpu, Laptop, Lock, UserX, Wifi, WifiOff, CheckSquare, Square, GripVertical, CloudLightning, Key, Stamp, Gamepad2, Puzzle, Eye, EyeOff, AlertTriangle, CreditCard, FileUp, Calendar, LayoutGrid, Layers, Activity, PlayCircle, X, Power, List, KeyRound, Globe2, Edit2, Zap, HelpCircle, ChevronDown, Check, Star, Copy, Terminal, Info, Code, UploadCloud, DownloadCloud
} from 'lucide-react';

import { Role, User, Profile, AppSettings, SeasonalEffectType, FingerprintConfig } from './types';
import { Button, Input, Modal, Switch } from './components/UI';
import { ProfileCard } from './components/ProfileCard';
import { Toast } from './components/Toast';
import { BrowserWindow } from './components/BrowserWindow';
import { AnnouncementPopup } from './components/AnnouncementPopup';
import ParticleBackground from './components/ParticleBackground';
import { ADMIN_SUPPORT_LINK, INITIAL_SETTINGS, MOCK_PROFILES, MOCK_USERS } from './constants';
import { DataService } from './services/DataService';
import { supabase } from './lib/supabase';
import { Security } from './services/Security';
import { Pagination } from './components/Pagination';

const App: React.FC = () => {
   const machineId = useMemo(() => {
      let id = localStorage.getItem('sidnei_hwid_v2');
      if (!id) {
         id = 'sid_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
         localStorage.setItem('sidnei_hwid_v2', id);
      }
      return id;
   }, []);

   // --- HIDRATAÇÃO IMEDIATA ---
   const [currentUser, setCurrentUser] = useState<User | null>(() => {
      return Security.decrypt(localStorage.getItem('sidnei_session_v2'));
   });

   const [users, setUsers] = useState<User[]>(() => {
      return Security.decrypt(localStorage.getItem('nebula_users_v1')) || [];
   });

   const [profiles, setProfiles] = useState<Profile[]>(() => {
      return Security.decrypt(localStorage.getItem('nebula_profiles_v1')) || [];
   });

   const [settings, setSettings] = useState<AppSettings | null>(() => {
      return Security.decrypt(localStorage.getItem('nebula_settings_v1')) || INITIAL_SETTINGS;
   });

   const [localSettings, setLocalSettings] = useState<AppSettings | null>(settings);
   const [isOfflineMode, setIsOfflineMode] = useState(false);
   const [vpsStatus, setVpsStatus] = useState<{ connected: boolean; latency: number }>({ connected: false, latency: 0 });
   const [isAppLoading, setIsAppLoading] = useState(true);
   const [isSaving, setIsSaving] = useState(false);
   const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
   const [launchingStatus, setLaunchingStatus] = useState<{ isLaunching: boolean; message: string; profileName?: string }>({ isLaunching: false, message: '' });

   // --- UI TABS & FILTERS ---
   const [activeTab, setActiveTab] = useState<'profiles' | 'users' | 'settings'>('profiles');
   const [userSubTab, setUserSubTab] = useState<'members' | 'resellers'>('members');
   const [searchTerm, setSearchTerm] = useState('');
   const [memberSearchTerm, setMemberSearchTerm] = useState('');
   const [filterType, setFilterType] = useState<'all' | 'favorites'>('all');
   const [selectedCategory, setSelectedCategory] = useState<string>('all');
   const [showFilterDropdown, setShowFilterDropdown] = useState(false);
   const [usersCurrentPage, setUsersCurrentPage] = useState(1);
   const [usersPerPage, setUsersPerPage] = useState(50);
   const [visibleProfilesCount, setVisibleProfilesCount] = useState(20);
   const profilesContainerRef = useRef<HTMLDivElement>(null);
   const [sortOrder, setSortOrder] = useState<'manual' | 'az' | 'za'>('manual');
   const [selectedResellerId, setSelectedResellerId] = useState<string>('all');

   // 🔥 FORÇA RESET PARA 20 AO CARREGAR
   useEffect(() => {
      console.log('🎯 INIT: Forçando visibleProfilesCount = 20');
      const timer = setTimeout(() => {
         setVisibleProfilesCount(20);
      }, 100); // Aguarda 100ms para garantir que sobrescreve qualquer outro valor
      return () => clearTimeout(timer);
   }, []);

   // --- MODALS ---
   const [showProfileModal, setShowProfileModal] = useState(false);
   const [showUserModal, setShowUserModal] = useState(false);
   const [showEditUserModal, setShowEditUserModal] = useState(false);
   const [showImportModal, setShowImportModal] = useState(false);
   const [showAnnouncement, setShowAnnouncement] = useState(false);
   const [showAutomationModal, setShowAutomationModal] = useState(false);
   const [showBulkDateModal, setShowBulkDateModal] = useState(false);

   // --- FORM STATE ---
   const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
   const [editingUser, setEditingUser] = useState<User | null>(null);
   const [importEmails, setImportEmails] = useState('');
   const [isLifetime, setIsLifetime] = useState(false);
   const [bulkDate, setBulkDate] = useState('');
   const [proxyInput, setProxyInput] = useState('');
   const [proxyProtocol, setProxyProtocol] = useState('http');
   const [newBlockedUrl, setNewBlockedUrl] = useState('');
   const [newResellerPassword, setNewResellerPassword] = useState('');
   const [newGlobalCategory, setNewGlobalCategory] = useState('');
   const [modalSelectedCategories, setModalSelectedCategories] = useState<string[]>([]);
   const [newBannerUrl, setNewBannerUrl] = useState('');
   const [newBannerLink, setNewBannerLink] = useState('');

   // --- SESSIONS ---
   const [runningProfiles, setRunningProfiles] = useState<Profile[]>([]);
   const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

   // --- REORDENAÇÃO (DRAG & DROP) ---
   const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
   const reorderTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 👈 ADICIONAR ESTA LINHA
   const onDragStart = (index: number) => setDraggedItemIndex(index);
   const onDragOver = (e: React.DragEvent, index: number) => e.preventDefault();
   const onDrop = async (index: number) => {
      if (draggedItemIndex === null || draggedItemIndex === index) return;

      const newProfiles = [...profiles];
      const [draggedProfile] = newProfiles.splice(draggedItemIndex, 1);
      newProfiles.splice(index, 0, draggedProfile);
      const reordered = newProfiles.map((p, i) => ({ ...p, orderIndex: i }));
      setProfiles(reordered);
      setDraggedItemIndex(null);

      // 🔥 OTIMIZAÇÃO: Debounce de 2 segundos antes de salvar na cloud
      if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current);
      reorderTimeoutRef.current = setTimeout(async () => {
         setIsSaving(true);
         try {
            await DataService.saveProfiles(reordered);
            setToast({ msg: 'Nova ordem salva na Cloud!', type: 'success' });
         } catch (e) {
            setToast({ msg: 'Erro ao sincronizar ordem.', type: 'error' });
         } finally {
            setIsSaving(false);
         }
      }, 2000);
   };

   // OTIMIZAÇÃO DE ELITE: Agora salva apenas o perfil atualizado, não a lista toda.
   const handleSyncProfileSession = useCallback(async (profileId: string, cookies: string, localStorageData: string) => {
      // 1. Atualiza o estado local para feedback visual imediato
      setProfiles(prevProfiles => {
         return prevProfiles.map(p =>
            p.id === profileId ? { ...p, cookies, localStorage: localStorageData } : p
         );
      });
      setRunningProfiles(prev => prev.map(p =>
         p.id === profileId ? { ...p, cookies, localStorage: localStorageData } : p
      ));

      // 2. Persistência atômica no Supabase (Economiza 99% de banda e evita loops)
      await DataService.updateSingleProfile(profileId, {
         cookies,
         localStorage: localStorageData
      });
   }, []);

   // 🔥 NOVA FUNÇÃO: Captura sessão do Chrome nativo e sincroniza via Supabase
   const handleCaptureNativeSession = useCallback(async (profile: Profile) => {
      if (!window.nebulaAPI?.captureSession) {
         setToast({ msg: 'Função disponível apenas no app desktop!', type: 'error' });
         return;
      }

      setToast({ msg: `📸 Capturando sessão de ${profile.name}...`, type: 'info' });

      try {
         const targetUrl = (profile.urls && profile.urls.length > 0) ? profile.urls[0] : 'https://google.com';

         // 1. Captura cookies + localStorage do Chrome nativo (via Puppeteer headless)
         const result = await window.nebulaAPI.captureSession(profile.id, targetUrl);

         if (result.status !== 'success') {
            setToast({ msg: 'Erro ao capturar sessão: ' + (result.message || 'Unknown'), type: 'error' });
            return;
         }

         // 2. Salva sessão no Supabase
         const success = await DataService.updateProfileSessionData(profile.id, result.sessionData);

         if (success) {
            setToast({ msg: `✅ Sessão de ${profile.name} sincronizada com a Cloud!`, type: 'success' });
         } else {
            setToast({ msg: 'Erro ao salvar sessão no Supabase', type: 'error' });
         }
      } catch (err) {
         console.error('Erro ao capturar sessão:', err);
         setToast({ msg: 'Erro ao capturar sessão: ' + (err as Error).message, type: 'error' });
      }
   }, []);

   const [currentAdIndex, setCurrentAdIndex] = useState(0);
   const [toast, setToast] = useState<{ title?: string; msg: string; type: 'success' | 'error' | 'info' } | null>(null);
   const [loginForm, setLoginForm] = useState({ email: '', password: '', remember: false });
   const [showLoginPassword, setShowLoginPassword] = useState(false);
   const [dateTime, setDateTime] = useState(new Date());

   const isDesktop = useMemo(() => !!window.nebulaAPI, []);

   const isAdmin = useMemo(() => {
      const email = currentUser?.email?.toLowerCase().trim();
      return currentUser?.role === Role.ADMIN || email === 'sidneimartins2026@gmail.com' || email === 'admin@sidnei.com';
   }, [currentUser]);

   const currentLogo = useMemo(() => {
      if (isAdmin) return settings?.logoUrl || INITIAL_SETTINGS.logoUrl;
      if (currentUser?.role === Role.RESELLER && currentUser.customLogoUrl) return currentUser.customLogoUrl;
      if (currentUser?.role === Role.MEMBER && currentUser.ownerId) {
         const owner = users.find(u => u.id === currentUser.ownerId);
         if (owner?.role === Role.RESELLER && owner.customLogoUrl) return owner.customLogoUrl;
      }
      return settings?.logoUrl || INITIAL_SETTINGS.logoUrl;
   }, [currentUser, isAdmin, users, settings]);

   const currentSupportLink = useMemo(() => {
      // Admin sempre usa o link global
      if (isAdmin) return settings?.adminSupportLink || ADMIN_SUPPORT_LINK;

      // Revendedor usa seu próprio link se tiver, senão usa o global
      if (currentUser?.role === Role.RESELLER) {
         return currentUser.supportUrl || settings?.adminSupportLink || ADMIN_SUPPORT_LINK;
      }

      // Membro verifica o link do dono (revendedor)
      if (currentUser?.ownerId && currentUser.ownerId !== 'ADMIN') {
         const owner = users.find(u => u.id === currentUser.ownerId);
         if (owner?.role === Role.RESELLER && owner.supportUrl) return owner.supportUrl;
      }

      return settings?.adminSupportLink || ADMIN_SUPPORT_LINK;
   }, [currentUser, isAdmin, users, settings]);

   const stats = useMemo(() => {
      let baseList = users;
      if (!isAdmin && currentUser?.role === Role.RESELLER) baseList = users.filter(u => u.ownerId === currentUser.id);
      const members = baseList.filter(u => u.role === Role.MEMBER);
      const resellers = baseList.filter(u => u.role === Role.RESELLER);
      return {
         totalMembers: members.length,
         totalResellers: resellers.length,
         onlineMembers: baseList.filter(u => u.isLoggedIn).length,
         activeMembers: members.filter(u => !u.blocked).length
      };
   }, [users, isAdmin, currentUser]);

   const filteredProfiles = useMemo(() => {
      let result = profiles;
      if (searchTerm) result = result.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
      if (filterType === 'favorites') result = result.filter(p => currentUser?.favorites?.includes(p.id));
      if (selectedCategory !== 'all') result = result.filter(p => p.categories && p.categories.includes(selectedCategory));

      result = [...result].sort((a, b) => {
         if (sortOrder === 'az') return a.name.localeCompare(b.name);
         if (sortOrder === 'za') return b.name.localeCompare(a.name);
         return (a.orderIndex || 0) - (b.orderIndex || 0);
      });
      return result;
   }, [profiles, searchTerm, filterType, selectedCategory, sortOrder, currentUser]);

   const getVisibleUsers = useCallback(() => {
      if (!currentUser) return [];
      let list: User[] = [];

      if (isAdmin) {
         if (userSubTab === 'resellers') list = (users || []).filter(u => u.role === Role.RESELLER);
         else {
            list = (users || []).filter(u => u.role === Role.MEMBER);
            if (selectedResellerId !== 'all') list = list.filter(u => u.ownerId === selectedResellerId);
         }
      } else if (currentUser.role === Role.RESELLER) {
         list = (users || []).filter(u => u.ownerId === currentUser.id);
      }

      if (memberSearchTerm) list = list.filter(u => u.email.toLowerCase().includes(memberSearchTerm.toLowerCase()));

      return list;
   }, [currentUser, isAdmin, userSubTab, users, memberSearchTerm, selectedResellerId]);

   // 🔥 NOVA FUNÇÃO: getPaginatedUsers
   const getPaginatedUsers = useCallback(() => {
      const allUsers = getVisibleUsers();
      const startIndex = (usersCurrentPage - 1) * usersPerPage;
      const endIndex = startIndex + usersPerPage;
      return allUsers.slice(startIndex, endIndex);
   }, [getVisibleUsers, usersCurrentPage, usersPerPage]);
   // Reset página ao mudar filtros
   useEffect(() => {
      setUsersCurrentPage(1);
   }, [userSubTab, selectedResellerId, memberSearchTerm]);

   // 🔥 LAZY LOADING: Carrega mais profiles ao scrollar (PASSO 2)
   useEffect(() => {
      const handleScroll = () => {
         if (!profilesContainerRef.current) return;

         const container = profilesContainerRef.current;
         const containerRect = container.getBoundingClientRect();
         const isNearBottom = containerRect.bottom <= window.innerHeight + 200;

         if (isNearBottom) {
            setVisibleProfilesCount(prev => {
               const total = filteredProfiles.length;
               if (prev >= total) return prev;
               return Math.min(prev + 20, total);
            });
         }
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
   }, [filteredProfiles.length]);

   // Reset lazy loading ao mudar filtros (PASSO 3)
   useEffect(() => {
      console.log('🔄 Reset por filtro');
      setVisibleProfilesCount(20);
      window.scrollTo(0, 0);
   }, [searchTerm, filterType, selectedCategory, sortOrder]);

   // --- SINCRONIZAÇÃO MELHORADA ---
   const refreshData = useCallback(async () => {
      try {
         const userId = (currentUser?.role === Role.ADMIN || !currentUser) ? undefined : currentUser?.id;

         // 🔥 TENTAR BUSCAR DO DATASERVICE PRIMEIRO
         const data = await DataService.initializeData(userId);

         if (data) {
            // Se retornou users, usa eles
            if (data.users && data.users.length > 0) {
               setUsers(data.users);
            } else {
               // 🔥 FALLBACK: Se não tem users, busca direto do Supabase
               console.warn('⚠️ DataService retornou vazio, buscando do Supabase...');
               try {
                  const { data: cloudUsers, error } = await supabase
                     .from('users')
                     .select('*')
                     .order('createdAt', { ascending: false });

                  if (!error && cloudUsers && cloudUsers.length > 0) {
                     setUsers(cloudUsers);
                     localStorage.setItem('nebula_users_v1', Security.encrypt(cloudUsers));
                     console.log(`✅ ${cloudUsers.length} usuários restaurados do Supabase`);
                  }
               } catch (e) {
                  console.error('❌ Erro ao buscar do Supabase:', e);
               }
            }

            if (data.profiles && data.profiles.length > 0) setProfiles(data.profiles);

            const finalSettings = data.settings || INITIAL_SETTINGS;
            setSettings(finalSettings);
            setLocalSettings(finalSettings);

            setIsOfflineMode(data.isOffline);
            setVpsStatus({ connected: !data.isOffline, latency: 0 });
         }
      } catch (err) {
         console.error("Falha ao atualizar dados:", err);
         setIsOfflineMode(true);
         setVpsStatus({ connected: false, latency: 0 });
      }
   }, [currentUser]);

   const fetchRadarLogs = useCallback(async () => {
      if (!currentUser || (currentUser.role !== Role.ADMIN && currentUser.role !== Role.RESELLER)) return;
      try {
         const { data, error } = await supabase
            .from('logs')
            .select('*')
            .order('time', { ascending: false })
            .limit(50);
         if (!error && data) setWebhookLogs(data);
      } catch (e) { console.error("Erro ao buscar radar", e); }
   }, [currentUser]);

   // TEMPORÁRIO: Comentar para testar
   /*
       // 🔥 REALTIME OTIMIZADO: Canal único com atualizações granulares
       useEffect(() => {
             if (!currentUser || (currentUser.role !== Role.ADMIN && currentUser.role !== Role.RESELLER)) return;
          	
             // Canal único por usuário para evitar múltiplas conexões
             const channel = supabase.channel(`user-${currentUser.id}-realtime`)
                   .on('postgres_changes', { 
                         event: 'INSERT', 
                         schema: 'public', 
                         table: 'logs' 
                   }, (payload) => {
                               setWebhookLogs((prev) => [payload.new, ...prev].slice(0, 50));
                               setToast({ msg: `Radar: Sinal de ${payload.new.email}`, type: 'info' });
                               // Refresh apenas se for evento crítico de ativação
                               if (payload.new && payload.new.status && payload.new.status.includes('✅')) {
                                        refreshData();
                               }
                   })
                   .on('postgres_changes', { 
                         event: 'UPDATE', 
                         schema: 'public', 
                         table: 'users'
                   }, (payload) => {
                               // 🔥 OTIMIZAÇÃO: Atualiza apenas o user específico no estado
                               setUsers(prev => prev.map(u => u.id === payload.new.id ? { ...u, ...payload.new } : u));
                   })
                   .on('postgres_changes', { 
                         event: 'INSERT', 
                         schema: 'public', 
                         table: 'users' 
                   }, () => {
                         // 🔥 OTIMIZAÇÃO: Apenas admins precisam refetch completo
                         if (currentUser.role === Role.ADMIN) refreshData();
                   })
                   .on('postgres_changes', { 
                         event: 'DELETE', 
                         schema: 'public', 
                         table: 'users' 
                   }, (payload) => {
                         // 🔥 OTIMIZAÇÃO: Remove do estado local sem refetch
                         setUsers(prev => prev.filter(u => u.id !== payload.old.id));
                   })
                   .subscribe();
          	
             return () => { 
                   supabase.removeChannel(channel); 
             };
       }, [currentUser, refreshData]);  
    	
       */

   // INICIALIZAÇÃO MELHORADA
   useEffect(() => {
      const init = async () => {
         setIsAppLoading(true);
         try {
            await refreshData();
            const saved = DataService.getRememberMe();
            if (saved && !currentUser) setLoginForm({ email: saved.email, password: saved.password, remember: true });

            const pResult = await DataService.ping();
            setVpsStatus({ connected: pResult.success, latency: pResult.latency });

            if (currentUser && (currentUser.role === Role.ADMIN || currentUser.role === Role.RESELLER)) {
               await fetchRadarLogs();
            }
         } catch (err) {
            console.error("Erro de inicialização:", err);
         } finally {
            setIsAppLoading(false);
         }
      };
      init();
   }, [currentUser, refreshData]);

   // PERSISTÊNCIA DE SESSÃO NO LOCALSTORAGE (Evita deslogue ao salvar código)
   useEffect(() => {
      if (currentUser) {
         localStorage.setItem('sidnei_session_v2', Security.encrypt(currentUser));
      } else {
         localStorage.removeItem('sidnei_session_v2');
      }
   }, [currentUser]);

   useEffect(() => {
      const bannerCount = settings?.adBanners?.length || 0;
      if (bannerCount === 0) return;
      const timer = setInterval(() => setCurrentAdIndex(i => (i + 1) % bannerCount), (settings?.adBannerInterval || 5) * 1000);
      return () => clearInterval(timer);
   }, [settings?.adBanners, settings?.adBannerInterval]);

   useEffect(() => {
      const timer = setInterval(() => setDateTime(new Date()), 1000);
      return () => clearInterval(timer);
   }, []);

   // LOGIN CORRIGIDO PARA USAR UPDATE SINGLE USER (ECONOMIA DE CPU)
   const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      const emailInput = loginForm.email.toLowerCase().trim();
      const passInput = loginForm.password.trim();

      if (emailInput === 'sidneimartins2026@gmail.com' && passInput === '*248351Sid') {
         const master = { id: 'master', email: emailInput, role: Role.ADMIN, createdAt: Date.now(), blocked: false, isLoggedIn: true };
         setCurrentUser(master as any); setIsSaving(false); return;
      }

      // 🔥 OTIMIZAÇÃO CRÍTICA: Busca apenas 1 usuário específico
      const { data: user } = await supabase.from('users').select('*').eq('email', emailInput).single();

      if (user) {
         if (user.blocked) { setToast({ msg: 'Acesso suspenso.', type: 'error' }); setIsSaving(false); return; }
         if (user.role !== Role.ADMIN && user.isLoggedIn && user.currentMachineId && user.currentMachineId !== machineId) { setToast({ msg: 'Sessão ativa em outro computador.', type: 'error' }); setIsSaving(false); return; }

         const { data: sRes } = await supabase.from('settings').select('config').single();
         const freshSettings = sRes?.config || INITIAL_SETTINGS;
         const isPasswordCorrect = user.role === Role.MEMBER ? (passInput === freshSettings?.defaultMemberPassword) : (passInput === user.password);

         if (isPasswordCorrect) {
            if (loginForm.remember) DataService.saveRememberMe(loginForm.email, loginForm.password); else DataService.clearRememberMe();
            const updated = { ...user, isLoggedIn: true, currentMachineId: machineId };

            await DataService.updateSingleUser(updated);
            setCurrentUser(updated);

            setToast({ msg: `Sessão Liberada!`, type: 'success' }); if (settings?.popup?.enabled) setTimeout(() => setShowAnnouncement(true), 1000);
         } else {
            setToast({ msg: 'Senha incorreta.', type: 'error' });
         }
      } else {
         setToast({ msg: 'E-mail não encontrado.', type: 'error' });
      }
      setIsSaving(false);
   };

   const handleLogout = async () => {
      if (currentUser) {
         const updated = { ...currentUser, isLoggedIn: false, currentMachineId: undefined };
         await DataService.updateSingleUser(updated);
         setUsers(users.map(u => u.id === currentUser.id ? updated : u));
      }
      setCurrentUser(null); setRunningProfiles([]); setActiveProfileId(null);
   };

   const handleLaunchProfile = async (profile: Profile) => {
      if (isDesktop && window.nebulaAPI && profile.launchMode === 'external') {
         // 🔄 INICIA STATUS DE CARREGAMENTO
         setLaunchingStatus({ isLaunching: true, message: 'Preparando navegador...', profileName: profile.name });

         // Usa modo NATIVO (com DRM) se useNativeBrowser estiver habilitado
         // Caso contrário, usa Puppeteer (com auto-fill mas sem DRM)
         let res;
         if (profile.useNativeBrowser && window.nebulaAPI.launchProfileNative) {
            // 🔥 CLOUD SYNC: Verifica se existe sessão na Cloud e injeta antes de abrir
            try {
               setLaunchingStatus({ isLaunching: true, message: '☁️ Verificando sessão na Cloud...', profileName: profile.name });
               const cloudSession = await DataService.getProfileSessionData(profile.id);
               if (cloudSession && window.nebulaAPI.injectSession) {
                  console.log(`☁️ [CLOUD SYNC] Sessão encontrada na Cloud para ${profile.name}, injetando...`);
                  setLaunchingStatus({ isLaunching: true, message: '☁️ Sincronizando sessão...', profileName: profile.name });

                  const targetUrl = (profile.urls && profile.urls.length > 0) ? profile.urls[0] : 'https://google.com';
                  const injectResult = await window.nebulaAPI.injectSession(profile.id, cloudSession, targetUrl);

                  if (injectResult.status === 'success') {
                     console.log(`✅ [CLOUD SYNC] Sessão injetada com sucesso!`);
                  } else {
                     console.warn(`⚠️ [CLOUD SYNC] Falha ao injetar sessão:`, injectResult.message);
                  }
               }
            } catch (syncErr) {
               console.error(`❌ [CLOUD SYNC] Erro ao sincronizar sessão:`, syncErr);
               // Continua mesmo se falhar - não bloqueia a abertura
            }

            // Atualiza status para login automático (se aplicável)
            if (profile.email && profile.password) {
               setLaunchingStatus({ isLaunching: true, message: '🔐 Realizando login automático...', profileName: profile.name });
            } else {
               setLaunchingStatus({ isLaunching: true, message: '🚀 Abrindo navegador...', profileName: profile.name });
            }

            res = await window.nebulaAPI.launchProfileNative(profile, settings?.customBrowserPath);
         } else {
            setLaunchingStatus({ isLaunching: true, message: '🚀 Abrindo navegador...', profileName: profile.name });
            res = await window.nebulaAPI.launchProfile(profile, settings?.customBrowserPath);
         }

         // 🔄 FINALIZA STATUS DE CARREGAMENTO
         setLaunchingStatus({ isLaunching: false, message: '' });

         if (res.status === 'success') setToast({ msg: `${profile.name} aberto com sucesso!`, type: 'success' });
         else setToast({ msg: 'Erro: ' + res.message, type: 'error' });
         return;
      }
      if (!runningProfiles.find(p => p.id === profile.id)) setRunningProfiles(prev => [...prev, profile]);
      setActiveProfileId(profile.id);
   };

   const handleSaveNewUser = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsSaving(true);
      try {
         const fd = new FormData(e.currentTarget);
         const emailRaw = fd.get('email');
         const passRaw = fd.get('password');
         const roleRaw = fd.get('role');
         const expRaw = fd.get('exp');

         if (!emailRaw) throw new Error("O e-mail é obrigatório.");
         if (!isLifetime && !expRaw) throw new Error("Selecione vencimento ou Vitalício.");

         const finalExp = isLifetime ? null : (expRaw ? new Date(String(expRaw) + 'T23:59:59').getTime() : null);

         const newUser: User = {
            id: `u_${Date.now()}`,
            email: String(emailRaw).toLowerCase().trim(),
            password: passRaw ? String(passRaw).trim() : (settings?.defaultMemberPassword || 'membro123'),
            role: (roleRaw as Role) || Role.MEMBER,
            ownerId: currentUser?.id || 'ADMIN',
            createdAt: Date.now(),
            blocked: false,
            isLoggedIn: false,
            expirationDate: finalExp === null ? undefined : finalExp
         };

         const next = [...users, newUser];
         setUsers(next);

         // 🔥 Salva apenas o novo user (instantâneo!)
         await DataService.updateSingleUser(newUser);
         localStorage.setItem('nebula_users_v1', Security.encrypt(next));
         setShowUserModal(false);
         setIsLifetime(false);
         setToast({ msg: 'Membro criado!', type: 'success' });
      } catch (err) {
         setToast({ msg: 'Erro: ' + (err as Error).message, type: 'error' });
      } finally {
         setIsSaving(false);
      }
   };

   const handleApplyBulkDate = async () => {
      if (!bulkDate) {
         setToast({ msg: 'Selecione uma data!', type: 'error' });
         return;
      }
      setIsSaving(true);
      try {
         const timestamp = new Date(bulkDate + 'T23:59:59').getTime();
         const updatedUsers = users.map(u =>
            u.role === Role.MEMBER ? { ...u, expirationDate: timestamp } : u
         );
         setUsers(updatedUsers);
         await DataService.saveUsers(updatedUsers);
         setToast({ msg: 'Validade atualizada!', type: 'success' });
         setShowBulkDateModal(false);
      } catch (e) {
         setToast({ msg: 'Erro ao processar.', type: 'error' });
      } finally {
         setIsSaving(false);
      }
   };

   const handleDeleteAllMembers = async () => {
      if (window.confirm("⚠️ APAGAR TODOS OS MEMBROS?")) {
         setIsSaving(true);
         try {
            const success = await DataService.deleteAllMembers();
            if (success) {
               setUsers(prev => prev.filter(u => u.role !== Role.MEMBER));
               setToast({ msg: 'Todos removidos!', type: 'success' });
            }
         } finally {
            setIsSaving(false);
         }
      }
   };

   const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsSaving(true);
      try {
         const fd = new FormData(e.currentTarget);
         const newId = editingProfile?.id || `p_${Date.now()}`;

         const defaultFingerprintObj: FingerprintConfig = {
            maskFingerprint: true, spoofUserAgent: true, isolateCookies: true, spoofTimezone: true,
            spoofLanguage: true, webrtcProtection: true, hardwareFingerprint: true, isolateProfile: true
         };

         // 🔥 PARSE PROXY: Converte IP:PORT:USER:PASS para formato URL correto
         let formattedProxy = '';
         if (proxyInput) {
            const parts = proxyInput.split(':');
            if (parts.length === 4) {
               // Formato: IP:PORT:USER:PASS -> protocol://USER:PASS@IP:PORT
               const [ip, port, user, pass] = parts;
               formattedProxy = `${proxyProtocol}://${user}:${pass}@${ip}:${port}`;
            } else if (parts.length === 2) {
               // Formato simples: IP:PORT -> protocol://IP:PORT
               formattedProxy = `${proxyProtocol}://${proxyInput}`;
            } else {
               // Formato já completo ou outro
               formattedProxy = proxyInput.includes('://') ? proxyInput : `${proxyProtocol}://${proxyInput}`;
            }
         }

         const newP: Profile = {
            id: newId, name: String(fd.get('name') || 'Serviço'),
            status: fd.get('status') as 'active' | 'maintenance' || 'active',
            urls: (fd.get('urls') as string || '').split('\n').filter(Boolean),
            launchMode: fd.get('launchMode') as 'internal' | 'external' || 'internal',
            useNativeBrowser: fd.get('useNativeBrowser') === 'on', // Habilita DRM (HBO Max, Netflix)
            coverImage: String(fd.get('coverImage') || ''),
            loginType: editingProfile?.loginType || 'cookies', email: String(fd.get('email') || ''),
            password: String(fd.get('password') || ''), cookies: String(fd.get('cookies') || ''),
            automationScript: String(fd.get('automationScript') || ''), customCSS: String(fd.get('customCSS') || ''),
            discordToken: String(fd.get('discordToken') || ''), videoTutorial: String(fd.get('videoTutorial') || ''),
            categories: modalSelectedCategories, proxy: formattedProxy,
            isFavorite: editingProfile?.isFavorite || false, createdAt: Date.now(),
            orderIndex: parseInt(String(fd.get('orderIndex') || '0')),
            fingerprint: editingProfile?.fingerprint || defaultFingerprintObj
         };
         const next = editingProfile ? profiles.map(p => p.id === newP.id ? newP : p) : [...profiles, newP];
         setProfiles(next);
         await DataService.saveProfiles(next);
         setShowProfileModal(false);
         setToast({ msg: 'Perfil salvo!', type: 'success' });
      } catch (err) {
         setToast({ msg: 'Erro ao salvar.', type: 'error' });
      } finally {
         setIsSaving(false);
      }
   };

   const handleGlobalSave = async () => {
      if (!localSettings || !settings) return;
      setIsSaving(true);
      try {
         await DataService.saveSettings(localSettings);
         setSettings(localSettings);
         setToast({ msg: 'SISTEMA ATUALIZADO!', type: 'success' });
      } catch (e) {
         setToast({ msg: 'Falha ao salvar.', type: 'error' });
      } finally {
         setIsSaving(false);
      }
   };

   const handleDeleteProfile = async (id: string) => {
      if (window.confirm("Excluir este serviço permanentemente?")) {
         const success = await DataService.deleteProfile(id);
         if (success) {
            setProfiles(profiles.filter(p => p.id !== id));
            setToast({ msg: 'Removido da Cloud!', type: 'success' });
         }
      }
   };

   const handleManualSync = async () => {
      setToast({ msg: '🔄 Buscando dados atualizados do servidor...', type: 'info' });

      // 🔥 CRITICAL: Invalidar cache ANTES de buscar, para forçar ida ao Supabase
      DataService.invalidateCache();

      await refreshData();
      if (currentUser?.role === Role.ADMIN || currentUser?.role === Role.RESELLER) await fetchRadarLogs();
      setToast({ msg: '✅ Dados sincronizados do servidor!', type: 'success' });
   };

   const handlePushCacheToCloud = async () => {
      if (!window.confirm("⚠️ SUBIR CACHE LOCAL PARA O SERVIDOR?")) return;

      setIsSaving(true);
      try {
         await DataService.saveProfiles(profiles);
         await DataService.saveUsers(users);
         if (settings) await DataService.saveSettings(settings);
         setToast({ msg: 'CACHE SINCRONIZADO!', type: 'success' });
      } catch (e) {
         setToast({ msg: 'Erro ao subir dados.', type: 'error' });
      } finally {
         setIsSaving(false);
      }
   };

   const handleSaveResellerBrand = async () => {
      if (!currentUser || currentUser.role !== Role.RESELLER) return;
      setIsSaving(true);
      try {
         // 🔥 DEBUG: Log do que está sendo salvo
         console.log('💾 Salvando marca do revendedor:', {
            id: currentUser.id,
            customLogoUrl: currentUser.customLogoUrl,
            supportUrl: currentUser.supportUrl,
            newPassword: newResellerPassword ? '(definida)' : '(mantendo atual)'
         });

         const updated = {
            ...currentUser,
            customLogoUrl: currentUser.customLogoUrl,
            supportUrl: currentUser.supportUrl,
            password: newResellerPassword || currentUser.password
         };

         const updatedUsers = users.map(u => u.id === currentUser.id ? updated : u);
         setUsers(updatedUsers);
         setCurrentUser(updated);

         const success = await DataService.updateSingleUser(updated);

         if (success) {
            console.log('✅ Marca salva com sucesso!');
            setToast({ msg: 'Marca atualizada com sucesso!', type: 'success' });
         } else {
            console.warn('⚠️ Salvo apenas localmente (rate limit ou erro)');
            setToast({ msg: 'Salvo localmente! Sincronizando...', type: 'info' });
         }

         setNewResellerPassword('');
      } catch (e) {
         console.error('❌ Erro ao salvar marca:', e);
         setToast({ msg: 'Erro ao salvar: ' + (e as Error).message, type: 'error' });
      } finally {
         setIsSaving(false);
      }
   };

   const simulateHotmartEvent = async (status: string) => {
      if (!isAdmin) return;
      try {
         await supabase.from('logs').insert({
            email: `teste_${Math.floor(Math.random() * 100)}@simulado.com`,
            event: 'SIMULAÇÃO_CLOUD',
            status: status,
            time: new Date().toISOString()
         });
         setToast({ msg: `Sinal simulado!`, type: 'success' });
      } catch (e) { setToast({ msg: 'Erro na simulação.', type: 'error' }); }
   };

   const toggleModalCategory = (cat: string) => setModalSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);

   if (isAppLoading && !profiles.length) return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center flex-col gap-6">
         <RefreshCw className="w-12 h-12 text-purple-600 animate-spin" />
         <p className="text-purple-400 font-black uppercase tracking-widest text-xs">Sincronizando com Supabase Cloud...</p>
         <Button variant="secondary" onClick={() => window.location.reload()} className="mt-4">Recarregar App</Button>
      </div>
   );

   if (!currentUser) {
      return (
         <div className="min-h-screen flex items-center justify-center bg-[#050505] relative overflow-hidden">
            <ParticleBackground effect={settings?.seasonalEffect} />
            <div className="relative z-10 w-full max-w-md p-10 bg-black/80 border border-purple-500/20 rounded-3xl shadow-2xl backdrop-blur-xl animate-fade-in-up">
               <div className="flex flex-col items-center mb-8">
                  <img src={settings?.logoUrl} className="h-12 mb-4" alt="Logo" />
                  <h2 className="text-gray-400 text-sm tracking-[0.3em] uppercase font-black">FERRAMENTAS ILIMITADAS</h2>
               </div>
               <form onSubmit={handleLogin} className="space-y-6">
                  <Input type="email" placeholder="E-mail" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} className="bg-white/5 border-white/10" />
                  <div className="relative">
                     <Input type={showLoginPassword ? "text" : "password"} placeholder="Sua Senha" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} className="bg-white/5 border-white/10 pr-12" />
                     <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors">
                        {showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                     </button>
                  </div>
                  <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setLoginForm({ ...loginForm, remember: !loginForm.remember })}>
                     {loginForm.remember ? <CheckSquare className="text-purple-500 w-5 h-5" /> : <Square className="text-gray-600 w-5 h-5" />}
                     <span className="text-sm text-gray-400">Lembrar meus dados</span>
                  </div>
                  <Button className="w-full py-4 text-lg font-bold" type="submit" disabled={isSaving}>ENTRAR NO PAINEL</Button>
                  <p className="text-[10px] text-gray-500 text-center mt-4 uppercase font-bold tracking-widest">
                     💖 Desenvolvido por Sidnei Martins - ✆11 94165-7747
                  </p>
               </form>
            </div>
            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
         </div>
      );
   }

   return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans overflow-y-auto custom-scrollbar relative">
         <ParticleBackground effect={settings?.seasonalEffect} />

         <header className="sticky top-0 z-[100] bg-black/90 backdrop-blur-3xl border-b border-white/5" style={{ height: `${settings?.headerHeight || 280}px` }}>
            <div className="w-full h-full flex flex-col px-12 py-8">
               <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-2">
                     <img src={currentLogo} style={{ height: `${(settings?.logoSize || 100) * 0.45}px` }} className="object-contain" />
                     <div className={`text-[9px] font-black uppercase flex items-center gap-2 ${vpsStatus.connected ? 'text-green-500' : 'text-red-500'}`}>
                        <div className={`w-2 h-2 rounded-full ${vpsStatus.connected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 animate-pulse'}`}></div>
                        {vpsStatus.connected ? 'SUPABASE CLOUD ON' : 'OFFLINE MODE'}
                     </div>
                  </div>

                  <div className="flex-1 flex justify-center px-16">
                     {(settings?.adBanners || []).length > 0 && (
                        <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl group" style={{ maxWidth: `${800 * (settings?.adBannerScale || 1)}px`, aspectRatio: '16/3' }}>
                           <a href={settings?.adBannerLinks?.[currentAdIndex % (settings?.adBanners?.length || 1)] || '#'} target="_blank" rel="noreferrer">
                              <img src={settings?.adBanners?.[currentAdIndex % (settings?.adBanners?.length || 1)]} className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-105" />
                           </a>
                           <div className="absolute bottom-2 right-4 flex gap-1">
                              {(settings?.adBanners || []).map((_, idx) => (
                                 <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentAdIndex % settings.adBanners.length ? 'bg-purple-500 w-4' : 'bg-white/20'}`}></div>
                              ))}
                           </div>
                        </div>
                     )}
                  </div>

                  <div className="flex items-center gap-8">
                     <div className="flex flex-col items-end border-r border-white/10 pr-8">
                        <span className="text-3xl font-black text-white">{dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">{dateTime.toLocaleDateString()}</span>
                     </div>
                     <div className="flex items-center gap-4 bg-white/5 px-6 py-2.5 rounded-2xl border border-white/10">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-black">{currentUser?.email?.[0].toUpperCase()}</div>
                        <div className="flex flex-col"><span className="font-bold text-xs truncate max-w-[120px]">{currentUser?.email}</span><span className="text-purple-400 text-[10px] font-black uppercase">{currentUser?.role}</span></div>
                     </div>
                     <button onClick={handleLogout} className="p-4 bg-red-900/20 text-red-400 rounded-xl border border-red-500/20 hover:bg-red-600 hover:text-white transition-all"><LogOut size={20} /></button>
                  </div>
               </div>

               <div className="flex justify-center gap-16 mt-auto">
                  <button onClick={() => setActiveTab('profiles')} className={`pb-5 px-6 flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em] border-b-4 transition-all ${activeTab === 'profiles' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}><Monitor size={18} /> Ferramentas</button>
                  {(isAdmin || currentUser?.role === Role.RESELLER) && (<button onClick={() => setActiveTab('users')} className={`pb-5 px-6 flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em] border-b-4 transition-all ${activeTab === 'users' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}><Users size={18} /> Membros</button>)}
                  {(isAdmin || currentUser?.role === Role.RESELLER) && (<button onClick={() => setActiveTab('settings')} className={`pb-5 px-6 flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em] border-b-4 transition-all ${activeTab === 'settings' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}><Settings size={18} /> Sistema</button>)}
               </div>
            </div>
         </header>

         <main className="flex-1 p-12 relative z-10 pb-48">
            {(activeTab === 'users' || activeTab === 'profiles') && (
               <div className="max-w-[1920px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                  {[
                     { label: 'Membros Cadastrados', val: stats.totalMembers, color: 'text-white', icon: Users },
                     { label: 'Contas Ativas', val: stats.activeMembers, color: 'text-green-500', icon: CheckSquare },
                     { label: 'Usuários Online', val: stats.onlineMembers, color: 'text-purple-500', icon: Zap, online: true },
                     { label: isAdmin ? 'Revendedores Ativos' : 'HWID Painel', val: isAdmin ? stats.totalResellers : machineId.substring(0, 10), color: 'text-blue-500', icon: Shield }
                  ].map((s, idx) => (
                     <div key={idx} className="bg-black/40 border border-white/5 rounded-3xl p-6 flex items-center gap-6 backdrop-blur-xl group hover:border-purple-500/20 transition-all">
                        <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center ${s.color}`}> <s.icon size={24} /> </div>
                        <div className="flex flex-col relative">
                           <span className="text-[10px] font-black uppercase text-gray-500">{s.label}</span>
                           <div className="flex items-center gap-2">
                              <span className={`text-2xl font-black ${s.color}`}>{s.val}</span>
                              {s.online && (
                                 <div className="flex items-center gap-1.5 ml-2 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 shadow-[0_0_8px_#22c55e]">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></div>
                                    <span className="text-[8px] font-black text-green-500 uppercase tracking-tighter">Online</span>
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            )}

            {activeTab === 'profiles' && (
               <div className="max-w-[1920px] mx-auto space-y-12 animate-fade-in">
                  <div className="flex justify-between items-center bg-black/80 backdrop-blur-xl p-6 rounded-3xl border border-white/5 gap-6 shadow-2xl relative z-[150]">
                     <div className="flex items-center gap-6">
                        <div className="relative w-96"> <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} /> <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Pesquisar..." className="w-full bg-[#111] border border-gray-800 rounded-2xl py-3 pl-12 text-sm outline-none focus:border-purple-500" /> </div>
                        <div className="relative z-[50]">
                           <button onClick={() => setShowFilterDropdown(!showFilterDropdown)} className="flex items-center gap-3 px-6 py-2.5 bg-blue-600/10 border border-blue-500/30 rounded-2xl text-blue-400 hover:bg-blue-600 hover:text-white transition-all shadow-lg">
                              <Filter size={18} /> <span className="text-[10px] font-black uppercase">{selectedCategory === 'all' ? 'Categorias' : selectedCategory}</span>
                              <ChevronDown size={14} className={showFilterDropdown ? 'rotate-180' : ''} />
                           </button>
                           {showFilterDropdown && (
                              <div className="absolute top-full mt-3 left-0 w-64 bg-[#141414] border border-gray-800 rounded-2xl py-4 z-[1000] shadow-2xl animate-fade-in">
                                 <button onClick={() => { setSelectedCategory('all'); setShowFilterDropdown(false); }} className={`w-full text-left px-7 py-3 text-[10px] font-black uppercase ${selectedCategory === 'all' ? 'text-purple-400' : 'text-gray-400 hover:text-white'}`}>Tudo</button>
                                 {(settings?.categories || []).map(cat => (
                                    <button key={cat} onClick={() => { setSelectedCategory(cat); setShowFilterDropdown(false); }} className={`w-full text-left px-7 py-3 text-[10px] font-black uppercase ${selectedCategory === cat ? 'text-purple-400' : 'text-gray-400 hover:text-white'}`}>{cat}</button>
                                 ))}
                              </div>
                           )}
                        </div>
                        <button onClick={() => setFilterType(filterType === 'favorites' ? 'all' : 'favorites')} className={`flex items-center gap-3 px-6 py-2.5 rounded-2xl border transition-all ${filterType === 'favorites' ? 'bg-red-600 border-red-400 text-white' : 'bg-red-600/10 border-red-500/30 text-red-400'}`}> <Star size={18} className={filterType === 'favorites' ? 'fill-white' : ''} /> <span className="text-[10px] font-black uppercase">Favoritos</span> </button>
                        <a href={settings?.tutorialLink || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-6 py-2.5 bg-orange-600/10 border border-orange-500/30 rounded-2xl text-orange-400 hover:bg-orange-600 hover:text-white transition-all"> <PlayCircle size={18} /> <span className="text-[10px] font-black uppercase">Tutorial</span> </a>
                        <a href={currentSupportLink} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-6 py-2.5 bg-green-600/10 border border-green-500/30 rounded-2xl text-green-400 hover:bg-green-600 hover:text-white transition-all"> <HelpCircle size={18} /> <span className="text-[10px] font-black uppercase">Suporte</span> </a>
                     </div>
                     <div className="flex items-center gap-4">
                        {/* 🔄 BOTÃO SINCRONIZAR - VISÍVEL PARA TODOS */}
                        <button onClick={handleManualSync} title="Sincronizar dados da Cloud" className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600/10 border border-cyan-500/30 rounded-xl text-cyan-400 hover:bg-cyan-600 hover:text-white transition-all text-[9px] font-black uppercase"><RefreshCw size={14} /> Sincronizar</button>
                        {isAdmin && (
                           <div className="flex gap-2 mr-4 border-r border-white/10 pr-4">
                              <button onClick={handleManualSync} title="Puxar dados da Cloud" className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 border border-blue-500/30 rounded-xl text-blue-400 hover:bg-blue-600 hover:text-white transition-all text-[9px] font-black uppercase"><DownloadCloud size={14} /> Puxar Cloud</button>
                              <button onClick={handlePushCacheToCloud} title="Subir dados locais para a Cloud" className="flex items-center gap-2 px-4 py-2 bg-purple-600/10 border border-purple-500/30 rounded-xl text-purple-400 hover:bg-purple-600 hover:text-white transition-all text-[9px] font-black uppercase"><UploadCloud size={14} /> Subir Cloud</button>
                           </div>
                        )}
                        {isAdmin && (<Button onClick={() => { setEditingProfile(null); setModalSelectedCategories([]); setShowProfileModal(true); }} className="!py-3.5 !px-8"> <Plus size={18} /> Novo Perfil </Button>)}
                     </div>
                  </div>
                  <div
                     ref={profilesContainerRef}
                     className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10"
                  >
                     {filteredProfiles.slice(0, visibleProfilesCount).map((p, idx) => (
                        <ProfileCard
                           key={p.id}
                           profile={{ ...p, isFavorite: currentUser?.favorites?.includes(p.id) || false }}
                           onOpen={handleLaunchProfile}
                           onEdit={isAdmin ? (prof => { setEditingProfile(prof); setModalSelectedCategories(prof.categories || []); setShowProfileModal(true); }) : undefined}
                           onDelete={isAdmin ? (prof => handleDeleteProfile(prof.id)) : undefined}
                           onSyncSession={isAdmin ? handleCaptureNativeSession : undefined}
                           onToggleFavorite={prof => { const favs = currentUser?.favorites?.includes(prof.id) ? currentUser.favorites.filter(id => id !== prof.id) : [...(currentUser?.favorites || []), prof.id]; const up = { ...currentUser!, favorites: favs }; setCurrentUser(up); DataService.updateSingleUser(up); }}
                           draggable={isAdmin}
                           onDragStart={() => onDragStart(idx)}
                           onDragOver={(e) => onDragOver(e, idx)}
                           onDrop={() => onDrop(idx)}
                           isDragging={draggedItemIndex === idx}
                        />
                     ))}
                  </div>

                  {/* LAZY LOADING: Indicador e botão */}
                  {visibleProfilesCount < filteredProfiles.length && (
                     <div className="flex flex-col items-center gap-6 mt-12">
                        <div className="flex items-center gap-3 text-gray-500">
                           <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                           <span className="text-sm font-bold uppercase tracking-wider">
                              Mostrando {visibleProfilesCount} de {filteredProfiles.length} ferramentas
                           </span>
                           {/* 🔥 DEBUG TEMPORÁRIO */}
                           <div className="mt-4 p-4 bg-yellow-900/50 border border-yellow-500 rounded text-yellow-200 text-xs">
                              <div>visibleProfilesCount: {visibleProfilesCount}</div>
                              <div>filteredProfiles.length: {filteredProfiles.length}</div>
                              <div>Condição (deve ser true): {String(visibleProfilesCount < filteredProfiles.length)}</div>
                           </div>
                        </div>
                        <button
                           onClick={() => setVisibleProfilesCount(prev => Math.min(prev + 20, filteredProfiles.length))}
                           className="flex items-center gap-3 px-8 py-4 bg-purple-600/10 border border-purple-500/30 rounded-2xl text-purple-400 hover:bg-purple-600 hover:text-white transition-all shadow-lg hover:shadow-purple-500/20"
                        >
                           <Plus size={18} />
                           <span className="font-black uppercase tracking-wider text-sm">Carregar Mais 20</span>
                        </button>
                     </div>
                  )}
               </div>
            )}

            {activeTab === 'users' && (
               <div className="max-w-7xl mx-auto space-y-10 animate-fade-in">
                  <div className="flex justify-between items-end gap-6">
                     <div className="flex flex-col gap-6">
                        <div className="flex gap-8">
                           <button onClick={() => setUserSubTab('members')} className={`text-3xl font-black uppercase transition-all ${userSubTab === 'members' ? 'text-white border-b-4 border-purple-500 pb-2' : 'text-gray-700 hover:text-gray-500'}`}>Membros</button>
                           {isAdmin && <button onClick={() => setUserSubTab('resellers')} className={`text-3xl font-black uppercase transition-all ${userSubTab === 'resellers' ? 'text-white border-b-4 border-purple-500 pb-2' : 'text-gray-700 hover:text-gray-500'}`}>Revendedores</button>}
                        </div>
                        <div className="flex gap-4">
                           {isAdmin && userSubTab === 'members' && (
                              <select
                                 value={selectedResellerId}
                                 onChange={e => setSelectedResellerId(e.target.value)}
                                 className="bg-[#111] border border-gray-800 rounded-2xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:border-purple-500 text-gray-400"
                              >
                                 <option value="all">TODOS OS REVENDEDORES</option>
                                 <option value="ADMIN">ADMIN (DIRETOS)</option>
                                 {users.filter(u => u.role === Role.RESELLER).map(res => (
                                    <option key={res.id} value={res.id}>FILTRAR: {res.email}</option>
                                 ))}
                              </select>
                           )}
                           <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} /><input value={memberSearchTerm} onChange={e => setMemberSearchTerm(e.target.value)} placeholder="Pesquisar..." className="w-96 bg-[#111] border border-gray-800 rounded-2xl py-3 pl-12 text-sm outline-none focus:border-purple-500" /></div>
                        </div>
                     </div>
                     <div className="flex gap-3">
                        {(isAdmin || currentUser?.role === Role.RESELLER) && (
                           <div className="flex gap-2">
                              <Button onClick={() => setShowBulkDateModal(true)} variant="secondary" className="!bg-purple-600/10 !border-purple-500/20 !text-purple-400 hover:!bg-purple-600 hover:!text-white">
                                 <Calendar size={18} /> Alterar Vencimento Geral
                              </Button>
                              <Button onClick={handleDeleteAllMembers} variant="danger" className="!bg-red-600/10 !border-red-500/20 !text-red-400 hover:!bg-red-600 hover:!text-white">
                                 <Trash2 size={18} /> Limpar Todos Membros
                              </Button>
                              <Button onClick={() => setShowImportModal(true)} variant="secondary" className="!bg-orange-600/10 !border-orange-500/20 !text-orange-500 hover:!bg-orange-600 hover:!text-white">
                                 <FileUp size={18} /> Importar Massa
                              </Button>
                           </div>
                        )}
                        <Button onClick={() => { setEditingUser(null); setIsLifetime(false); setShowUserModal(true); }} className="!py-3.5 !px-8"><Plus size={18} /> Nova Chave</Button>
                     </div>
                  </div>
                  <div className="bg-[#111] border border-gray-800 rounded-[35px] overflow-hidden shadow-2xl">
                     <table className="w-full text-left">
                        <thead className="bg-black/50 text-[10px] font-black uppercase tracking-[0.3em] text-gray-600 border-b border-gray-800">
                           <tr><th className="px-10 py-6">Usuário</th><th className="px-10 py-6">Status / Conexão</th><th className="px-10 py-6">Validade</th><th className="px-10 py-6 text-right">Ações</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                           {getPaginatedUsers().map(u => (
                              <tr key={u.id} className="hover:bg-white/5 transition-all group">
                                 <td className="px-10 py-6"> <div className="flex items-center gap-4"> <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${u.blocked ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500'}`}>{u.email?.[0]?.toUpperCase()}</div> <div className="flex flex-col"><span className="font-bold text-sm">{u.email}</span><span className="text-[9px] text-gray-600 font-black">{u.id}</span></div> </div> </td>
                                 <td className="px-10 py-6">
                                    <div className="flex flex-col gap-2">
                                       <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase border max-w-fit ${u.blocked ? 'bg-red-900/20 text-red-500 border-red-500/30' : 'bg-green-900/20 text-green-500 border-green-500/30'}`}>{u.blocked ? 'BLOQUEADO' : 'ATIVO'}</span>
                                       {u.isLoggedIn && (
                                          <div className="flex items-center gap-2 text-green-500 text-[9px] font-black uppercase tracking-widest bg-green-500/5 px-3 py-1 rounded-lg border border-green-500/20 max-w-fit">
                                             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></div>
                                             ONLINE
                                          </div>
                                       )}
                                    </div>
                                 </td>
                                 <td className="px-10 py-6"><span className="text-xs font-mono text-gray-500">{u.expirationDate ? new Date(u.expirationDate).toLocaleDateString() : 'VITALÍCIO'}</span></td>
                                 <td className="px-10 py-6 text-right">
                                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                       <button title="Expulsar do Sistema" onClick={() => { if (window.confirm(`Derrubar conexão de ${u.email}?`)) { const n = users.map(x => x.id === u.id ? { ...x, isLoggedIn: false, currentMachineId: undefined } : x); setUsers(n); DataService.updateSingleUser(n.find(x => x.id === u.id)!); setToast({ msg: 'Sessão derrubada!', type: 'success' }); } }} className="p-3 bg-white/5 hover:bg-yellow-600 rounded-xl text-yellow-500 hover:text-white transition-all"><UserX size={16} /></button>
                                       <button onClick={() => { setEditingUser(u); setIsLifetime(!u.expirationDate); setShowEditUserModal(true); }} className="p-3 bg-white/5 hover:bg-purple-600 rounded-xl text-gray-400 hover:text-white transition-all"><Edit2 size={16} /></button>
                                       <button onClick={() => { const n = users.map(x => x.id === u.id ? { ...x, blocked: !x.blocked } : x); setUsers(n); DataService.updateSingleUser(n.find(x => x.id === u.id)!); }} className="p-3 bg-white/5 hover:bg-orange-600 rounded-xl text-orange-500 hover:text-white transition-all"><Ban size={16} /></button>
                                       <button onClick={async () => { if (window.confirm('Excluir acesso permanentemente da Nuvem?')) { setIsSaving(true); try { const success = await DataService.deleteUser(u.id); if (success) { setUsers(prev => prev.filter(x => x.id !== u.id)); setToast({ msg: 'Membro removido da Cloud!', type: 'success' }); } else { setToast({ msg: 'Erro ao remover na cloud', type: 'error' }); } } finally { setIsSaving(false); } } }} className="p-3 bg-red-900/20 hover:bg-red-600 rounded-xl text-red-400 hover:text-white transition-all"><Trash2 size={16} /></button>
                                    </div>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>

                  {/* 🔥 PAGINAÇÃO */}
                  <Pagination
                     currentPage={usersCurrentPage}
                     totalItems={getVisibleUsers().length}
                     itemsPerPage={usersPerPage}
                     onPageChange={(page) => setUsersCurrentPage(page)}
                  />
               </div>

            )}

            {/* TAB SISTEMA */}
            {activeTab === 'settings' && localSettings && (
               <div className="max-w-6xl mx-auto space-y-12 animate-fade-in pb-48">
                  {isAdmin && (
                     <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                           <div className="bg-[#111] border border-gray-800 rounded-[40px] p-10 space-y-8 shadow-2xl">
                              <h3 className="text-xl font-black uppercase flex items-center gap-4 border-b border-gray-800 pb-6 text-yellow-500"><KeyRound size={20} /> Credenciais & Senhas</h3>
                              <div className="space-y-6">
                                 <Input label="E-mail Administrador" value={localSettings.adminEmail || ''} onChange={e => setLocalSettings({ ...localSettings, adminEmail: e.target.value })} />
                                 <Input label="Nova Senha Admin" type="password" placeholder="Em branco para manter" value={localSettings.adminPassword || ''} onChange={e => setLocalSettings({ ...localSettings, adminPassword: e.target.value })} />
                                 <div className="pt-4 border-t border-gray-800">
                                    <Input label="Senha Global Master de Membros" value={localSettings.defaultMemberPassword || ''} onChange={e => setLocalSettings({ ...localSettings, defaultMemberPassword: e.target.value })} />
                                    <p className="text-[9px] text-orange-500 font-black mt-2 uppercase tracking-tighter">⚠️ Ao trocar, as senhas de TODOS os MEMBROS antigos serão resetadas.</p>
                                 </div>
                                 <Input label="Link Suporte Global" value={localSettings.adminSupportLink || ''} onChange={e => setLocalSettings({ ...localSettings, adminSupportLink: e.target.value })} />
                                 <Input label="Link Botão Tutorial" value={localSettings.tutorialLink || ''} onChange={e => setLocalSettings({ ...localSettings, tutorialLink: e.target.value })} />
                              </div>
                           </div>

                           <div className="bg-[#111] border border-gray-800 rounded-[40px] p-10 space-y-8 shadow-2xl">
                              <h3 className="text-xl font-black uppercase flex items-center gap-4 border-b border-gray-800 pb-6 text-blue-500"><Filter size={20} /> Gerenciar Categorias</h3>
                              <div className="space-y-6">
                                 <div className="flex gap-4">
                                    <Input placeholder="Nome da nova categoria..." value={newGlobalCategory} onChange={e => setNewGlobalCategory(e.target.value)} />
                                    <button onClick={() => { if (!newGlobalCategory) return; setLocalSettings({ ...localSettings, categories: [...(localSettings.categories || []), newGlobalCategory.toUpperCase()] }); setNewGlobalCategory(''); }} className="p-4 bg-blue-600 rounded-xl hover:bg-blue-500 transition-all"><Plus size={20} /></button>
                                 </div>
                                 <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                    {(localSettings.categories || []).map(cat => (
                                       <div key={cat} className="px-4 py-1.5 bg-blue-900/10 border border-blue-500/20 rounded-xl flex items-center gap-3 text-[10px] text-blue-400 font-black">
                                          <span>{cat}</span>
                                          <button onClick={() => setLocalSettings({ ...localSettings, categories: (localSettings.categories || []).filter(c => c !== cat) })}><X size={12} /></button>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="bg-[#111] border border-gray-800 rounded-[40px] p-10 space-y-8 shadow-2xl">
                           <h3 className="text-xl font-black uppercase flex items-center gap-4 border-b border-gray-800 pb-6 text-red-500"><Ban size={20} /> Blacklist de URLs</h3>
                           <div className="space-y-6">
                              <div className="flex gap-4">
                                 <Input placeholder="URL para bloquear (ex: facebook.com)..." value={newBlockedUrl} onChange={e => setNewBlockedUrl(e.target.value)} />
                                 <button onClick={() => { if (!newBlockedUrl) return; setLocalSettings({ ...localSettings, blockedUrls: [...(localSettings.blockedUrls || []), newBlockedUrl] }); setNewBlockedUrl(''); }} className="p-4 bg-red-600 rounded-xl hover:bg-red-500 transition-all"><Plus size={20} /></button>
                              </div>
                              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                 {(localSettings.blockedUrls || []).map(url => (
                                    <div key={url} className="px-4 py-1.5 bg-red-900/10 border border-blue-500/20 rounded-xl flex items-center gap-3 text-[10px] text-red-400 font-black">
                                       <span>{url}</span>
                                       <button onClick={() => setLocalSettings({ ...localSettings, blockedUrls: (localSettings.blockedUrls || []).filter(u => u !== url) })}><X size={12} /></button>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>

                        <div className="bg-[#111] border border-gray-800 rounded-[40px] p-10 space-y-8 shadow-2xl border-l-purple-500 border-l-8">
                           <div className="flex justify-between items-center border-b border-gray-800 pb-6">
                              <h3 className="text-xl font-black uppercase flex items-center gap-4 text-purple-400"><Bell size={20} /> Gerenciador de Avisos (Pop-up)</h3>
                              <Switch label="Ativar Aviso Global" checked={localSettings.popup?.enabled || false} onChange={v => setLocalSettings({ ...localSettings, popup: { ...(localSettings.popup || INITIAL_SETTINGS.popup), enabled: v } })} />
                           </div>
                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                              <div className="space-y-6">
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-500">Tipo de Mídia do Pop-up</label>
                                    <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-gray-800">
                                       {[
                                          { id: 'text', icon: Type, label: 'Texto' },
                                          { id: 'image', icon: ImageIcon, label: 'Imagem' },
                                          { id: 'video', icon: Video, label: 'Vídeo' }
                                       ].map(t => (
                                          <button key={t.id} onClick={() => setLocalSettings({ ...localSettings, popup: { ...(localSettings.popup || INITIAL_SETTINGS.popup), type: t.id as any } })} className={`flex-1 py-3 rounded-lg flex flex-col items-center gap-2 transition-all ${localSettings.popup?.type === t.id ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}>
                                             <t.icon size={18} /> <span className="text-[8px] font-black uppercase">{t.label}</span>
                                          </button>
                                       ))}
                                    </div>
                                 </div>
                                 <Input label="URL da Mídia" value={localSettings.popup?.contentUrl || ''} onChange={e => setLocalSettings({ ...localSettings, popup: { ...(localSettings.popup || INITIAL_SETTINGS.popup), contentUrl: e.target.value } })} />
                                 <textarea className="w-full bg-[#0d0d0d] border border-gray-800 rounded-3xl p-6 text-sm h-32 text-white outline-none focus:border-purple-500 resize-none shadow-inner" placeholder="Mensagem..." value={localSettings.popup?.textContent || ''} onChange={e => setLocalSettings({ ...localSettings, popup: { ...(localSettings.popup || INITIAL_SETTINGS.popup), textContent: e.target.value } })} />
                              </div>
                              <div className="space-y-6">
                                 <Input label="Texto do Botão" value={localSettings.popup?.actionText || ''} onChange={e => setLocalSettings({ ...localSettings, popup: { ...(localSettings.popup || INITIAL_SETTINGS.popup), actionText: e.target.value } })} />
                                 <Input label="Link do Botão" value={localSettings.popup?.actionUrl || ''} onChange={e => setLocalSettings({ ...localSettings, popup: { ...(localSettings.popup || INITIAL_SETTINGS.popup), actionUrl: e.target.value } })} />
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-500">Tamanho</label>
                                    <div className="flex gap-2">
                                       {['sm', 'md', 'lg', 'fullscreen'].map(s => (
                                          <button key={s} onClick={() => setLocalSettings({ ...localSettings, popup: { ...(localSettings.popup || INITIAL_SETTINGS.popup), size: s as any } })} className={`flex-1 py-2 rounded-lg border text-[9px] font-black uppercase transition-all ${localSettings.popup?.size === s ? 'bg-white text-black border-white' : 'bg-black/20 border-gray-800 text-gray-600'}`}>{s}</button>
                                       ))}
                                    </div>
                                 </div>
                                 <Button variant="secondary" onClick={() => setShowAnnouncement(true)} className="w-full mt-4 !py-4"><PlayCircle size={18} /> Testar Pop-up</Button>
                              </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                           <div className="bg-[#111] border border-gray-800 rounded-[40px] p-10 space-y-8 shadow-2xl">
                              <h3 className="text-xl font-black uppercase flex items-center gap-4 border-b border-gray-800 pb-6 text-purple-400"><Palette size={20} /> Identidade Visual</h3>
                              <div className="space-y-6">
                                 <Input label="Logo do Painel (URL)" value={localSettings.logoUrl || ''} onChange={e => setLocalSettings({ ...localSettings, logoUrl: e.target.value })} />
                                 <div className="grid grid-cols-2 gap-6">
                                    <Input label="Altura Header" type="number" value={localSettings.headerHeight || 280} onChange={e => setLocalSettings({ ...localSettings, headerHeight: +e.target.value })} />
                                    <Input label="Escala Logo %" type="number" value={localSettings.logoSize || 100} onChange={e => setLocalSettings({ ...localSettings, logoSize: +e.target.value })} />
                                 </div>
                                 <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-gray-600 ml-1">Efeito Background</label>
                                    <div className="grid grid-cols-3 gap-2">
                                       {['nebula', 'snow', 'matrix', 'halloween', 'fireworks', 'summer'].map(ef => (
                                          <button key={ef} onClick={() => setLocalSettings({ ...localSettings, seasonalEffect: ef as any })} className={`p-3 rounded-xl border text-[9px] font-black uppercase transition-all ${localSettings.seasonalEffect === ef ? 'bg-purple-600 border-purple-500 text-white shadow-lg' : 'bg-black/40 border-gray-800 text-gray-600'}`}>{ef}</button>
                                       ))}
                                    </div>
                                 </div>
                              </div>
                           </div>

                           <div className="bg-[#111] border border-gray-800 rounded-[40px] p-10 space-y-8 shadow-2xl">
                              <h3 className="text-xl font-black uppercase flex items-center gap-4 border-b border-gray-800 pb-6 text-orange-500"><ImageIcon size={20} /> Banners de Propaganda</h3>
                              <div className="space-y-6">
                                 <div className="flex flex-col gap-3">
                                    <Input placeholder="URL da Imagem..." value={newBannerUrl} onChange={e => setNewBannerUrl(e.target.value)} />
                                    <div className="flex gap-4">
                                       <Input placeholder="Link de Destino..." value={newBannerLink} onChange={e => setNewBannerLink(e.target.value)} />
                                       <button onClick={() => { if (!newBannerUrl) return; setLocalSettings({ ...localSettings, adBanners: [...(localSettings.adBanners || []), newBannerUrl], adBannerLinks: [...(localSettings.adBannerLinks || []), newBannerLink || '#'] }); setNewBannerUrl(''); setNewBannerLink(''); }} className="p-4 bg-orange-600 rounded-xl hover:bg-orange-500 transition-all"><Plus size={20} /></button>
                                    </div>
                                 </div>
                                 <div className="grid grid-cols-2 gap-4">
                                    <Input label="Intervalo (seg)" type="number" value={localSettings.adBannerInterval || 5} onChange={e => setLocalSettings({ ...localSettings, adBannerInterval: +e.target.value })} />
                                    <Input label="Escala Banner" type="number" step="0.1" value={localSettings.adBannerScale || 1} onChange={e => setLocalSettings({ ...localSettings, adBannerScale: +e.target.value })} />
                                 </div>
                                 <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                    {(localSettings.adBanners || []).map((b, idx) => (
                                       <div key={idx} className="bg-black/40 p-2 rounded-xl flex items-center gap-4 border border-white/5 group">
                                          <img src={b} className="h-10 w-20 object-cover rounded-lg" />
                                          <div className="flex-1 truncate text-[9px] text-gray-500">{b}</div>
                                          <button onClick={() => { const bNext = [...localSettings.adBanners]; const lNext = [...localSettings.adBannerLinks]; bNext.splice(idx, 1); lNext.splice(idx, 1); setLocalSettings({ ...localSettings, adBanners: bNext, adBannerLinks: lNext }); }} className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="bg-[#111] border border-gray-800 rounded-[40px] p-10 space-y-6 shadow-2xl border-l-blue-500 border-l-8 overflow-hidden relative">
                           <div className="absolute top-0 right-0 p-8 opacity-5"><Terminal size={120} /></div>
                           <div className="flex justify-between items-center border-b border-gray-800 pb-6 relative z-10">
                              <div className="flex flex-col gap-1">
                                 <h3 className="text-xl font-black uppercase flex items-center gap-4 text-blue-400"><Activity size={20} /> Radar Hotmart Cloud V15.0 (ULTIMATE SHIELD)</h3>
                                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Expulsão imediata: Reembolsos, Cancelamentos e Protestos (Chargeback)</p>
                              </div>
                              <div className="flex gap-2">
                                 <button onClick={() => setShowAutomationModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 border border-blue-500/30 rounded-xl text-blue-500 hover:bg-blue-600 hover:text-white transition-all text-[9px] font-black uppercase"><Code size={14} /> Script V15</button>
                                 <button onClick={() => simulateHotmartEvent('PROTESTO (CHARGEBACK)')} className="flex items-center gap-2 px-4 py-2 bg-red-600/10 border border-red-500/30 rounded-xl text-red-500 hover:bg-red-600 hover:text-white transition-all text-[9px] font-black uppercase"><Zap size={14} /> Simular Expulsão</button>
                                 <button onClick={fetchRadarLogs} className="p-2 hover:bg-white/5 rounded-full transition-all text-gray-600 hover:text-white border border-white/5"><RefreshCw size={16} /></button>
                              </div>
                           </div>
                           <div className="grid grid-cols-1 gap-6 relative z-10">
                              <div className="bg-blue-600/5 border border-blue-500/20 p-6 rounded-2xl space-y-4">
                                 <div className="flex items-center justify-between"><span className="text-[11px] font-black text-blue-400 uppercase flex items-center gap-2"><Globe size={14} /> Webhook URL</span></div>
                                 <div className="flex items-center gap-3 bg-black/40 p-4 rounded-xl border border-white/5">
                                    <code className="flex-1 text-[11px] text-blue-200 font-mono break-all select-all">https://nkxiwcrffyvnmyvdggai.supabase.co/functions/v1/hyper-responder</code>
                                    <button onClick={() => { navigator.clipboard.writeText('https://nkxiwcrffyvnmyvdggai.supabase.co/functions/v1/hyper-responder'); setToast({ msg: 'Copiado!', type: 'info' }) }} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-all"><Copy size={16} /></button>
                                 </div>
                              </div>
                              <div className="max-h-[300px] overflow-y-auto font-mono text-[11px] bg-black/40 rounded-3xl p-6 border border-white/5 custom-scrollbar">
                                 {webhookLogs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 gap-4 opacity-30"><Activity size={48} className="animate-pulse" /><p className="text-gray-600 uppercase tracking-widest text-[9px] font-black">Escaneando sinais da Cloud...</p></div>
                                 ) : (
                                    <div className="space-y-3">
                                       {webhookLogs.map(log => (
                                          <div key={log.id} className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-3 gap-2 group hover:bg-white/5 transition-all p-2 rounded-lg">
                                             <div className="flex items-center gap-4">
                                                <span className="text-blue-500 font-black">[{new Date(log.time || log.created_at).toLocaleTimeString()}]</span>
                                                <span className="text-white font-bold">{log.email}</span>
                                             </div>
                                             <div className="flex items-center gap-3">
                                                <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-gray-500">{log.event || 'SINAL'}</span>
                                                <span className={`font-black uppercase tracking-tighter text-[10px] px-3 py-1 rounded-full border ${log.status.includes('BLOQUEADO') || log.status.includes('REEMBOLSO') || log.status.includes('CANCELADO') || log.status.includes('PROTESTO') || log.status.includes('CHARGEBACK') || log.status.includes('EXPULSO')
                                                   ? 'text-red-500 border-red-500/20 bg-red-500/10'
                                                   : 'text-green-500 border-green-500/20 bg-green-500/10'
                                                   }`}>{log.status}</span>
                                             </div>
                                          </div>
                                       ))}
                                    </div>
                                 )}
                              </div>
                           </div>
                        </div>

                        <div className="flex justify-end pt-8"> <Button onClick={handleGlobalSave} className="!px-16 !py-6 font-black tracking-[0.3em] !text-xs" disabled={isSaving}> <Save size={24} /> {isSaving ? 'SALVANDO...' : 'SINCRONIZAR TUDO NA NUVEM'} </Button> </div>
                     </>
                  )}

                  {currentUser?.role === Role.RESELLER && !isAdmin && (
                     <div className="bg-[#111] border border-gray-800 rounded-[40px] p-10 space-y-8 shadow-2xl">
                        <h3 className="text-xl font-black uppercase flex items-center gap-4 border-b border-gray-800 pb-6 text-purple-400"> <Shield size={20} /> Personalizar Meu Painel</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                           <div className="space-y-6">
                              <Input label="Logo (URL)" value={currentUser.customLogoUrl || ''} onChange={e => setCurrentUser({ ...currentUser, customLogoUrl: e.target.value })} />
                              <Input label="Suporte (Link)" value={currentUser.supportUrl || ''} onChange={e => setCurrentUser({ ...currentUser, supportUrl: e.target.value })} />
                           </div>
                           <div className="space-y-6">
                              <Input label="Nova Senha" type="password" value={newResellerPassword} onChange={e => setNewResellerPassword(e.target.value)} />
                           </div>
                        </div>
                        <div className="flex justify-end pt-4"> <Button onClick={handleSaveResellerBrand} className="!px-12 !py-4"> <Save size={18} /> {isSaving ? 'Gravando...' : 'Salvar Marca'} </Button> </div>
                     </div>
                  )}
               </div>
            )}
         </main>

         {runningProfiles.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 bg-black/90 backdrop-blur-3xl border border-white/10 rounded-[35px] flex items-center gap-10 border-b-purple-500/40 border-b-4 shadow-2xl animate-fade-in-up">
               <div className="flex flex-col border-r border-white/10 pr-10">
                  <span className="text-lg font-black text-green-500 flex items-center gap-2 uppercase tracking-tighter"><Layers size={18} /> {runningProfiles.length} ATIVOS</span>
               </div>
               <div className="flex items-center gap-4 overflow-x-auto no-scrollbar max-w-[400px]">
                  {runningProfiles.map(p => (
                     <div key={p.id} onClick={() => setActiveProfileId(p.id)} className={`relative w-14 h-14 rounded-2xl overflow-hidden cursor-pointer transition-all border-2 flex-shrink-0 ${activeProfileId === p.id ? 'border-purple-500 shadow-lg' : 'border-transparent opacity-40'}`}>
                        <img src={p.coverImage} className="w-full h-full object-cover" />
                        <button onClick={e => { e.stopPropagation(); setRunningProfiles(prev => prev.filter(x => x.id !== p.id)); if (activeProfileId === p.id) setActiveProfileId(null); }} className="absolute top-1 right-1 bg-red-600 text-white rounded p-0.5"><X size={10} /></button>
                     </div>
                  ))}
               </div>
               <button onClick={() => setRunningProfiles([])} className="p-4 bg-red-900/40 text-red-400 hover:bg-red-600 transition-all rounded-2xl shadow-xl active:scale-95"><Power size={22} /></button>
            </div>
         )}

         {runningProfiles.map(p => (
            <BrowserWindow key={p.id} profile={p} isVisible={activeProfileId === p.id} onClose={() => setActiveProfileId(null)} onTerminate={() => { setRunningProfiles(prev => prev.filter(x => x.id !== p.id)); setActiveProfileId(null); }} onToast={(m, t) => setToast({ msg: m, type: t })} blockedUrls={settings?.blockedUrls || []} onSyncSession={handleSyncProfileSession} />
         ))}

         {/* MODAL PERFIL */}
         <Modal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} title={editingProfile ? 'Editar Ferramenta' : 'Nova Ferramenta'} size="lg">
            <form onSubmit={handleSaveProfile} className="space-y-8">
               <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-6">
                     <Input name="name" label="Nome do Serviço" defaultValue={editingProfile?.name} required />
                     <Input name="coverImage" label="URL da Imagem da Capa" defaultValue={editingProfile?.coverImage} required />
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-600">Modo de Inicialização</label>
                        <select name="launchMode" className="w-full bg-[#111] border border-gray-800 rounded-2xl p-4 text-sm outline-none focus:border-purple-500" defaultValue={editingProfile?.launchMode || 'internal'}>
                           <option value="internal">Interno (Browser do App)</option>
                           <option value="external">Externo (Navegador Local / Chrome)</option>
                        </select>
                     </div>
                     <div className="flex items-center gap-4 bg-purple-900/10 border border-purple-500/30 rounded-2xl p-4">
                        <input type="checkbox" name="useNativeBrowser" id="useNativeBrowser" defaultChecked={editingProfile?.useNativeBrowser} className="w-5 h-5 accent-purple-500" />
                        <div className="flex flex-col">
                           <label htmlFor="useNativeBrowser" className="text-sm font-bold text-purple-400 cursor-pointer">🎬 Habilitar DRM (Streaming)</label>
                           <span className="text-[9px] text-gray-500">Para HBO Max, Netflix, Disney+, Amazon Prime, etc. (Modo Externo)</span>
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-600">Escolher Categorias</label>
                        <div className="grid grid-cols-2 gap-2 bg-black/40 border border-gray-800 rounded-2xl p-4 max-h-48 overflow-y-auto custom-scrollbar">
                           {(settings?.categories || []).map(cat => (
                              <button key={cat} type="button" onClick={() => toggleModalCategory(cat)} className={`flex items-center justify-between px-3 py-2 rounded-xl border text-[9px] font-black transition-all ${modalSelectedCategories.includes(cat) ? 'bg-purple-600/20 border-purple-500 text-purple-400' : 'bg-black/40 border-gray-800 text-gray-600'}`}>
                                 <span className="truncate">{cat}</span> {modalSelectedCategories.includes(cat) && <Check size={12} />}
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>
                  <div className="space-y-6">
                     <label className="text-[10px] font-black uppercase text-gray-600">URLs (Iniciais)</label>
                     <textarea name="urls" className="w-full bg-[#111] border border-gray-800 rounded-2xl p-4 text-sm h-32 outline-none focus:border-purple-500 font-mono" defaultValue={editingProfile?.urls?.join('\n') || ''} required />
                     <Input name="orderIndex" label="Índice de Ordem" type="number" defaultValue={editingProfile?.orderIndex} />
                     <Input name="videoTutorial" label="Link de Instruções (Tutorial)" defaultValue={editingProfile?.videoTutorial} />
                     <div className="flex gap-3">
                        <select value={proxyProtocol} onChange={e => setProxyProtocol(e.target.value)} className="bg-[#111] border border-gray-800 rounded-xl px-4 text-xs w-24 outline-none"><option value="http">HTTP</option><option value="socks5">S5</option></select>
                        <input className="flex-1 bg-[#111] border border-gray-800 rounded-xl px-4 text-sm outline-none" placeholder="IP:PORTA:USER:PASS" value={proxyInput} onChange={e => setProxyInput(e.target.value)} />
                     </div>
                  </div>
               </div>
               <div className="bg-black/40 p-8 rounded-[35px] border border-gray-800 space-y-8">
                  <h4 className="text-purple-400 font-black uppercase text-xs tracking-widest flex items-center gap-3"> <Puzzle size={18} /> Configurações de Login & Automação</h4>
                  <div className="grid grid-cols-2 gap-8">
                     <div className="space-y-6">
                        <Input name="email" label="Auto-Fill E-mail" defaultValue={editingProfile?.email} />
                        <Input name="password" label="Auto-Fill Senha" type="password" defaultValue={editingProfile?.password} />
                        <Input name="discordToken" label="Token de Login Discord" defaultValue={editingProfile?.discordToken} placeholder="Cole o token aqui..." />
                     </div>
                     <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-gray-600">Cookies JSON</label>
                        <textarea name="cookies" className="w-full bg-[#111] border border-gray-800 rounded-2xl p-4 text-[10px] font-mono text-gray-500 h-24 outline-none focus:border-purple-500" defaultValue={editingProfile?.cookies} />
                        <label className="text-[10px] font-black uppercase text-gray-600">Script de Automação (JS)</label>
                        <textarea name="automationScript" className="w-full bg-[#111] border border-gray-800 rounded-2xl p-4 text-[10px] font-mono text-green-500 h-24 outline-none focus:border-purple-500" defaultValue={editingProfile?.automationScript} />
                        <label className="text-[10px] font-black uppercase text-gray-600">CSS Personalizado (Injeção)</label>
                        <textarea name="customCSS" className="w-full bg-[#111] border border-gray-800 rounded-2xl p-4 text-[10px] font-mono text-blue-400 h-24 outline-none focus:border-purple-500" defaultValue={editingProfile?.customCSS} />
                     </div>
                  </div>
               </div>
               <div className="flex justify-end gap-4 pt-4"> <Button type="submit" className="!px-12 !py-4 font-black" disabled={isSaving}> {isSaving ? 'SINCROIZANDO...' : 'SALVAR NO SUPABASE'} </Button> </div>
            </form>
         </Modal>

         {/* MODAL SCRIPT V15.0 */}
         <Modal isOpen={showAutomationModal} onClose={() => setShowAutomationModal(false)} title="Script de Automação V15.0 (Ultimate Cloud Shield)" size="lg">
            <div className="space-y-6">
               <div className="bg-red-600/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-4">
                  <Shield className="text-red-500 shrink-0" size={24} />
                  <p className="text-[10px] text-red-200 uppercase font-black leading-relaxed">VERSÃO V15.0 ULTIMATE: Expulsão imediata em caso de <span className="text-white">REEMBOLSO, CANCELAMENTO OU PROTESTO (CHARGEBACK)</span>. Copie e cole na sua Edge Function do Supabase.</p>
               </div>
               <div className="bg-black p-6 rounded-2xl border border-white/5 relative group">
                  <pre className="text-[10px] text-blue-300 font-mono overflow-x-auto max-h-96 custom-scrollbar whitespace-pre-wrap">
                     {`import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const body = await req.json()
    const event = (body.event || body.type || "").toUpperCase()
    
    const email = (
      body.data?.buyer?.email || 
      body.data?.subscriber?.email || 
      body.email || 
      body.data?.user?.email || 
      body.buyer?.email ||
      body.customer?.email ||
      ""
    ).toLowerCase().trim()

    if (!email) return new Response("Email nao detectado", { status: 400 })

    let statusMsg = "PROCESSADO"
    const activationEvents = ['PURCHASE_APPROVED', 'APPROVED', 'COMPLETED', 'SUBSCRIPTION_PROCESSED', 'TRIAL_PROCESSED', 'ORDER_PAID']
    const blockingEvents = ['PURCHASE_CANCELED', 'PURCHASE_REFUNDED', 'REFUNDED', 'SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION_CANCELLATION', 'CHARGEBACK', 'PURCHASE_EXPIRED', 'PURCHASE_PROTEST', 'PROTEST', 'DISPUTE_OPENED', 'CANCELLED']

    if (activationEvents.includes(event)) {
      const { data: user } = await supabase.from('users').select('*').eq('email', email).single()
      const newExp = Date.now() + (30 * 24 * 60 * 60 * 1000);

      if (user) {
        await supabase.from('users').update({ blocked: false, expirationDate: newExp }).eq('email', email)
        statusMsg = "REATIVADO ✅"
      } else {
        await supabase.from('users').insert({
          id: 'h_' + Math.random().toString(36).substring(2, 10),
          email, password: "membro123", role: "MEMBER", blocked: false, createdAt: Date.now(), expirationDate: newExp
        })
        statusMsg = "ACESSO CRIADO ✅"
      }
    } 
    else if (blockingEvents.includes(event)) {
      await supabase.from('users').update({ blocked: true, isLoggedIn: false, currentMachineId: null }).eq('email', email)
      statusMsg = (event.includes('PROTEST') || event.includes('CHARGE')) ? "EXPULSO POR PROTESTO 🚨" : "BLOQUEADO (REEMBOLSO/FIM)";
    }

    await supabase.from('logs').insert({ email, event: event || 'WEBHOOK', status: statusMsg, time: new Date().toISOString() })
    return new Response(JSON.stringify({ ok: true, status: statusMsg }), { headers: { "Content-Type": "application/json" } })
  } catch (err) {
    return new Response(err.message, { status: 500 })
  }
})`}
                  </pre>
                  <button onClick={() => { navigator.clipboard.writeText(`CÓDIGO V15.0 COPIADO`); setToast({ msg: 'Copiado!', type: 'success' }); }} className="absolute top-4 right-4 p-3 bg-red-600 rounded-xl opacity-0 group-hover:opacity-100 transition-all cursor-pointer"><Copy size={16} /></button>
               </div>
            </div>
         </Modal>

         {/* MODAL NOVO ACESSO */}
         <Modal isOpen={showUserModal} onClose={() => setShowUserModal(false)} title="Liberar Novo Acesso" size="md">
            <form onSubmit={handleSaveNewUser} className="space-y-6">
               <Input name="email" label="E-mail do Membro" placeholder="cliente@email.com" required />
               <Input name="password" label="Senha Personalizada" placeholder="Em branco para usar a padrão do sistema" />
               <select name="role" className="w-full bg-[#111] border border-gray-800 rounded-2xl p-4 text-sm" defaultValue={Role.MEMBER}> {isAdmin && <option value={Role.RESELLER}>Revendedor</option>} <option value={Role.MEMBER}>Membro Premium</option> </select>
               <div className="flex items-center justify-between p-6 bg-white/5 rounded-3xl">
                  <span className="text-xs font-black uppercase text-purple-400">Acesso Vitalício?</span>
                  <Switch label="" checked={isLifetime} onChange={(val) => { setIsLifetime(val); }} />
               </div>
               {!isLifetime && (
                  <div className="animate-fade-in">
                     <Input name="exp" type="date" label="Data de Vencimento do Plano" required />
                  </div>
               )}
               <Button type="submit" className="w-full !py-4 shadow-xl" disabled={isSaving}> {isSaving ? 'PROCESSANDO...' : 'CRIAR CHAVE IMEDIATA'} </Button>
            </form>
         </Modal>

         {/* EDITAR ACESSO */}
         <Modal isOpen={showEditUserModal} onClose={() => setShowEditUserModal(false)} title="Gerenciar Acesso">
            {editingUser && (
               <form onSubmit={async e => {
                  e.preventDefault(); setIsSaving(true);
                  try {
                     const fd = new FormData(e.currentTarget); const expRaw = fd.get('exp'); const finalExp = isLifetime ? null : (expRaw ? new Date(String(expRaw) + 'T23:59:59').getTime() : null);
                     const up = users.map(u => u.id === editingUser.id ? { ...u, email: String(fd.get('email')).toLowerCase().trim(), password: fd.get('password') ? String(fd.get('password')).trim() : u.password, expirationDate: finalExp === null ? undefined : finalExp } : u);
                     setUsers(up); await DataService.saveUsers(up); setShowEditUserModal(false); setToast({ msg: 'Atualizado!', type: 'success' });
                  } finally { setIsSaving(false); }
               }} className="space-y-6">
                  <Input name="email" label="Email do Cliente" defaultValue={editingUser.email} required />
                  <Input name="password" label="Nova Senha" placeholder="Vazio para manter a atual" />
                  <div className="flex items-center justify-between p-6 bg-white/5 rounded-3xl">
                     <span className="text-xs font-black uppercase text-purple-400">Plano Vitalício</span>
                     <Switch label="" checked={isLifetime} onChange={setIsLifetime} />
                  </div>
                  {!isLifetime && (
                     <div className="animate-fade-in">
                        <Input name="exp" type="date" label="Novo Vencimento" defaultValue={editingUser.expirationDate ? new Date(editingUser.expirationDate).toISOString().split('T')[0] : ''} required />
                     </div>
                  )}
                  <Button type="submit" className="w-full shadow-lg" disabled={isSaving}>SALVAR ALTERAÇÕES</Button>
               </form>
            )}
         </Modal>

         {/* MODAL EDICAO EM MASSA */}
         <Modal isOpen={showBulkDateModal} onClose={() => setShowBulkDateModal(false)} title="Editar Vencimento de Todos os Membros" size="md">
            <div className="space-y-6">
               <Input type="date" label="Nova Data de Vencimento" value={bulkDate} onChange={e => setBulkDate(e.target.value)} required />
               <Button onClick={handleApplyBulkDate} className="w-full !py-4 shadow-xl" disabled={isSaving || !bulkDate}>APLICAR NOVA DATA EM MASSA</Button>
            </div>
         </Modal>

         {/* MODAL IMPORTAR */}
         <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title="Importador em Massa (Auto 30 Dias)">
            <form onSubmit={async e => {
               e.preventDefault(); setIsSaving(true);
               try {
                  const emails = importEmails.split(/[\n,;]/).map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
                  const newList = [...users]; const thirtyDaysFromNow = Date.now() + (30 * 24 * 60 * 60 * 1000);
                  emails.forEach(email => {
                     if (!newList.find(u => u.email === email)) {
                        newList.push({
                           id: `u_imp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, email, password: settings?.defaultMemberPassword || 'membro123', role: Role.MEMBER, ownerId: currentUser?.id || 'ADMIN', createdAt: Date.now(), expirationDate: thirtyDaysFromNow
                        });
                     }
                  });
                  setUsers(newList); await DataService.saveUsers(newList); setShowImportModal(false); setImportEmails(''); setToast({ msg: 'Importado!', type: 'success' });
               } finally { setIsSaving(false); }
            }} className="space-y-6">
               <textarea className="w-full bg-[#111] border border-gray-800 rounded-3xl p-6 text-sm h-64 outline-none font-mono" value={importEmails} onChange={e => setImportEmails(e.target.value)} placeholder="Cole os e-mails..." required />
               <Button type="submit" className="w-full !bg-orange-600 shadow-orange-900/30" disabled={isSaving}>PROCESSAR E IMPORTAR AGORA</Button>
            </form>
         </Modal>

         {showAnnouncement && settings?.popup && <AnnouncementPopup config={settings.popup} onClose={() => setShowAnnouncement(false)} />}
         {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

         {/* 🔄 OVERLAY DE CARREGAMENTO DO NAVEGADOR */}
         {launchingStatus.isLaunching && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
               <div className="flex flex-col items-center gap-6 p-10 bg-gradient-to-br from-gray-900/90 to-black/90 rounded-3xl border border-purple-500/30 shadow-2xl shadow-purple-500/20">
                  {/* Spinner animado */}
                  <div className="relative">
                     <div className="w-16 h-16 border-4 border-purple-500/30 rounded-full animate-spin" style={{ borderTopColor: '#a855f7' }}></div>
                     <div className="absolute inset-0 flex items-center justify-center">
                        <Chrome className="w-6 h-6 text-purple-400" />
                     </div>
                  </div>

                  {/* Nome do perfil */}
                  {launchingStatus.profileName && (
                     <h3 className="text-xl font-bold text-white">{launchingStatus.profileName}</h3>
                  )}

                  {/* Mensagem de status */}
                  <p className="text-purple-300 text-center text-sm max-w-xs">{launchingStatus.message}</p>

                  {/* Barra de progresso animada */}
                  <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
                     <div className="h-full bg-gradient-to-r from-purple-600 to-pink-500 animate-pulse" style={{ width: '100%', animation: 'loading-bar 2s ease-in-out infinite' }}></div>
                  </div>

                  <p className="text-xs text-gray-500">Aguarde, isso pode levar alguns segundos...</p>
               </div>
            </div>
         )}
      </div>
   );
};

export default App;
