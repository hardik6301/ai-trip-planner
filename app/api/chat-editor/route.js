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
import { canEditTripAccess, getTripAccess } from "@/lib/tripAccess";
import {
  parseTravelProfile,
  travelerPromptRules,
} from "@/lib/travelProfile";

/**
 * POST /api/chat-editor
 * AI Chat Editor — edits an itinerary based on a natural language request.
 * Pro-only; for saved trips also requires owner or editor membership.
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
    const { message, currentItinerary, destination, tripId } = body;

    // Saved collaborative trips — editors may use AI; viewers may not
    if (tripId) {
      const access = await getTripAccess(supabase, tripId, user.id);
      if (!access) {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 });
      }
      if (!canEditTripAccess(access)) {
        return NextResponse.json(
          {
            error: "You need an edit invite to change this trip with AI.",
            code: "EDIT_REQUIRED",
          },
          { status: 403 }
        );
      }
    }

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

    const vibeHint =
      currentItinerary?.tripMeta?.vibe ||
      currentItinerary?.travelProfile?.raw ||
      "";
    const travelerRules = vibeHint ? travelerPromptRules(vibeHint) : "";

    // Build the edit prompt — coach Swap / Reorder / Constraint regenerate explicitly
    const prompt = `You are Travora's flagship AI itinerary editor.

Current itinerary for ${destination}:
${JSON.stringify(currentItinerary)}

User request: ${userMessage}
${travelerRules}

Core rules:
- Return the COMPLETE updated itinerary JSON with the EXACT same structure
- Only change what the user asked for
- Default to editing a single day when a day is mentioned; otherwise infer the most relevant day
- Keep the same number of days unless explicitly asked to add/remove days
- Preserve currency style already used in the itinerary (฿, ₹, $, etc.)
- After any activity change, update that activity's "cost" string so day totals stay realistic
- Preserve travelProfile and tripMeta unless the user explicitly changes traveler type (Solo/Couple/Family/Friends)
- If the user changes traveler type, update travelProfile AND rewrite affected copy so metadata and descriptions stay in sync
- Never invent family/kids language for a Solo or Couple profile
- If the request is only a question (no edit), keep itinerary unchanged and answer in changeSummary

Guided edit types (apply when the user intent matches):

1) SWAP activity
- Replace the named period (morning/afternoon/evening) or the closest matching activity
- New activity must fit the destination, day theme, and traveler profile
- Keep duration in a similar range when possible
- Always set a fresh cost string for the swapped activity

2) REORDER day
- Reorder morning/afternoon/evening (or reshuffle activities across those slots) for logistics, heat, energy, or user preference
- Prefer keeping the same places/activities unless the user asks to change them
- Update descriptions only if the new sequence needs it; keep costs attached to the same activities

3) REGENERATE around a constraint (budget / time / weather)
- Rebuild the targeted day (or period) under the stated constraint
- Budget: prefer cheaper options, lower costs, note savings in changeSummary
- Time: shorten durations, fewer transitions, tighter schedule
- Weather: favor indoor/covered vs outdoor as appropriate; mention the weather assumption in changeSummary
- Keep the day theme and traveler profile when possible

Return ONLY valid JSON, no markdown, in this wrapper:
{
  "itinerary": { ...complete updated itinerary with the exact same structure as the input... },
  "changeSummary": "One short friendly sentence describing the edit type and what changed"
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
    // Keep travelProfile in sync with vibe if the model omitted it
    const vibeForProfile =
      updatedItinerary.tripMeta?.vibe ||
      currentItinerary.tripMeta?.vibe ||
      updatedItinerary.travelProfile?.raw ||
      currentItinerary.travelProfile?.raw ||
      "";
    const merged = {
      ...currentItinerary,
      ...updatedItinerary,
      destination: currentItinerary.destination,
      tripMeta: currentItinerary.tripMeta,
      regenerationsUsed: currentItinerary.regenerationsUsed,
      travelProfile:
        updatedItinerary.travelProfile ||
        currentItinerary.travelProfile ||
        (vibeForProfile ? parseTravelProfile(vibeForProfile) : undefined),
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
