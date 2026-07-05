/**
 * Server-side Pro plan limits — enforced in API routes, not just UI.
 */

import {
  FREE_REGENERATIONS_PER_TRIP,
  FREE_TRIP_LIMIT,
} from "@/constants/tripOptions";
import { fetchUserProStatus } from "@/lib/userPlan";

/**
 * Check whether the user may save another trip.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} userId
 */
export async function checkTripSaveAllowed(supabase, userId) {
  const { isPro } = await fetchUserProStatus(supabase, userId);

  if (isPro) {
    return { allowed: true, isPro: true, tripCount: 0 };
  }

  const { count, error } = await supabase
    .from("trips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const tripCount = count ?? 0;

  if (tripCount >= FREE_TRIP_LIMIT) {
    return {
      allowed: false,
      isPro: false,
      tripCount,
      code: "TRIP_LIMIT_REACHED",
      message: `Free plan allows ${FREE_TRIP_LIMIT} saved trips. Upgrade to Pro for unlimited.`,
    };
  }

  return { allowed: true, isPro: false, tripCount };
}

/**
 * Check whether the user may regenerate another day on this trip.
 * Uses DB itinerary counter when tripId is provided (source of truth).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} userId
 * @param {{ tripId?: string, regenerationsUsed?: number }} options
 */
export async function checkRegenerationAllowed(
  supabase,
  userId,
  { tripId, regenerationsUsed = 0 } = {}
) {
  const { isPro } = await fetchUserProStatus(supabase, userId);

  if (isPro) {
    return { allowed: true, isPro: true, regenerationsUsed: 0 };
  }

  let used = Math.max(0, Number(regenerationsUsed) || 0);

  if (tripId) {
    const { data: trip, error } = await supabase
      .from("trips")
      .select("itinerary")
      .eq("id", tripId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (trip?.itinerary?.regenerationsUsed != null) {
      used = Math.max(used, Number(trip.itinerary.regenerationsUsed) || 0);
    }
  }

  if (used >= FREE_REGENERATIONS_PER_TRIP) {
    return {
      allowed: false,
      isPro: false,
      regenerationsUsed: used,
      code: "REGENERATION_LIMIT_REACHED",
      message: `Free plan allows ${FREE_REGENERATIONS_PER_TRIP} day regenerations per trip. Upgrade to Pro for unlimited.`,
    };
  }

  return { allowed: true, isPro: false, regenerationsUsed: used };
}

/**
 * Count saved trips for a user (used by client dashboards).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} userId
 */
export async function countUserTrips(supabase, userId) {
  const { count, error } = await supabase
    .from("trips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}
