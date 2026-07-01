import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** PATCH — update itinerary JSON for a saved trip owned by the current user */
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
    const { id, itinerary } = body;

    if (!id || !itinerary) {
      return NextResponse.json(
        { error: "Missing required fields: id, itinerary" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("trips")
      .update({ itinerary })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update trip error:", error);
    return NextResponse.json(
      { error: "Failed to update trip", details: error.message },
      { status: 500 }
    );
  }
}
