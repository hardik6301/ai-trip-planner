/** True when the Supabase user has an active Pro plan. */
export function isProUser(user) {
  if (!user) return false;
  return (
    user.user_metadata?.plan === "pro" || user.app_metadata?.is_pro === true
  );
}
