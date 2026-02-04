
export enum Role {
  ADMIN = 'ADMIN',
  RESELLER = 'RESELLER',
  MEMBER = 'MEMBER'
}

export interface User {
  id: string;
  email: string;
  password?: string;
  role: Role;
  ownerId?: string;
  name?: string;
  createdAt: number;
  blocked?: boolean;
  supportUrl?: string;
  customLogoUrl?: string;
  isLoggedIn?: boolean;
  favorites?: string[];
  expirationDate?: number;
  currentMachineId?: string;
}

export interface FingerprintConfig {
  maskFingerprint: boolean;
  spoofUserAgent: boolean;
  isolateCookies: boolean;
  spoofTimezone: boolean;
  spoofLanguage: boolean;
  webrtcProtection: boolean;
  hardwareFingerprint: boolean;
  isolateProfile: boolean;
}

export interface Profile {
  id: string;
  name: string;
  status: 'active' | 'maintenance';
  coverImage: string;
  urls: string[];
  launchMode: 'internal' | 'external';
  useExternalBrowserUI?: boolean;
  useNativeBrowser?: boolean; // Chrome nativo com suporte a DRM (HBO Max, Netflix, etc.)
  accessUrl?: string;
  loginType: 'credentials' | 'cookies' | 'discord' | 'script';
  autoLoginEnabled?: boolean;
  email?: string;
  password?: string;
  cookies?: string;
  automationScript?: string;
  customCSS?: string;
  discordToken?: string;
  categories?: string[];
  proxy?: string;
  isFavorite: boolean;
  createdAt: number;
  orderIndex?: number;
  fingerprint: FingerprintConfig;
  localStorage?: string;
  customExtensionPath?: string;
  videoTutorial?: string;
}

export interface TextStyle {
  fontFamily: string;
  gradientFrom: string;
  gradientTo: string;
  gradientDirection: string;
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
}

export interface PopupConfig {
  enabled: boolean;
  type: 'image' | 'video' | 'text';
  contentUrl: string;
  textContent: string;
  size: 'sm' | 'md' | 'lg' | 'fullscreen';
  actionUrl?: string;
  actionText?: string;
  textStyle: TextStyle;
}

export type SeasonalEffectType =
  | 'nebula' | 'snow' | 'rain' | 'leaves' | 'fireworks'
  | 'halloween' | 'valentine' | 'easter' | 'summer'
  | 'matrix' | 'junina' | 'mothersday' | 'christmas';

export interface AppSettings {
  logoUrl: string;
  logoSize: number;
  headerHeight: number;
  adBannerInterval: number;
  adBannerScale: number;
  adBanners: string[];
  adBannerLinks: string[];
  popup: PopupConfig;
  seasonalEffect: SeasonalEffectType;
  defaultMemberPassword?: string;
  adminSupportLink?: string;
  tutorialLink?: string;
  blockedUrls?: string[];
  categories?: string[];
  customBrowserPath?: string;
  adminEmail?: string;
  adminPassword?: string;
}