/**
 * Server-only Supabase admin client (bypasses RLS).
 * Used as a fallback for public shared trip links when anon RLS is not configured.
 * Set SUPABASE_SERVICE_ROLE_KEY in .env.local — never expose to the browser.
 */

import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase/env";

export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) return null;

  return createClient(getSupabaseUrl(), serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
