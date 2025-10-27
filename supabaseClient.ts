import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// We are not defining full DB types here for simplicity, 
// but in a larger project, this would be typed based on the database schema.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);