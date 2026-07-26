import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Owner-only: list editors or remove an editor from trip_members */

async function assertOwner(supabase, tripId, userId) {
  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, user_id")
    .eq("id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { error: error.message, status: 500 };
  }
  if (!trip) {
    return { error: "Only the trip owner can manage editors", status: 403 };
  }
  return { trip };
}

/**
 * GET /api/trip-members?tripId=
 * Returns editors (name/email) for the trip.
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tripId = new URL(request.url).searchParams.get("tripId");
    if (!tripId) {
      return NextResponse.json({ error: "Missing tripId" }, { status: 400 });
    }

    const ownerCheck = await assertOwner(supabase, tripId, user.id);
    if (ownerCheck.error) {
      return NextResponse.json(
        { error: ownerCheck.error },
        { status: ownerCheck.status }
      );
    }

    const { data: members, error } = await supabase
      .from("trip_members")
      .select("user_id, role, created_at")
      .eq("trip_id", tripId)
      .eq("role", "editor")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to load editors",
          details:
            error.message +
            " — run supabase/migrations/014_trip_collaboration.sql if needed.",
        },
        { status: 500 }
      );
    }

    const userIds = (members || []).map((m) => m.user_id);
    let profilesById = {};

    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      profilesById = Object.fromEntries(
        (profiles || []).map((p) => [p.id, p])
      );
    }

    const editors = (members || []).map((m) => {
      const profile = profilesById[m.user_id] || {};
      return {
        userId: m.user_id,
        role: m.role,
        fullName: profile.full_name || null,
        email: profile.email || null,
        joinedAt: m.created_at,
      };
    });

    return NextResponse.json({ editors });
  } catch (error) {
    console.error("List trip members error:", error);
    return NextResponse.json(
      { error: "Failed to load editors", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trip-members
 * Body: { tripId, userId }
 * Removes editor membership. Write access drops immediately via RLS
 * (owner OR trip_members editor) — no policy change required.
 */
export async function DELETE(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tripId, userId } = await request.json();
    if (!tripId || !userId) {
      return NextResponse.json(
        { error: "Missing tripId or userId" },
        { status: 400 }
      );
    }

    const ownerCheck = await assertOwner(supabase, tripId, user.id);
    if (ownerCheck.error) {
      return NextResponse.json(
        { error: ownerCheck.error },
        { status: ownerCheck.status }
      );
    }

    // Never "remove" the trip owner via this endpoint
    if (userId === user.id || userId === ownerCheck.trip.user_id) {
      return NextResponse.json(
        { error: "Cannot remove the trip owner" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("trip_members")
      .delete()
      .eq("trip_id", tripId)
      .eq("user_id", userId)
      .eq("role", "editor")
      .select("user_id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to remove editor", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Editor not found on this trip" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      removedUserId: data.user_id,
    });
  } catch (error) {
    console.error("Remove trip member error:", error);
    return NextResponse.json(
      { error: "Failed to remove editor", details: error.message },
      { status: 500 }
    );
  }
}
