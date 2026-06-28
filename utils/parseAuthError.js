/**
 * Parses Supabase OAuth error params from URL hash or search string.
 * Supabase redirects failed logins to the site URL with #error=...&error_description=...
 */

/**
 * @param {string} hash - window.location.hash (includes leading #)
 * @returns {string | null}
 */
export function parseAuthErrorFromHash(hash) {
  if (!hash || hash.length <= 1) return null;

  const params = new URLSearchParams(hash.slice(1));
  const description = params.get("error_description");
  const code = params.get("error_code");

  if (description) {
    return description.replace(/\+/g, " ");
  }

  if (code) {
    return code.replace(/_/g, " ");
  }

  return params.get("error")?.replace(/_/g, " ") ?? null;
}
