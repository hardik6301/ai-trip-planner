/**
 * Pro plan helpers — reads is_pro from profiles + legacy auth metadata.
 */

/** True when a profiles row marks the user as Pro */
export function isProFromProfile(profile) {
  return profile?.is_pro === true;
}

/** True when auth user metadata indicates Pro (legacy fallback) */
export function isProUser(user, profile = null) {
  if (isProFromProfile(profile)) return true;
  if (!user) return false;
  return (
    user.user_metadata?.plan === "pro" || user.app_metadata?.is_pro === true
  );
}

/**
 * Fetch Pro status from the profiles table.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} userId
 */
export async function fetchUserProStatus(supabase, userId) {
  if (!userId) {
    return { isPro: false, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "is_pro, pro_since, subscription_id, full_name, email, avatar_url, currency, newsletter_opt_in"
    )
    .eq("id", userId)
    .maybeSingle();

  return {
    isPro: isProFromProfile(profile),
    profile,
  };
}
