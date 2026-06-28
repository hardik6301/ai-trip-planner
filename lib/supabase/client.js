/**
 * Browser-side Supabase client for Client Components (login, signup, etc.).
 * Uses createBrowserClient from @supabase/ssr so auth state is stored in cookies
 * and stays in sync with the server middleware and API routes.
 */

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Creates a Supabase client for use in the browser.
 * @returns {import("@supabase/supabase-js").SupabaseClient}
 */
export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
