/**
 * Share helpers for public saved trip links (/trip/[id]).
 */

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Strip anything accidentally appended to a trip id (e.g. share message text) */
export function sanitizeTripId(tripId) {
  if (!tripId) return null;
  try {
    const str = decodeURIComponent(String(tripId)).trim();
    const match = str.match(UUID_RE);
    return match ? match[0] : null;
  } catch {
    const match = String(tripId).match(UUID_RE);
    return match ? match[0] : null;
  }
}

/** Local dev runs on HTTP only — https://localhost causes ERR_SSL_PROTOCOL_ERROR */
function isLocalHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost")
  );
}

/** Normalize origin — force http on localhost (no SSL in npm run dev) */
export function normalizeShareOrigin(origin) {
  if (!origin) return origin;
  try {
    const parsed = new URL(origin);
    if (isLocalHost(parsed.hostname) && parsed.protocol === "https:") {
      parsed.protocol = "http:";
      return parsed.origin;
    }
    return parsed.origin;
  } catch {
    if (/localhost|127\.0\.0\.1/i.test(origin)) {
      return origin.replace(/^https:/i, "http:");
    }
    return origin;
  }
}

/** Site origin — use env in production so shared links aren't localhost */
export function getSiteOrigin() {
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (envUrl && !isLocalHost(window.location.hostname)) {
      return normalizeShareOrigin(envUrl.replace(/\/$/, ""));
    }
    return normalizeShareOrigin(window.location.origin);
  }
  return normalizeShareOrigin(
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || ""
  );
}

/** Absolute URL for a saved trip's public view */
export function getTripShareUrl(tripId) {
  const id = sanitizeTripId(tripId);
  if (!id) return "";
  const origin =
    typeof window !== "undefined"
      ? getSiteOrigin() || normalizeShareOrigin(window.location.origin)
      : normalizeShareOrigin(
          process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || ""
        );
  if (!origin) return `http://localhost:3000/trip/${id}`;
  return `${origin}/trip/${id}`;
}

/** Fix https→http on localhost if a client upgraded the scheme */
export function normalizeShareUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url.split(/\s/)[0].trim());
    if (isLocalHost(parsed.hostname) && parsed.protocol === "https:") {
      parsed.protocol = "http:";
    }
    return parsed.href;
  } catch {
    return url.replace(
      /^https:\/\/(localhost|127\.0\.0\.1)/i,
      "http://$1"
    );
  }
}

/** Short caption for native share sheet — URL passed separately via `url` field */
export function buildTripShareText({ destination, dayCount }) {
  const dest = destination || "trip";
  const daysPart = dayCount ? `${dayCount}-day ` : "";
  return `Check out my ${daysPart}${dest} itinerary on Travora! 🗺️`;
}

/** Full message with link — for WhatsApp / SMS where one text block is needed */
export function buildTripShareMessage({ destination, dayCount, url }) {
  return `${buildTripShareText({ destination, dayCount })}\n\n${url}`;
}

/** WhatsApp deep link — opens app or web with pre-filled text */
export function buildWhatsAppShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Copy link to clipboard */
export async function copyTripLink(url) {
  if (!navigator.clipboard) {
    throw new Error("Clipboard not available");
  }
  await navigator.clipboard.writeText(url);
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Native share on mobile; on desktop always copy a clean URL to clipboard.
 * Edge desktop corrupts links when Web Share API merges text + url fields.
 * @returns {"shared"|"copied"}
 */
export async function shareTripNative({ title, text, url }) {
  if (!url) {
    throw new Error("Missing share URL");
  }

  const cleanUrl = normalizeShareUrl(url);

  if (isMobileDevice() && navigator.share) {
    try {
      await navigator.share({ title, text, url: cleanUrl });
      return "shared";
    } catch (err) {
      if (err?.name === "AbortError") throw err;
    }
  }

  await copyTripLink(cleanUrl);
  return "copied";
}

/** Open WhatsApp with pre-filled trip message */
export function openWhatsAppShare(message) {
  window.open(buildWhatsAppShareUrl(message), "_blank", "noopener,noreferrer");
}
