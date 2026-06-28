/**
 * Normalizes Supabase environment variables for client, server, and middleware.
 * Accepts either a full URL or a bare project ref (e.g. "abcxyz" → "https://abcxyz.supabase.co").
 */

/**
 * Returns a valid Supabase project URL from env.
 * @returns {string}
 */
export function getSupabaseUrl() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!raw) {
    return "";
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw.replace(/\/$/, "");
  }

  return `https://${raw}.supabase.co`;
}

/**
 * Returns the Supabase anon key from env, trimmed of whitespace.
 * @returns {string}
 */
export function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
}
