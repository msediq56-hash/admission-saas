import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with service role key.
 * Use ONLY in server-side API routes for admin operations
 * like creating auth users.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
