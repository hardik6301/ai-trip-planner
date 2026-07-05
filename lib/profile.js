/**
 * Profile helpers — currency options and display labels.
 */

export const CURRENCY_OPTIONS = [
  { code: "INR", label: "INR (₹)" },
  { code: "USD", label: "USD ($)" },
  { code: "EUR", label: "EUR (€)" },
  { code: "GBP", label: "GBP (£)" },
];

/** Map stored currency code to UI label */
export function currencyLabel(code) {
  return CURRENCY_OPTIONS.find((c) => c.code === code)?.label ?? "INR (₹)";
}

/** Resolve display name from profile row + auth user */
export function resolveDisplayName(profile, user) {
  return (
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Traveler"
  );
}

/** Resolve avatar URL from profile row + auth user */
export function resolveAvatarUrl(profile, user) {
  return profile?.avatar_url || user?.user_metadata?.avatar_url || null;
}
