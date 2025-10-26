import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// We are not defining full DB types here for simplicity, 
// but in a larger project, this would be typed based on the database schema.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);