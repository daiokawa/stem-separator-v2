import { createClient } from '@supabase/supabase-js';

export function createSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceRole) throw new Error('Supabase env not configured');
  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}

