/**
 * WhatsApp daily itinerary digests (Phase 3).
 *
 * Share button = trip link. WhatsApp = formatted day plan for companions.
 *
 * Future (bigger lift): morning-of daily reminders via WhatsApp Business API
 * + cron/queued job — not implemented here.
 */

const PERIODS = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
];

/** WhatsApp / wa.me practical text budget (encoded URL must stay usable) */
const MAX_DIGEST_CHARS = 3500;

function truncate(str, max) {
  const s = String(str || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
}

/**
 * Build a plain-text daily digest from one itinerary day.
 * @param {object} opts
 * @param {object} opts.tripData — itinerary + destination
 * @param {number} opts.dayNumber — 1-based day
 * @param {string} [opts.url] — optional full trip link
 */
export function buildWhatsAppDayDigest({ tripData, dayNumber, url }) {
  const days = tripData?.days || [];
  const day =
    days.find((d) => Number(d.day) === Number(dayNumber)) || days[0];
  if (!day) {
    return "My Travora itinerary — no days available yet.";
  }

  const destination = String(tripData.destination || "Trip").trim();
  const theme = day.theme ? truncate(day.theme, 80) : "";
  const summary = day.summary ? truncate(day.summary, 140) : "";

  const lines = [
    `*${destination} — Day ${day.day}*`,
    theme ? `_${theme}_` : null,
    summary || null,
    "",
  ].filter((line) => line !== null);

  for (const period of PERIODS) {
    const slot = day[period.key];
    if (!slot?.activity) continue;

    lines.push(`*${period.label}* — ${truncate(slot.activity, 90)}`);

    const details = [];
    if (slot.place) details.push(truncate(slot.place, 70));
    if (slot.duration) details.push(String(slot.duration).trim());
    if (slot.cost && !/^(-|—|n\/a|free)$/i.test(String(slot.cost).trim())) {
      details.push(truncate(slot.cost, 40));
    }
    if (details.length) {
      lines.push(`  ${details.join(" · ")}`);
    }
    lines.push("");
  }

  if (url) {
    lines.push(`Full itinerary: ${url}`);
  } else {
    lines.push("Planned with Travora");
  }

  let message = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  if (message.length > MAX_DIGEST_CHARS) {
    message = `${message.slice(0, MAX_DIGEST_CHARS - 1).trim()}…`;
  }

  return message;
}

/** List days available for digest picker */
export function listDigestDays(tripData) {
  return (tripData?.days || []).map((d) => ({
    day: d.day,
    theme: d.theme || `Day ${d.day}`,
  }));
}
