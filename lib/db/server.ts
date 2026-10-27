import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let client: SupabaseClient | null = null;

/**
 * Service-role Supabase client. Server only: it bypasses RLS, so it must
 * never be imported from a Client Component.
 */
export function db(): SupabaseClient {
  if (!client) {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-client-info": "pio-production" } },
    });
  }
  return client;
}

/** Custom SQLSTATEs raised by our Postgres functions. */
export const DB_ERRORS = {
  notFound: "PT404",
  conflict: "PT409",
  badInput: "PT422",
} as const;
