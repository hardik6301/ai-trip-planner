import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/trip-edit-link/redeem
 * Body: { token }
 * Logged-in user redeems a revocable edit_token → trip_members.role = editor
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await request.json();
    const editToken = String(token || "").trim();
    if (!editToken || editToken.length < 16) {
      return NextResponse.json({ error: "Invalid edit token" }, { status: 400 });
    }

    // Lookup by token needs a client that can find the row; use admin if RLS hides it
    const admin = createAdminClient();
    const reader = admin || supabase;

    const { data: trip, error: tripError } = await reader
      .from("trips")
      .select("id, user_id, destination, edit_token")
      .eq("edit_token", editToken)
      .maybeSingle();

    if (tripError) {
      return NextResponse.json(
        {
          error: "Failed to redeem invite",
          details:
            tripError.message +
            " — run supabase/migrations/014_trip_collaboration.sql if you have not.",
        },
        { status: 500 }
      );
    }

    if (!trip) {
      return NextResponse.json(
        { error: "This edit invite is invalid or has been revoked." },
        { status: 404 }
      );
    }

    // Owner redeeming their own link — no membership needed
    if (trip.user_id === user.id) {
      return NextResponse.json({
        tripId: trip.id,
        role: "owner",
        destination: trip.destination,
        alreadyMember: true,
      });
    }

    // Ensure profile exists for FK
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        full_name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          null,
      },
      { onConflict: "id" }
    );

    const writer = admin || supabase;
    const { data: membership, error: memberError } = await writer
      .from("trip_members")
      .upsert(
        {
          trip_id: trip.id,
          user_id: user.id,
          role: "editor",
        },
        { onConflict: "trip_id,user_id" }
      )
      .select("role")
      .single();

    if (memberError) {
      console.error("Redeem membership error:", memberError);
      return NextResponse.json(
        { error: "Failed to join trip as editor", details: memberError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tripId: trip.id,
      role: membership.role,
      destination: trip.destination,
      alreadyMember: false,
    });
  } catch (error) {
    console.error("Redeem edit link error:", error);
    return NextResponse.json(
      { error: "Failed to redeem invite", details: error.message },
      { status: 500 }
    );
  }
}
