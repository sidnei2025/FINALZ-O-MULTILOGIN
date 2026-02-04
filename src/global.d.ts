import { Profile } from './types';

export { };

declare global {
  interface Window {
    nebulaAPI?: {
      launchProfile: (profile: Profile, customBrowserPath?: string) => Promise<{ status: 'success' | 'error'; message?: string; pid?: number; mode?: string }>;
      launchProfileNative: (profile: Profile, customBrowserPath?: string) => Promise<{ status: 'success' | 'error'; message?: string; pid?: number; mode?: string }>;
      openExternal: (url: string) => Promise<{ status: 'success' | 'error'; message?: string }>;
      openPopup: (url: string, partition: string) => Promise<{ status: 'success' | 'error'; message?: string }>;
      deleteProfileFolder: (profileId: string) => Promise<{ status: 'success' | 'error'; message?: string }>;
      setCookies: (cookies: string, partition: string) => Promise<{ status: 'success' | 'error'; message?: string }>;
      getCookies: (partition: string) => Promise<{ status: 'success' | 'error'; cookies?: any[]; message?: string }>;
      setProxy: (proxy: string, partition: string) => Promise<{ status: 'success' | 'error'; message?: string }>;
      checkProxy: (proxy: string) => Promise<{ status: 'success' | 'error'; ip?: string; message?: string }>;
      // Sincronização de sessão via Cloud
      captureSession: (profileId: string, targetUrl: string) => Promise<{ status: 'success' | 'error'; sessionData?: any; message?: string }>;
      injectSession: (profileId: string, sessionData: any, targetUrl: string) => Promise<{ status: 'success' | 'error'; message?: string }>;
      onCookieSync: (callback: (data: { profileId: string; cookies: any[] }) => void | Promise<void>) => void;
      onDownloadProgress: (callback: (data: any) => void) => void;
      platform: string;
    };
  }
}