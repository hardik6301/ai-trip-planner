// Import NextResponse for sending JSON HTTP responses from the API route
import { NextResponse } from "next/server";
// Import the server Supabase client to read the authenticated user session
import { createClient } from "@/lib/supabase/server";

/**
 * Ensures a profiles row exists for the user.
 * trips.user_id FK references profiles.id, not auth.users directly.
 */
async function ensureProfile(supabase, user) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      full_name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        null,
      avatar_url: user.user_metadata?.avatar_url || null,
    },
    { onConflict: "id" }
  );

  return error;
}

// Handle POST requests to save a generated trip itinerary to the database
export async function POST(request) {
  try {
    // Create a Supabase client bound to the current request cookies
    const supabase = await createClient();

    // Read the authenticated user from the session
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Reject the request if no user is signed in
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure profile row exists before saving trip (FK: trips.user_id → profiles.id)
    const profileError = await ensureProfile(supabase, user);
    if (profileError) {
      console.error("Error ensuring profile:", profileError);
      return NextResponse.json(
        {
          error: "Failed to save trip",
          details:
            "Your profile is missing. Run supabase/migrations/004_backfill_profiles.sql in Supabase SQL Editor.",
        },
        { status: 500 }
      );
    }

    // Parse the JSON body from the incoming request
    const body = await request.json();

    // Extract the trip fields required by the trips table
    const { destination, days, budget, vibe, itinerary } = body;

    // Validate that all required fields are present
    if (!destination || days == null || !budget || !vibe || !itinerary) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: destination, days, budget, vibe, itinerary",
        },
        { status: 400 }
      );
    }

    // Insert the trip row linked to the authenticated user's id
    const { data, error } = await supabase
      .from("trips")
      .insert({
        user_id: user.id,
        destination,
        days: Number(days),
        budget,
        vibe,
        itinerary,
      })
      .select("id, destination, days, budget, vibe, created_at")
      .single();

    // Return a 500 error if the database insert failed
    if (error) {
      console.error("Error saving trip:", error);
      return NextResponse.json(
        { error: "Failed to save trip", details: error.message },
        { status: 500 }
      );
    }

    // Return the newly saved trip including its generated id
    return NextResponse.json({ trip: data }, { status: 201 });
  } catch (error) {
    // Log and return a generic server error for unexpected failures
    console.error("Save trip error:", error);
    return NextResponse.json(
      { error: "Failed to save trip", details: error.message },
      { status: 500 }
    );
  }
}
