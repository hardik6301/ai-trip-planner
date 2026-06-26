// Import the Google Generative AI SDK to communicate with the Gemini API
import { GoogleGenerativeAI } from "@google/generative-ai";
// Import NextResponse to send structured HTTP responses from the API route
import { NextResponse } from "next/server";

// Handle POST requests to generate a trip itinerary
export async function POST(request) {
  try {
    // Parse the JSON body from the incoming request
    const body = await request.json();
    // Extract the destination city or region from the request body
    const { destination, days, budget, vibe } = body;

    // Validate that all required fields are present
    if (!destination || !days || !budget || !vibe) {
      // Return a 400 error if any required field is missing
      return NextResponse.json(
        { error: "Missing required fields: destination, days, budget, vibe" },
        { status: 400 }
      );
    }

    // Read the Gemini API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;

    // Ensure the API key is configured before making a request
    if (!apiKey) {
      // Return a 500 error if the API key is not set
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Initialize the Google Generative AI client with the API key
    const genAI = new GoogleGenerativeAI(apiKey);
    // Get the gemini-1.5-flash model instance for fast text generation
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Build the prompt instructing Gemini to return a structured trip itinerary as JSON
    const prompt = `You are a travel planning expert. Create a detailed ${days}-day trip itinerary for ${destination}.

Travel preferences:
- Budget: ${budget}
- Vibe: ${vibe}

Return ONLY valid JSON with no markdown, no code fences, and no extra text. Use this exact structure:

{
  "destination": "${destination}",
  "days": [
    {
      "day": 1,
      "theme": "Arrival & Exploration",
      "morning": { "activity": "...", "place": "...", "cost": "..." },
      "afternoon": { "activity": "...", "place": "...", "cost": "..." },
      "evening": { "activity": "...", "place": "...", "cost": "..." },
      "tips": "one local tip for this day"
    }
  ],
  "totalBudgetEstimate": "...",
  "bestTimeToVisit": "...",
  "packingEssentials": ["item1", "item2", "item3"]
}

Requirements:
- Include exactly ${days} day objects in the "days" array (day 1 through day ${days})
- Use realistic activities, places, and costs for ${destination}
- Match activities to the "${vibe}" vibe and "${budget}" budget
- Costs should be formatted as strings with currency symbols (e.g. "₹500", "$20")
- packingEssentials should include at least 5 relevant items`;

    // Send the prompt to Gemini and await the generated response
    const result = await model.generateContent(prompt);
    // Extract the text content from Gemini's response object
    const responseText = result.response.text();

    // Strip markdown code fences if Gemini wrapped the JSON in them
    const cleanedText = responseText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Parse the cleaned response string into a JavaScript object
    const tripData = JSON.parse(cleanedText);

    // Return the parsed trip itinerary as a JSON response
    return NextResponse.json(tripData);
  } catch (error) {
    // Log the error for server-side debugging
    console.error("Error generating trip:", error);

    // Return a 500 error with descriptive message
    return NextResponse.json(
      { error: "Failed to generate trip itinerary", details: error.message },
      { status: 500 }
    );
  }
}
