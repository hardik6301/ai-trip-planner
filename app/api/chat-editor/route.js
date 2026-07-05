// Import NextResponse to send structured HTTP responses from the API route
import { NextResponse } from "next/server";
// Import the shared Gemini client initialization from lib
import { getGeminiModel } from "@/lib/gemini";
// Import the JSON parser that strips markdown fences from Gemini output
import { parseGeminiJson } from "@/lib/parseGeminiJson";
// Import the server Supabase client to verify the user session
import { createClient } from "@/lib/supabase/server";
// Import the Pro status helper that reads profiles.is_pro
import { fetchUserProStatus, isProUser } from "@/lib/userPlan";

/**
 * POST /api/chat-editor
 * AI Chat Editor — edits an itinerary based on a natural language request.
 * Pro-only feature; enforced server-side.
 */
export async function POST(request) {
  try {
    // Bind Supabase to the current request cookies
    const supabase = await createClient();

    // Resolve the logged-in user from the session
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Reject unauthenticated requests
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up Pro status from the profiles table
    const { isPro, profile } = await fetchUserProStatus(supabase, user.id);

    // Block free users — the chat editor is a Pro feature
    if (!isPro && !isProUser(user, profile)) {
      return NextResponse.json(
        {
          error: "AI Chat Editor is a Pro feature. Upgrade to unlock it.",
          code: "PRO_REQUIRED",
        },
        { status: 403 }
      );
    }

    // Parse the JSON body sent by the chat panel
    const body = await request.json();
    // Extract the user's message, the current itinerary, and the destination
    const { message, currentItinerary, destination } = body;

    // Validate that all required fields are present
    if (!message?.trim() || !currentItinerary?.days?.length || !destination) {
      return NextResponse.json(
        { error: "Missing required fields: message, currentItinerary, destination" },
        { status: 400 }
      );
    }

    // Cap message length to keep prompts sane
    const userMessage = String(message).trim().slice(0, 500);

    // Get the configured Gemini model instance
    const model = getGeminiModel();

    // Ensure the API key is configured before making a request
    if (!model) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Build the edit prompt — Gemini must return the full updated itinerary
    const prompt = `You are an AI travel assistant editing a trip itinerary.

Current itinerary for ${destination}:
${JSON.stringify(currentItinerary)}

User request: ${userMessage}

Instructions:
- Understand what the user wants to change
- Return the COMPLETE updated itinerary JSON
- Keep the EXACT same JSON structure as the input
- Only modify what the user asked to change
- If the user asks about one day, only change that day
- If the user asks about all days, change all days
- Keep the same number of days unless explicitly asked to add or remove days
- Costs stay formatted as strings with currency symbols (e.g. "₹500", "$20")
- If the request is a question or is not an itinerary change, keep the itinerary unchanged and answer in changeSummary

Return ONLY valid JSON, no markdown, no explanation, in this exact wrapper:
{
  "itinerary": { ...complete updated itinerary with the exact same structure as the input... },
  "changeSummary": "One short friendly sentence describing what you changed (or your answer if nothing changed)"
}`;

    // Send the prompt to Gemini and await the generated response
    const result = await model.generateContent(prompt);
    // Extract the raw text content from Gemini's response
    const responseText = result.response.text();

    // Parse the cleaned response into a JavaScript object
    const parsed = parseGeminiJson(responseText);

    // Support both wrapped ({itinerary, changeSummary}) and bare itinerary replies
    const updatedItinerary = parsed.itinerary?.days ? parsed.itinerary : parsed;
    // Pull the change summary, with a safe fallback message
    const changeSummary =
      parsed.changeSummary || "I've updated your itinerary as requested.";

    // Validate the updated itinerary still has a usable days array
    if (!Array.isArray(updatedItinerary.days) || updatedItinerary.days.length === 0) {
      throw new Error("AI returned an invalid itinerary structure");
    }

    // Preserve client-side fields Gemini shouldn't touch (meta, regen counter)
    const merged = {
      ...currentItinerary,
      ...updatedItinerary,
      destination: currentItinerary.destination,
      tripMeta: currentItinerary.tripMeta,
      regenerationsUsed: currentItinerary.regenerationsUsed,
    };

    // Return the updated itinerary and the human-readable summary
    return NextResponse.json({ itinerary: merged, changeSummary });
  } catch (error) {
    // Log the error for server-side debugging
    console.error("Chat editor error:", error);

    // Return a 500 error with a descriptive message for the chat panel
    return NextResponse.json(
      { error: "Failed to update itinerary", details: error.message },
      { status: 500 }
    );
  }
}
