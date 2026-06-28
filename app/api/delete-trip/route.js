// Import NextResponse for sending JSON HTTP responses from the API route
import { NextResponse } from "next/server";
// Import the server Supabase client to verify the authenticated user
import { createClient } from "@/lib/supabase/server";

// Handle DELETE requests to remove a saved trip owned by the current user
export async function DELETE(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing trip id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("trips")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting trip:", error);
      return NextResponse.json(
        { error: "Failed to delete trip", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete trip error:", error);
    return NextResponse.json(
      { error: "Failed to delete trip", details: error.message },
      { status: 500 }
    );
  }
}
