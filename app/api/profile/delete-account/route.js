import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * DELETE /api/profile/delete-account
 * Permanently removes the user's trips, profile, and auth account.
 * Requires SUPABASE_SERVICE_ROLE_KEY on the server.
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        {
          error:
            "Account deletion is not configured. Add SUPABASE_SERVICE_ROLE_KEY to enable it.",
        },
        { status: 503 }
      );
    }

    // Remove saved trips first (FK may reference profiles)
    const { error: tripsError } = await admin
      .from("trips")
      .delete()
      .eq("user_id", user.id);

    if (tripsError) {
      console.error("Delete trips error:", tripsError);
      return NextResponse.json(
        { error: "Failed to delete travel history", details: tripsError.message },
        { status: 500 }
      );
    }

    // Remove avatar files from storage
    const { data: avatarFiles } = await admin.storage
      .from("avatars")
      .list(user.id);

    if (avatarFiles?.length) {
      const paths = avatarFiles.map((f) => `${user.id}/${f.name}`);
      await admin.storage.from("avatars").remove(paths);
    }

    // Profile row cascades when auth user is deleted, but delete explicitly
    await admin.from("profiles").delete().eq("id", user.id);

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      console.error("Delete auth user error:", deleteUserError);
      return NextResponse.json(
        { error: "Failed to delete account", details: deleteUserError.message },
        { status: 500 }
      );
    }

    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "Failed to delete account", details: error.message },
      { status: 500 }
    );
  }
}
