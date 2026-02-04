import { createClient } from '@supabase/supabase-js';

// URL confirmada pelo print do seu navegador
const SUPABASE_URL = 'https://fkrijejmvtwwtgirlsey.supabase.co'; 

// IMPORTANTE: Insira sua chave real aqui.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrcmlqZWptdnR3d3RnaXJsc2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTgwMTAsImV4cCI6MjA4NTE3NDAxMH0.IOahwdGVSowVMn0FRpz_-EHU8bEv9areX6zY1rM-LdY'; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);