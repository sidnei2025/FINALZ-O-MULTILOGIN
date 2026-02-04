import { createClient } from '@supabase/supabase-js';

// --- ATENÇÃO: VOCÊ PRECISA SUBSTITUIR ESSES VALORES ---
// Pegue no seu painel do Supabase em Project Settings > API
const SUPABASE_URL = 'https://fkrijejmvtwwtgirlsey.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrcmlqZWptdnR3d3RnaXJsc2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTgwMTAsImV4cCI6MjA4NTE3NDAxMH0.IOahwdGVSowVMn0FRpz_-EHU8bEv9areX6zY1rM-LdY'; // Substitua pela sua chave REAL

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Função auxiliar para checar se a config é válida
export const isSupabaseConfigured = () => {
  return SUPABASE_URL && !SUPABASE_URL.includes('SUA-URL') && SUPABASE_ANON_KEY.length > 50;
};

