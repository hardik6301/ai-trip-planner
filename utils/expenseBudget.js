/**
 * Budget / money helpers for the expense tracker and live spend bar.
 */

/** Strip parenthetical notes from AI budget strings */
export function stripBudgetNotes(str) {
  return String(str || "")
    .replace(/\([^)]*\)/g, " ")
    .trim();
}

/** First currency symbol found in a budget/cost string */
export function detectCurrencySymbol(str, fallback = "₹") {
  const match = String(str || "").match(/[₹$€£¥฿]/);
  return match ? match[0] : fallback;
}

/** First numeric amount in a string (commas stripped) */
export function parseAmount(str) {
  if (!str && str !== 0) return null;
  const cleaned = stripBudgetNotes(str).replace(/,/g, "");
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

/**
 * Parse trip budget into { low, high, symbol, label }.
 * Handles "฿12,000 - ฿18,000 (excl. flights)" and tier labels like "Mid-range".
 */
export function parseBudgetRange(tripOrEstimate, metaBudget) {
  const source =
    typeof tripOrEstimate === "string"
      ? tripOrEstimate
      : tripOrEstimate?.itinerary?.totalBudgetEstimate ||
        tripOrEstimate?.totalBudgetEstimate ||
        tripOrEstimate?.budget ||
        metaBudget ||
        "";

  const core = stripBudgetNotes(source);
  const symbol = detectCurrencySymbol(core || metaBudget || source);
  const parts = core.split(/\s*[-–—]\s*/).filter(Boolean);

  let low = null;
  let high = null;

  if (parts.length >= 2) {
    low = parseAmount(parts[0]);
    high = parseAmount(parts[1]);
  } else {
    low = parseAmount(core);
    high = low;
  }

  // Meta budget like "Economy" has no numbers — fall back if needed
  if (low == null && metaBudget) {
    low = parseAmount(metaBudget);
    high = low;
  }

  if (low == null) {
    return { low: null, high: null, symbol, label: "—" };
  }

  if (high == null || high < low) high = low;

  const locale = symbol === "₹" ? "en-IN" : "en-US";
  const fmt = (n) =>
    `${symbol}${Math.round(n).toLocaleString(locale)}`;

  const label =
    Math.round(low) === Math.round(high)
      ? fmt(low)
      : `${fmt(low)} – ${fmt(high)}`;

  return { low, high, symbol, label };
}

/** Format a number with the trip's currency symbol */
export function formatMoney(amount, symbol = "₹") {
  const locale = symbol === "₹" ? "en-IN" : "en-US";
  return `${symbol}${Math.round(Number(amount) || 0).toLocaleString(locale)}`;
}

/** Compact money for donut center */
export function formatMoneyCompact(amount, symbol = "₹") {
  const v = Number(amount) || 0;
  if (v >= 100000) return `${symbol}${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `${symbol}${Math.round(v / 1000)}k`;
  return `${symbol}${Math.round(v)}`;
}

/**
 * Build activity options for a trip itinerary day.
 * Returns [{ value, label, key }] where value is "" | "morning" | ...
 */
export function getDayActivityOptions(day) {
  if (!day) return [{ value: "", label: "Whole day", key: "" }];

  const periods = [
    { key: "morning", label: "Morning" },
    { key: "afternoon", label: "Afternoon" },
    { key: "evening", label: "Evening" },
  ];

  const options = [{ value: "", label: "Whole day", key: "" }];
  for (const p of periods) {
    const slot = day[p.key];
    if (!slot?.activity) continue;
    options.push({
      value: p.key,
      key: p.key,
      label: `${p.label}: ${slot.activity}`,
      activityLabel: slot.activity,
    });
  }
  return options;
}
