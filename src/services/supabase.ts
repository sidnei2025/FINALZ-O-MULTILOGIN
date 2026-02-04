
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Estas variáveis são injetadas automaticamente no ambiente
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
