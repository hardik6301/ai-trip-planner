import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/profile/cancel-pro
 * Downgrades user to Free. Keeps pro_since + subscription_id for payment history.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("is_pro")
      .eq("id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Cancel pro fetch error:", fetchError);
      return NextResponse.json(
        { error: "Failed to load profile", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!profile?.is_pro) {
      return NextResponse.json(
        { error: "You are already on the Free plan" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_pro: false })
      .eq("id", user.id);

    if (updateError) {
      console.error("Cancel pro update error:", updateError);
      return NextResponse.json(
        { error: "Failed to cancel Pro", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel pro error:", error);
    return NextResponse.json(
      { error: "Failed to cancel Pro", details: error.message },
      { status: 500 }
    );
  }
}
