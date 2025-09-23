import { createClient } from '@supabase/supabase-js'

// --- CORE FIX: Use standard quotes, not smart quotes ---
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);