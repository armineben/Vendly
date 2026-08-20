import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://lhuwgivsexzfpftioweg.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxodXdnaXZzZXh6ZnBmdGlvd2VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNzQzNDksImV4cCI6MjA5OTg1MDM0OX0.mAuL5uDAN3SDSlJ6s7mikReorzH_USu_rH-Tl2CfYOA"; 

export const supabase = createClient(supabaseUrl, supabaseKey);