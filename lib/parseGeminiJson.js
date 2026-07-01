/**
 * Strip markdown fences and parse JSON from a Gemini text response.
 */
export function parseGeminiJson(text) {
  const cleaned = String(text)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}
