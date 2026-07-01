/**
 * Load a saved trip for /trip/[id] — works for owners (logged in) and public share links.
 */

import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";

const TRIP_SELECT =
  "id, user_id, destination, days, budget, vibe, itinerary, created_at";

async function queryTrip(client, id) {
  if (!client) return null;

  const { data, error } = await client
    .from("trips")
    .select(TRIP_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error && process.env.NODE_ENV === "development") {
    console.error("[fetchTripById]", error.message);
  }

  return data ?? null;
}

/**
 * @param {string} id — sanitized trip UUID
 * @returns {Promise<object|null>}
 */
export async function fetchTripById(id) {
  // 1. Logged-in owner (My Trips → View Itinerary)
  const authTrip = await queryTrip(await createClient(), id);
  if (authTrip) return authTrip;

  // 2. Anon public read (needs 007_public_trip_share.sql in Supabase)
  const publicTrip = await queryTrip(createPublicClient(), id);
  if (publicTrip) return publicTrip;

  // 3. Server fallback — set SUPABASE_SERVICE_ROLE_KEY in .env.local
  const adminTrip = await queryTrip(createAdminClient(), id);
  return adminTrip;
}
