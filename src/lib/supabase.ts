import {createClient} from '@supabase/supabase-js';
const env=import.meta.env;
export const demo=env.VITE_DEMO_MODE==='true';
export const configured=!!env.VITE_SUPABASE_URL&&!!env.VITE_SUPABASE_ANON_KEY;
export const supabase=configured&&!demo?createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null;
