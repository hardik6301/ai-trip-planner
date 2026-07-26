/**
 * Structured travel preferences derived from the composed vibe string.
 * Keeps Trip Overview + AI generation aligned on traveler type.
 */

import { parseTripVibe } from "@/lib/destinationLive";

const TRAVELER_TYPES = ["Solo", "Couple", "Family", "Friends"];

/**
 * @param {string} vibeString — e.g. "Family trip. Adventure. Interests: Beaches, Photography"
 * @returns {{ travelerType: string|null, style: string|null, interests: string[], raw: string }}
 */
export function parseTravelProfile(vibeString) {
  const raw = String(vibeString || "").trim();
  const { styleParts, interests } = parseTripVibe(raw);

  let travelerType = null;
  const remaining = [];

  for (const part of styleParts) {
    const match = part.match(/^(Solo|Couple|Family|Friends)(?:\s+trip)?$/i);
    if (match && !travelerType) {
      travelerType =
        TRAVELER_TYPES.find(
          (t) => t.toLowerCase() === match[1].toLowerCase()
        ) || match[1];
    } else {
      remaining.push(part);
    }
  }

  return {
    travelerType,
    style: remaining[0] || null,
    interests,
    raw,
  };
}

/** Human label for Overview "Travelers" row */
export function formatTravelersLabel(profile) {
  switch (profile?.travelerType) {
    case "Solo":
      return "Solo traveler";
    case "Couple":
      return "Couple";
    case "Family":
      return "Family (with kids)";
    case "Friends":
      return "Friends";
    default:
      return "Travelers TBD";
  }
}

/** Short style line for Trip Type block */
export function formatTripTypeLine(profile) {
  if (!profile) return "";
  const bits = [];
  if (profile.travelerType) bits.push(`${profile.travelerType} trip`);
  if (profile.style) bits.push(profile.style);
  return bits.join(" · ");
}

/**
 * Prompt block that forces Gemini to honor traveler type.
 * Prevents Solo metadata with family-with-kids copy (and the reverse).
 */
export function travelerPromptRules(vibeString) {
  const profile = parseTravelProfile(vibeString);
  const type = profile.travelerType || "unspecified";

  const antiPatterns = {
    Solo:
      "Do NOT mention kids, children, family-friendly, or 'whole family'. Write for one adult traveler.",
    Couple:
      "Write for two adults traveling together. Do NOT center kids/children unless asked.",
    Family:
      "Write for adults traveling with children. Prefer family-friendly pacing and activities.",
    Friends:
      "Write for a friends group. Do NOT assume kids unless asked.",
  };

  const rule =
    antiPatterns[type] ||
    "Match the traveler type stated in the vibe string exactly.";

  return `
Traveler profile (MUST match in every activity description):
- Type: ${type}
- Style: ${profile.style || "as stated in vibe"}
- Interests: ${profile.interests.length ? profile.interests.join(", ") : "general"}
- ${rule}
- Never contradict this profile in themes, tips, or descriptions.`;
}

/** Prefer itinerary.travelProfile, else derive from vibe */
export function resolveTravelProfile(tripData, vibeFallback) {
  const stored = tripData?.travelProfile;
  if (stored?.travelerType || stored?.style || stored?.interests?.length) {
    return {
      travelerType: stored.travelerType || null,
      style: stored.style || null,
      interests: Array.isArray(stored.interests) ? stored.interests : [],
      raw: stored.raw || vibeFallback || "",
    };
  }
  return parseTravelProfile(
    vibeFallback || tripData?.tripMeta?.vibe || ""
  );
}
