// Import NextResponse to send structured HTTP responses
import { NextResponse } from "next/server";
// Import the shared Gemini client initialization
import { getGeminiModel } from "@/lib/gemini";
// Import the server Supabase client to verify the session
import { createClient } from "@/lib/supabase/server";
// Import Pro status helpers — the expense tracker is Pro-only
import { fetchUserProStatus, isProUser } from "@/lib/userPlan";

/**
 * POST /api/expense-insight
 * Generates one short AI insight about the user's trip spending pattern.
 */
export async function POST(request) {
  try {
    // Bind Supabase to the request cookies and resolve the user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Reject unauthenticated requests
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Enforce Pro server-side
    const { isPro, profile } = await fetchUserProStatus(supabase, user.id);
    if (!isPro && !isProUser(user, profile)) {
      return NextResponse.json(
        { error: "Pro feature", code: "PRO_REQUIRED" },
        { status: 403 }
      );
    }

    // Parse spending data sent by the expense tracker page
    const { total, budget, destination, breakdown } = await request.json();

    // Validate the minimum fields needed for a useful insight
    if (total == null || !destination) {
      return NextResponse.json(
        { error: "Missing required fields: total, destination" },
        { status: 400 }
      );
    }

    // Get the configured Gemini model
    const model = getGeminiModel();
    if (!model) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Short, focused prompt — one tip under 20 words
    const prompt = `User has spent ₹${total} on a ${destination} trip with budget ₹${budget || "unknown"}. Categories: ${breakdown || "none yet"}. Give ONE short helpful insight in under 20 words. Plain text only, no markdown, no quotes.`;

    // Ask Gemini for the insight
    const result = await model.generateContent(prompt);
    // Clean up whitespace and stray quotes from the response
    const insight = result.response
      .text()
      .trim()
      .replace(/^["']|["']$/g, "");

    // Return the single-line insight
    return NextResponse.json({ insight });
  } catch (error) {
    // Log server-side and return a friendly error
    console.error("Expense insight error:", error);
    return NextResponse.json(
      { error: "Failed to generate insight", details: error.message },
      { status: 500 }
    );
  }
}
