import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchTripById } from "@/lib/fetchTrip";
import { getTripAccess } from "@/lib/tripAccess";
import { sanitizeTripId } from "@/utils/shareTrip";

/**
 * GET /api/trip/[id]
 * Refresh-based sync — returns latest itinerary + version + caller's role.
 */
export async function GET(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = sanitizeTripId(rawId);
    if (!id) {
      return NextResponse.json({ error: "Invalid trip id" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let access = null;
    if (user) {
      access = await getTripAccess(supabase, id, user.id);
    }

    // Fall back to public fetch for viewers / anonymous
    const trip = access?.trip || (await fetchTripById(id));
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const role = access?.role || (user && trip.user_id === user.id ? "owner" : "viewer");
    const canEdit = Boolean(access?.canEdit);

    return NextResponse.json({
      trip: {
        id: trip.id,
        user_id: trip.user_id,
        destination: trip.destination,
        days: trip.days,
        budget: trip.budget,
        vibe: trip.vibe,
        itinerary: trip.itinerary,
        itinerary_version: trip.itinerary_version ?? 1,
        created_at: trip.created_at,
      },
      role,
      canEdit,
      itineraryVersion: trip.itinerary_version ?? 1,
    });
  } catch (error) {
    console.error("GET trip error:", error);
    return NextResponse.json(
      { error: "Failed to load trip", details: error.message },
      { status: 500 }
    );
  }
}
