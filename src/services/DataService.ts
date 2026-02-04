import { supabase } from '../lib/supabase';
import { AppSettings, Profile, User } from '../types';
import { INITIAL_SETTINGS, MOCK_USERS, MOCK_PROFILES } from '../constants';
import { Security } from './Security';

/**
 * Remove apenas campos "undefined" que o Supabase rejeita.
 */
const cleanForSupabase = (obj: any) => {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (value === undefined) return null;
    return value;
  }));
};

export const DataService = {
  
  initializeData: async () => {
    const cachedUsers = Security.decrypt(localStorage.getItem('nebula_users_v1'));
    const cachedProfiles = Security.decrypt(localStorage.getItem('nebula_profiles_v1'));
    const cachedSettings = Security.decrypt(localStorage.getItem('nebula_settings_v1'));

    try {
      const [uRes, pRes, sRes] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('profiles').select('*').order('orderIndex', { ascending: true }),
        supabase.from('settings').select('config').single()
      ]);

      const cloudUsers = uRes.data || [];
      const cloudProfiles = pRes.data || [];
      const cloudSettings = sRes.data?.config || INITIAL_SETTINGS;

      // Anti-wipe: não apaga local se nuvem estiver vazia por erro
      if (cloudProfiles.length === 0 && cachedProfiles && cachedProfiles.length > 0) {
          return { users: cloudUsers, profiles: cachedProfiles, settings: cloudSettings, isOffline: false };
      }

      DataService.saveToLocalCache(cloudUsers, cloudProfiles, cloudSettings);
      return { users: cloudUsers, profiles: cloudProfiles, settings: cloudSettings, isOffline: false };
    } catch (error) {
      return {
        users: cachedUsers || MOCK_USERS,
        profiles: cachedProfiles || MOCK_PROFILES,
        settings: cachedSettings || INITIAL_SETTINGS,
        isOffline: true
      };
    }
  },

  saveUsers: async (users: User[]): Promise<boolean> => {
    localStorage.setItem('nebula_users_v1', Security.encrypt(users));
    try {
      const sanitized = cleanForSupabase(users);
      const { error } = await supabase.from('users').upsert(sanitized, { onConflict: 'id' });
      return !error;
    } catch (e) { return false; }
  },

  saveProfiles: async (profiles: Profile[]): Promise<boolean> => {
    localStorage.setItem('nebula_profiles_v1', Security.encrypt(profiles));
    try {
      if (!profiles || profiles.length === 0) return true;
      
      const sanitized = profiles.map(p => cleanForSupabase(p));
      const { error } = await supabase.from('profiles').upsert(sanitized, { onConflict: 'id' });
      
      if (error) {
        console.error("Erro Supabase:", error.message);
        return false;
      }
      return true;
    } catch (e) { return false; }
  },

  saveSettings: async (settings: AppSettings): Promise<boolean> => {
    localStorage.setItem('nebula_settings_v1', Security.encrypt(settings));
    try {
      const { error } = await supabase.from('settings').upsert({ id: 1, config: settings }, { onConflict: 'id' });
      return !error;
    } catch (error) { return false; }
  },

  // Fix: Added missing deleteUser method
  deleteUser: async (userId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) return false;
      const current = Security.decrypt(localStorage.getItem('nebula_users_v1')) || [];
      localStorage.setItem('nebula_users_v1', Security.encrypt(current.filter((u: any) => u.id !== userId)));
      return true;
    } catch (e) { return false; }
  },

  // Fix: Added missing deleteProfile method
  deleteProfile: async (profileId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', profileId);
      if (error) return false;
      const current = Security.decrypt(localStorage.getItem('nebula_users_v1')) || [];
      localStorage.setItem('nebula_users_v1', Security.encrypt(current.filter((p: any) => p.id !== profileId)));
      return true;
    } catch (e) { return false; }
  },

  saveToLocalCache: (users: User[], profiles: Profile[], settings: AppSettings) => {
    localStorage.setItem('nebula_users_v1', Security.encrypt(users));
    localStorage.setItem('nebula_profiles_v1', Security.encrypt(profiles));
    localStorage.setItem('nebula_settings_v1', Security.encrypt(settings));
  },

  getRememberMe: () => Security.decrypt(localStorage.getItem('nebula_auth_remember')),
  saveRememberMe: (email: string, password: string) => {
    localStorage.setItem('nebula_auth_remember', Security.encrypt({ email, password, timestamp: Date.now() }));
  },
  clearRememberMe: () => localStorage.removeItem('nebula_auth_remember')
};