import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client initialized with the service role key.
 * Used exclusively in API routes / Server Actions to perform validated,
 * privileged workflows according to DATABASE_WIRING.md.
 */
export function createServerAdminClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "";

  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || "";

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "SUPABASE_URL or SUPABASE_SECRET_KEY is missing on server runtime."
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
