import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditTripAccess, getTripAccess } from "@/lib/tripAccess";

/** PATCH — update a saved trip (itinerary / name) with optimistic versioning */
export async function PATCH(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, itinerary, destination, expectedVersion } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    const access = await getTripAccess(supabase, id, user.id);
    if (!access) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }
    if (!canEditTripAccess(access)) {
      return NextResponse.json(
        { error: "You do not have permission to edit this trip" },
        { status: 403 }
      );
    }

    const trimmedDestination =
      typeof destination === "string" ? destination.trim().slice(0, 120) : "";

    if (!itinerary && !trimmedDestination) {
      return NextResponse.json(
        { error: "Provide destination and/or itinerary to update" },
        { status: 400 }
      );
    }

    const currentVersion = Number(access.trip.itinerary_version ?? 1);

    // Optimistic concurrency — refresh-based multi-editor safety
    if (
      expectedVersion != null &&
      Number(expectedVersion) !== currentVersion
    ) {
      return NextResponse.json(
        {
          error: "Trip was updated by someone else. Refresh and try again.",
          code: "VERSION_CONFLICT",
          currentVersion,
        },
        { status: 409 }
      );
    }

    const updates = {
      itinerary_version: currentVersion + 1,
    };

    if (trimmedDestination) {
      updates.destination = trimmedDestination;

      if (itinerary) {
        updates.itinerary = { ...itinerary, destination: trimmedDestination };
      } else if (access.trip.itinerary) {
        updates.itinerary = {
          ...access.trip.itinerary,
          destination: trimmedDestination,
        };
      }
    } else if (itinerary) {
      updates.itinerary = itinerary;
    }

    let query = supabase.from("trips").update(updates).eq("id", id);

    // Prefer version match when column exists
    if (access.trip.itinerary_version != null) {
      query = query.eq("itinerary_version", currentVersion);
    }

    const { data, error } = await query
      .select("id, destination, itinerary, itinerary_version, user_id")
      .maybeSingle();

    if (error) {
      console.error("Error updating trip:", error);
      return NextResponse.json(
        { error: "Failed to update trip", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error: "Trip was updated by someone else. Refresh and try again.",
          code: "VERSION_CONFLICT",
          currentVersion,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      trip: data,
      itineraryVersion: data.itinerary_version,
    });
  } catch (error) {
    console.error("Update trip error:", error);
    return NextResponse.json(
      { error: "Failed to update trip", details: error.message },
      { status: 500 }
    );
  }
}
