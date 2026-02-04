
import { AppSettings, Profile, Role, User, FingerprintConfig } from './types';

// O sistema agora é 100% Supabase. 
export const HOTMART_CHECKOUT_URL = "https://sso.hotmart.com/login"; 
export const ADMIN_SUPPORT_LINK = "https://t.me/+nNeDGqzMiUo5MWFh";

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
  adBannerLinks: ["https://google.com"],
  seasonalEffect: 'nebula',
  defaultMemberPassword: 'membro123',
  tutorialLink: 'https://youtube.com',
  categories: ["IAS", "IMAGENS", "VÍDEOS", "OUTROS"],
  blockedUrls: [], 
  popup: {
    enabled: false,
    type: 'text',
    contentUrl: '',
    textContent: 'Bem-vindo ao Sistema!',
    size: 'md',
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

// Perfis Mock vazios para não resetarem o que o usuário cadastrou
export const MOCK_PROFILES: Profile[] = [];
