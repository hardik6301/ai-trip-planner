import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getTripEditInviteUrl } from "@/utils/editInvite";

function newEditToken() {
  return randomBytes(24).toString("base64url");
}

/**
 * POST — owner creates or rotates an edit invite token
 * Body: { tripId }
 * DELETE — owner revokes the edit invite token (existing editors keep access)
 * Body: { tripId }
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

    const { tripId } = await request.json();
    if (!tripId) {
      return NextResponse.json({ error: "Missing tripId" }, { status: 400 });
    }

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, user_id, edit_token")
      .eq("id", tripId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (tripError) {
      return NextResponse.json(
        { error: "Failed to load trip", details: tripError.message },
        { status: 500 }
      );
    }
    if (!trip) {
      return NextResponse.json(
        { error: "Only the trip owner can create an edit link" },
        { status: 403 }
      );
    }

    const token = newEditToken();
    const { data: updated, error } = await supabase
      .from("trips")
      .update({
        edit_token: token,
        edit_token_created_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .eq("user_id", user.id)
      .select("id, edit_token, edit_token_created_at")
      .single();

    if (error) {
      // Column may not exist until migration 014 is applied
      return NextResponse.json(
        {
          error: "Failed to create edit link",
          details:
            error.message +
            " — run supabase/migrations/014_trip_collaboration.sql if you have not.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tripId: updated.id,
      editToken: updated.edit_token,
      editUrl: getTripEditInviteUrl(updated.edit_token),
      createdAt: updated.edit_token_created_at,
      rotated: Boolean(trip.edit_token),
    });
  } catch (error) {
    console.error("Create edit link error:", error);
    return NextResponse.json(
      { error: "Failed to create edit link", details: error.message },
      { status: 500 }
    );
  }
}

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

    const { data: trip, error } = await supabase
      .from("trips")
      .select("id, user_id, edit_token, edit_token_created_at")
      .eq("id", tripId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json({
      tripId: trip.id,
      hasEditLink: Boolean(trip.edit_token),
      editUrl: trip.edit_token ? getTripEditInviteUrl(trip.edit_token) : null,
      createdAt: trip.edit_token_created_at,
    });
  } catch (error) {
    console.error("Get edit link error:", error);
    return NextResponse.json(
      { error: "Failed to load edit link", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tripId } = await request.json();
    if (!tripId) {
      return NextResponse.json({ error: "Missing tripId" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("trips")
      .update({ edit_token: null, edit_token_created_at: null })
      .eq("id", tripId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to revoke edit link", details: error.message },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Edit invite link revoked. Existing editors keep access.",
    });
  } catch (error) {
    console.error("Revoke edit link error:", error);
    return NextResponse.json(
      { error: "Failed to revoke edit link", details: error.message },
      { status: 500 }
    );
  }
}
