/**
 * Trip access helpers — owner (trips.user_id) or trip_members editor.
 * Additive: trips with no members still work as single-owner.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} tripId
 * @param {string} userId
 * @returns {Promise<{ role: 'owner'|'editor'|'viewer', canEdit: boolean, trip: object } | null>}
 */
export async function getTripAccess(supabase, tripId, userId) {
  if (!supabase || !tripId || !userId) return null;

  const { data: trip, error } = await supabase
    .from("trips")
    .select(
      "id, user_id, destination, days, budget, vibe, itinerary, itinerary_version, edit_token, edit_token_created_at, created_at"
    )
    .eq("id", tripId)
    .maybeSingle();

  if (error || !trip) return null;

  if (trip.user_id === userId) {
    return { role: "owner", canEdit: true, trip };
  }

  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (member?.role === "editor" || member?.role === "owner") {
    return { role: member.role, canEdit: true, trip };
  }

  return { role: "viewer", canEdit: false, trip };
}

/** True when the user may mutate itinerary (owner or editor) */
export function canEditTripAccess(access) {
  return Boolean(access?.canEdit);
}
