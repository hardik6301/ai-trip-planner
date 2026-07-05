/**
 * Destination helpers — country currency mapping, weather labels, vibe parsing.
 */

/** ISO 3166-1 alpha-2 → ISO 4217 (common travel destinations) */
export const COUNTRY_CURRENCY = {
  TH: "THB",
  IN: "INR",
  US: "USD",
  GB: "GBP",
  CH: "CHF",
  FR: "EUR",
  DE: "EUR",
  IT: "EUR",
  ES: "EUR",
  PT: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  GR: "EUR",
  JP: "JPY",
  KR: "KRW",
  CN: "CNY",
  SG: "SGD",
  MY: "MYR",
  ID: "IDR",
  VN: "VND",
  PH: "PHP",
  AE: "AED",
  TR: "TRY",
  AU: "AUD",
  NZ: "NZD",
  CA: "CAD",
  MX: "MXN",
  BR: "BRL",
  ZA: "ZAR",
  EG: "EGP",
  MA: "MAD",
  NP: "NPR",
  LK: "LKR",
  MV: "MVR",
  HK: "HKD",
  TW: "TWD",
};

/** Currency code → display symbol */
export function currencySymbol(code) {
  const map = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
    THB: "฿",
    CHF: "CHF",
    JPY: "¥",
    AUD: "A$",
    CAD: "C$",
    SGD: "S$",
    AED: "AED",
  };
  return map[code] || code;
}

/** WMO weather code → short label */
export function weatherLabel(code) {
  const c = Number(code);
  if (c === 0) return "Clear sky";
  if (c <= 3) return "Partly cloudy";
  if (c <= 48) return "Foggy";
  if (c <= 57) return "Drizzle";
  if (c <= 67) return "Rain";
  if (c <= 77) return "Snow";
  if (c <= 82) return "Rain showers";
  if (c <= 86) return "Snow showers";
  if (c <= 99) return "Thunderstorm";
  return "Variable";
}

/** Remove emoji from interest labels for clean UI chips */
export function stripEmojis(text) {
  return String(text)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse composed vibe string from home page into style + interest list.
 * e.g. "Solo trip. Luxury. Interests: Street Food, Beaches"
 */
export function parseTripVibe(vibeString) {
  const raw = stripEmojis(vibeString || "");
  if (!raw) return { styleParts: [], interests: [] };

  const match = raw.match(/^(.*?)(?:\.\s*)?Interests:\s*(.+)$/i);
  if (match) {
    const styleParts = match[1]
      .split(/\.\s*/)
      .map((s) => stripEmojis(s))
      .filter(Boolean);
    const interests = match[2]
      .split(",")
      .map((s) => stripEmojis(s))
      .filter(Boolean);
    return { styleParts, interests };
  }

  return {
    styleParts: raw
      .split(/\.\s*/)
      .map((s) => stripEmojis(s))
      .filter(Boolean),
    interests: [],
  };
}

/** Guess local currency from destination string or budget text */
export function inferCurrencyFromText(text) {
  const s = String(text || "");
  const codeMatch = s.match(/\b([A-Z]{3})\b/);
  if (codeMatch && codeMatch[1] !== "THE") return codeMatch[1];
  const symMap = { "₹": "INR", $: "USD", "€": "EUR", "£": "GBP", "฿": "THB" };
  for (const [sym, code] of Object.entries(symMap)) {
    if (s.includes(sym)) return code;
  }
  return null;
}

/** Extract last segment of "City, Country" as country hint */
export function extractCountryHint(destination) {
  if (!destination) return "";
  const parts = String(destination)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

/** Format exchange rate line: 1 THB = ₹2.38 */
export function formatExchangeLine(fromCode, toCode, rate) {
  const toSym = currencySymbol(toCode);
  const fromSym = currencySymbol(fromCode);
  if (fromCode === toCode) return `Same as ${toSym}`;

  const r = Number(rate);
  if (!r || Number.isNaN(r)) return "Rate unavailable";

  if (r >= 1) {
    return `1 ${fromCode} = ${toSym}${r.toFixed(r >= 100 ? 0 : 2)}`;
  }
  const inverse = 1 / r;
  return `${toSym}1 = ${fromSym}${inverse.toFixed(inverse >= 100 ? 0 : 2)}`;
}
