import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** PATCH — update a saved trip (itinerary JSON and/or display name) */
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
    const { id, itinerary, destination } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
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

    const updates = {};

    // Rename — sync destination on the row and inside itinerary JSON
    if (trimmedDestination) {
      updates.destination = trimmedDestination;

      if (itinerary) {
        updates.itinerary = { ...itinerary, destination: trimmedDestination };
      } else {
        const { data: existing } = await supabase
          .from("trips")
          .select("itinerary")
          .eq("id", id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existing?.itinerary) {
          updates.itinerary = {
            ...existing.itinerary,
            destination: trimmedDestination,
          };
        }
      }
    } else if (itinerary) {
      updates.itinerary = itinerary;
    }

    const { data, error } = await supabase
      .from("trips")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, destination, itinerary")
      .single();

    if (error) {
      console.error("Error updating trip:", error);
      return NextResponse.json(
        { error: "Failed to update trip", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, trip: data });
  } catch (error) {
    console.error("Update trip error:", error);
    return NextResponse.json(
      { error: "Failed to update trip", details: error.message },
      { status: 500 }
    );
  }
}
