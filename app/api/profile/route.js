import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CURRENCY_OPTIONS } from "@/lib/profile";

const PROFILE_FIELDS =
  "id, full_name, email, avatar_url, is_pro, pro_since, subscription_id, currency, newsletter_opt_in";

const VALID_CURRENCIES = new Set(CURRENCY_OPTIONS.map((c) => c.code));

/** GET /api/profile — current user's profile row */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Profile fetch error:", error);
      return NextResponse.json(
        { error: "Failed to load profile", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json(
      { error: "Failed to load profile", details: error.message },
      { status: 500 }
    );
  }
}

/** PATCH /api/profile — update name, avatar, currency, newsletter */
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
    const updates = {};

    if (typeof body.full_name === "string") {
      const name = body.full_name.trim();
      if (!name || name.length > 80) {
        return NextResponse.json(
          { error: "Display name must be 1–80 characters" },
          { status: 400 }
        );
      }
      updates.full_name = name;
    }

    if (typeof body.avatar_url === "string") {
      updates.avatar_url = body.avatar_url.trim() || null;
    }

    if (typeof body.currency === "string") {
      if (!VALID_CURRENCIES.has(body.currency)) {
        return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
      }
      updates.currency = body.currency;
    }

    if (typeof body.newsletter_opt_in === "boolean") {
      updates.newsletter_opt_in = body.newsletter_opt_in;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Ensure profile row exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    let profile;
    let dbError;

    if (existing) {
      const result = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select(PROFILE_FIELDS)
        .single();
      profile = result.data;
      dbError = result.error;
    } else {
      const result = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          ...updates,
        })
        .select(PROFILE_FIELDS)
        .single();
      profile = result.data;
      dbError = result.error;
    }

    if (dbError) {
      console.error("Profile update error:", dbError);
      return NextResponse.json(
        { error: "Failed to update profile", details: dbError.message },
        { status: 500 }
      );
    }

    // Keep auth metadata in sync for navbar + OAuth consistency
    const metaUpdates = {};
    if (updates.full_name) {
      metaUpdates.full_name = updates.full_name;
      metaUpdates.name = updates.full_name;
    }
    if ("avatar_url" in updates) {
      metaUpdates.avatar_url = updates.avatar_url;
    }

    if (Object.keys(metaUpdates).length > 0) {
      const { error: authError } = await supabase.auth.updateUser({
        data: metaUpdates,
      });
      if (authError) {
        console.error("Auth metadata update error:", authError);
      }
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Profile PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update profile", details: error.message },
      { status: 500 }
    );
  }
}
