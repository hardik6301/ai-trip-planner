/**
 * Google Maps helpers for activity card embeds and external links.
 * Uses Maps Embed API when NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY is set;
 * otherwise falls back to a query-based embed URL (no key required).
 */

const EMBED_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY?.trim() || "";

/** Build a search query from place + trip destination for better geocoding */
export function buildMapsQuery(place, destination) {
  const p = String(place || "").trim();
  const d = String(destination || "").trim();
  if (!p) return d;
  if (!d) return p;
  // Avoid duplicating destination if place already includes it
  if (p.toLowerCase().includes(d.split(",")[0].toLowerCase())) return p;
  return `${p}, ${d}`;
}

/** iframe src for an embedded map preview */
export function getGoogleMapsEmbedUrl(place, destination) {
  const q = encodeURIComponent(buildMapsQuery(place, destination));
  if (!q) return null;

  if (EMBED_KEY) {
    return `https://www.google.com/maps/embed/v1/place?key=${EMBED_KEY}&q=${q}&zoom=15`;
  }

  // Fallback — works without an API key for most places
  return `https://maps.google.com/maps?q=${q}&hl=en&z=15&output=embed`;
}

/** External link — opens Google Maps app / site for directions */
export function getGoogleMapsLink(place, destination) {
  const q = encodeURIComponent(buildMapsQuery(place, destination));
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
