/**
 * Place-aware image helpers.
 * Prefer /api/place-image for real landmark photos; these keyword maps are fallback only.
 */

const KEYWORD_IMAGES = [
  {
    keys: ["airport", "transfer", "departure", "arrival"],
    url: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["beach", "island", "coast", "railay", "phi phi"],
    url: "https://images.unsplash.com/photo-1552465011-5c7f7add9763?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["temple", "wat", "shrine", "palace", "mosque", "church"],
    url: "https://images.unsplash.com/photo-1528181304800-259f0f793548?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["market", "bazaar", "shopping", "mall"],
    url: "https://images.unsplash.com/photo-1563492065-ba176002b0a4?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["food", "dinner", "restaurant", "street food", "dining"],
    url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["mountain", "alps", "hike", "trek", "peak", "glacier"],
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["museum", "gallery"],
    url: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&h=400&fit=crop&q=80",
  },
];

const DESTINATION_IMAGES = {
  bangkok: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&h=400&fit=crop&q=80",
  krabi: "https://images.unsplash.com/photo-1552465011-5c7f7add9763?w=400&h=400&fit=crop&q=80",
  thailand: "https://images.unsplash.com/photo-1528181304800-259f0f793548?w=400&h=400&fit=crop&q=80",
  bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&h=400&fit=crop&q=80",
  paris: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&h=400&fit=crop&q=80",
  dubai: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&h=400&fit=crop&q=80",
  goa: "https://images.unsplash.com/photo-1512343879784-a960bf128e93?w=400&h=400&fit=crop&q=80",
  manali: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400&h=400&fit=crop&q=80",
  zermatt: "https://images.unsplash.com/photo-1530122037263-a5f1f91d3b99?w=400&h=400&fit=crop&q=80",
};

const FALLBACK =
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=400&fit=crop&q=80";

/** Sync keyword fallback when live place lookup fails */
export function getPlaceImage(place, activity, destination = "") {
  const haystack = `${place} ${activity} ${destination}`.toLowerCase();

  for (const entry of KEYWORD_IMAGES) {
    if (entry.keys.some((k) => haystack.includes(k))) {
      return entry.url;
    }
  }

  const destLower = String(destination || "").toLowerCase();
  for (const [key, url] of Object.entries(DESTINATION_IMAGES)) {
    if (destLower.includes(key) || haystack.includes(key)) {
      return url;
    }
  }

  return FALLBACK;
}

/**
 * Build search candidates for Wikipedia / Commons from a place string.
 * "Wat Pho & Wat Arun, Bangkok" → ["Wat Pho", "Wat Pho Bangkok", "Wat Arun", ...]
 */
export function buildPlaceImageQueries(place, destination = "") {
  const raw = String(place || "").trim();
  const dest = String(destination || "")
    .split(",")[0]
    .trim();

  if (!raw) return dest ? [dest] : [];

  // Split compound place names ("A & B", "A / B", "A and B")
  const parts = raw
    .split(/\s*(?:&|\/|\band\b)\s*/i)
    .map((p) => p.replace(/\([^)]*\)/g, "").trim())
    .filter((p) => p.length >= 3);

  const primary = parts[0] || raw;
  const queries = [];

  for (const part of parts.slice(0, 2)) {
    queries.push(part);
    if (dest && !part.toLowerCase().includes(dest.toLowerCase())) {
      queries.push(`${part} ${dest}`);
    }
  }

  if (dest && !queries.some((q) => q.toLowerCase() === dest.toLowerCase())) {
    queries.push(`${primary} ${dest}`);
  }

  // Deduplicate while preserving order
  return [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
}

export { FALLBACK as PLACE_IMAGE_FALLBACK };
