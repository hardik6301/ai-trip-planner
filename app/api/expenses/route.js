import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditTripAccess, getTripAccess } from "@/lib/tripAccess";
import { fetchUserProStatus, isProUser } from "@/lib/userPlan";

/**
 * GET /api/expenses?tripId= — list + total for Trip Spend
 * POST /api/expenses — { tripId, amount, category, note?, dayNumber?, expenseDate? }
 * Requires caller's own Pro + trip edit access (owner or editor). Same gate as AI Chat.
 */

const DEFAULT_CATEGORY = "Other";

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

    const access = await getTripAccess(supabase, tripId, user.id);
    if (!access || !canEditTripAccess(access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, trip_id, user_id, created_by, category, amount, note, expense_date, day_number, activity_key, activity_label, created_at"
      )
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load expenses", details: error.message },
        { status: 500 }
      );
    }

    const expenses = data ?? [];
    const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    return NextResponse.json({ expenses, total });
  } catch (error) {
    console.error("GET expenses error:", error);
    return NextResponse.json(
      { error: "Failed to load expenses", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const tripId = body.tripId;
    const amount = parseFloat(body.amount);
    const category = String(body.category || DEFAULT_CATEGORY).trim() || DEFAULT_CATEGORY;
    const note = body.note ? String(body.note).trim().slice(0, 200) : null;
    const dayNumber =
      body.dayNumber != null && body.dayNumber !== ""
        ? Number(body.dayNumber)
        : null;

    if (!tripId) {
      return NextResponse.json({ error: "Missing tripId" }, { status: 400 });
    }
    if (!amount || amount <= 0 || Number.isNaN(amount)) {
      return NextResponse.json(
        { error: "Enter an amount greater than 0" },
        { status: 400 }
      );
    }

    const access = await getTripAccess(supabase, tripId, user.id);
    if (!access || !canEditTripAccess(access)) {
      return NextResponse.json(
        { error: "You need edit access to log expenses on this trip" },
        { status: 403 }
      );
    }

    // Per-user Pro (same as AI Chat Editor) — edit access alone is not enough
    const { isPro, profile } = await fetchUserProStatus(supabase, user.id);
    if (!isPro && !isProUser(user, profile)) {
      return NextResponse.json(
        { error: "Expense Tracker is a Pro feature", code: "PRO_REQUIRED" },
        { status: 403 }
      );
    }

    const expenseDate =
      body.expenseDate || new Date().toISOString().slice(0, 10);

    const row = {
      trip_id: tripId,
      user_id: user.id,
      created_by: user.id,
      category,
      amount,
      note,
      expense_date: expenseDate,
      day_number: Number.isFinite(dayNumber) ? dayNumber : null,
    };

    let { data, error } = await supabase
      .from("expenses")
      .insert(row)
      .select()
      .single();

    // created_by / day_number may be missing if migrations not applied
    if (error && /created_by|day_number|column/i.test(error.message || "")) {
      ({ data, error } = await supabase
        .from("expenses")
        .insert({
          trip_id: tripId,
          user_id: user.id,
          category,
          amount,
          note,
          expense_date: expenseDate,
        })
        .select()
        .single());
    }

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to save expense",
          details:
            error.message +
            " — run supabase/migrations/012–016 expense migrations if needed.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ expense: data }, { status: 201 });
  } catch (error) {
    console.error("POST expenses error:", error);
    return NextResponse.json(
      { error: "Failed to save expense", details: error.message },
      { status: 500 }
    );
  }
}
