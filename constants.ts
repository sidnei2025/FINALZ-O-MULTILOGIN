
import { AppSettings, Profile, Role, User, FingerprintConfig } from './types';

export const API_BASE_URL = "https://api.karaokeraf.com"; 
export const VPS_API_KEY = "SIDNEI_PRO_TOKEN_2025_SECURE"; 

export const ADMIN_SUPPORT_LINK = "https://t.me/+nNeDGqzMiUo5MWFh";
export const HOTMART_CHECKOUT_URL = "https://sso.hotmart.com/login?service=https%3A%2F%2Fsso.hotmart.com%2Foauth2.0%2FcallbackAuthorize%3Fclient_id%3D0fff6c2a-971c-4f7a-b0b3-3032b7a26319%26scope%3Dopenid%2Bprofile%2Bauthorities%2Bemail%2Buser%26redirect_uri%3Dhttps%253A%252F%252Fconsumer.hotmart.com%252Fauth%252Flogin%26response_type%3Dcode%26response_mode%3Dquery%26state%3Dad7880cd44ce459bbfff5983d1c5565b%26client_name%3DCasOAuthClient"; 

const defaultFingerprint: FingerprintConfig = {
  maskFingerprint: true, spoofUserAgent: true, isolateCookies: true, spoofTimezone: true,
  spoofLanguage: true, webrtcProtection: true, hardwareFingerprint: true, isolateProfile: true
};

export const DEFAULT_ADS = [
  "https://cdn.pixabay.com/photo/2018/01/14/23/12/nature-3082832_1280.jpg",
  "https://cdn.pixabay.com/photo/2016/10/21/14/50/plouzane-1758197_1280.jpg",
  "https://cdn.pixabay.com/photo/2017/12/10/17/40/prague-3010407_1280.jpg"
];

export const INITIAL_SETTINGS: AppSettings = {
  logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Netflix_2015_logo.svg/799px-Netflix_2015_logo.svg.png",
  logoSize: 100,
  headerHeight: 320,
  adBannerInterval: 5,
  adBannerScale: 1,
  adBanners: DEFAULT_ADS,
  adBannerLinks: ["https://google.com", "https://bing.com", "https://yahoo.com"],
  seasonalEffect: 'nebula',
  defaultMemberPassword: 'membro123',
  tutorialLink: 'https://youtube.com',
  blockedUrls: [], 
  categories: [
    "INTELIGÊNCIAS ARTIFICIAIS", "IAS ESTILO CHATGPT", "IMAGEMS", "VÍDEOS", 
    "GERADORES DE ÁUDIO", "CURSOS", "LIP SYNC", "OUTROS", "FERRAMENTAS DE SEO", 
    "MINERAÇÃO DE PRODUTOS", "FÓRUMS", "PACK TOOLS", "IMAGENS E VÍDEO"
  ],
  popup: {
    enabled: false,
    type: 'text',
    contentUrl: '',
    textContent: 'Bem-vindo ao Sidnei - Ferramentas Ilimitadas!',
    size: 'md',
    actionUrl: '',
    actionText: 'Saiba Mais',
    textStyle: {
      fontFamily: 'Inter',
      gradientFrom: '#a855f7',
      gradientTo: '#ec4899',
      gradientDirection: 'to right',
      fontSize: 2,
      textAlign: 'center'
    }
  }
};

export const MOCK_USERS: User[] = [
  { id: '1', email: 'admin@sidnei.com', role: Role.ADMIN, password: 'admin', createdAt: Date.now(), blocked: false, isLoggedIn: false },
];

export const MOCK_PROFILES: Profile[] = [
  {
    id: 'p1', name: 'Netflix Premium', status: 'active', 
    coverImage: 'https://images.ctfassets.net/4cd45et68cgf/4nBn7n6vL99yC9f76UMp6O/93b2161358f2d591605342a843e990c7/Netflix-Symbol.png',
    urls: ['https://netflix.com'], launchMode: 'external', loginType: 'cookies', isFavorite: true, createdAt: Date.now(),
    fingerprint: defaultFingerprint, orderIndex: 0
  },
  {
    id: 'p2', name: 'Canva Pro', status: 'active',
    coverImage: 'https://static.canva.com/web/images/852504936d65313988b4d8981358d712.png',
    urls: ['https://canva.com'], launchMode: 'external', loginType: 'cookies', isFavorite: false, createdAt: Date.now(),
    fingerprint: defaultFingerprint, orderIndex: 1
  },
  {
    id: 'p3', name: 'ChatGPT Plus', status: 'active',
    coverImage: 'https://static.vecteezy.com/system/resources/previews/021/495/996/non_2x/chatgpt-logo-chat-gpt-icon-on-black-background-free-vector.jpg',
    urls: ['https://chat.openai.com'], launchMode: 'external', loginType: 'cookies', isFavorite: false, createdAt: Date.now(),
    fingerprint: defaultFingerprint, orderIndex: 2
  }
];
