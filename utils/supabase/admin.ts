import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Prefer service role for server-side writes; fall back to anon if not set
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});


