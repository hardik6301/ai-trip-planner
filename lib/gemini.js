/**
 * Gemini AI client initialization for server-side trip generation.
 * Isolates Google Generative AI setup so the API route stays focused on request handling.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

/** Gemini model identifier used for fast itinerary generation */
export const GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Creates and returns a configured Gemini generative model instance.
 * @returns {import("@google/generative-ai").GenerativeModel | null} Model instance, or null if API key is missing
 */
export function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: GEMINI_MODEL });
}
