/**
 * Server-side Supabase client for Server Components, API routes, and Route Handlers.
 * Uses createServerClient from @supabase/ssr with Next.js cookies so sessions
 * can be read and refreshed on the server (e.g. OAuth callback, protected routes).
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Creates a Supabase client bound to the current request's cookies.
 * @returns {Promise<import("@supabase/supabase-js").SupabaseClient>}
 */
export async function createClient() {
  // Read the cookie store for the incoming server request
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
        // Pass all auth cookies to Supabase for session lookup
        getAll() {
          return cookieStore.getAll();
        },
        // Write refreshed session cookies back to the response
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll may fail in Server Components; middleware handles refresh
          }
        },
      },
  });
}
