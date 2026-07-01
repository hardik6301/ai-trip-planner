import { NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";
import { parseGeminiJson } from "@/lib/parseGeminiJson";

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      destination,
      budget,
      vibe,
      dayNumber,
      currentDay,
      totalDays,
      travelMonth,
      feedback,
    } = body;

    if (
      !destination ||
      !budget ||
      !vibe ||
      dayNumber == null ||
      !currentDay ||
      !totalDays
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: destination, budget, vibe, dayNumber, currentDay, totalDays",
        },
        { status: 400 }
      );
    }

    const model = getGeminiModel();
    if (!model) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const monthContext = travelMonth
      ? `\nTravel month: ${travelMonth}. Factor in seasonal weather and events.`
      : "";

    const feedbackContext = feedback
      ? `\nUser feedback for this day: "${feedback}". Honor this preference.`
      : "";

    const prompt = `You are a travel planning expert. Regenerate ONLY day ${dayNumber} of a ${totalDays}-day trip to ${destination}.

Travel preferences:
- Budget: ${budget}
- Vibe: ${vibe}${monthContext}${feedbackContext}

Current day ${dayNumber} (replace entirely — use different activities and places):
${JSON.stringify(currentDay, null, 2)}

Return ONLY valid JSON for a single day object. No markdown, no code fences, no extra text.

{
  "day": ${dayNumber},
  "theme": "...",
  "morning": { "activity": "...", "place": "...", "cost": "...", "description": "2-3 sentence description", "duration": "2 hrs", "category": "Easy" },
  "afternoon": { "activity": "...", "place": "...", "cost": "...", "description": "2-3 sentence description", "duration": "3 hrs", "category": "Moderate" },
  "evening": { "activity": "...", "place": "...", "cost": "...", "description": "2-3 sentence description", "duration": "2 hrs", "category": "Dinner" },
  "summary": "One sentence overview of the day theme",
  "tips": "one local tip for this day"
}

Requirements:
- Provide fresh activities — do not repeat places from the current day above
- Match the "${vibe}" vibe and "${budget}" budget
- Use realistic places and costs for ${destination}
- Costs as strings with currency symbols (e.g. "₹500", "$20")
- Keep "day" as ${dayNumber}`;

    const result = await model.generateContent(prompt);
    const day = parseGeminiJson(result.response.text());

    if (!day?.day || !day.morning || !day.afternoon || !day.evening) {
      return NextResponse.json(
        { error: "Invalid day structure returned from AI" },
        { status: 500 }
      );
    }

    day.day = Number(dayNumber);

    return NextResponse.json({ day });
  } catch (error) {
    console.error("Error regenerating day:", error);
    return NextResponse.json(
      { error: "Failed to regenerate day", details: error.message },
      { status: 500 }
    );
  }
}
