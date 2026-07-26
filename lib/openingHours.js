/**
 * Lightweight OSM opening_hours evaluation for "open now" badges.
 * Handles common patterns only; returns null when rules are too complex.
 */

const DAY_KEYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Minutes since midnight in a given IANA timezone */
export function localMinutesNow(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "UTC",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());

    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const weekdayMap = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dayIndex = weekdayMap[map.weekday] ?? 0;
    const hour = Number(map.hour);
    const minute = Number(map.minute);
    return { dayIndex, minutes: hour * 60 + minute };
  } catch {
    const d = new Date();
    return {
      dayIndex: d.getUTCDay(),
      minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    };
  }
}

function parseTimeToken(token) {
  const m = String(token)
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

function expandDayRange(start, end) {
  const a = DAY_KEYS.indexOf(start);
  const b = DAY_KEYS.indexOf(end);
  if (a < 0 || b < 0) return [];
  const out = [];
  let i = a;
  for (let n = 0; n < 7; n++) {
    out.push(i);
    if (i === b) break;
    i = (i + 1) % 7;
  }
  return out;
}

/**
 * @returns {{ open: boolean, label: string } | null}
 */
export function evaluateOpeningHours(raw, timeZone) {
  if (!raw) return null;

  // Geoapify sometimes returns structured objects
  if (typeof raw === "object") {
    if (typeof raw.open_now === "boolean") {
      return {
        open: raw.open_now,
        label: raw.open_now ? "Open now" : "Closed now",
      };
    }
    if (raw["24/7"] || raw.twentyfourseven) {
      return { open: true, label: "Open 24/7" };
    }
    if (typeof raw.text === "string") {
      return evaluateOpeningHours(raw.text, timeZone);
    }
    return null;
  }

  const text = String(raw).trim();
  if (!text) return null;
  if (/^24\/7$/i.test(text) || /^Mo-Su 00:00-24:00$/i.test(text)) {
    return { open: true, label: "Open 24/7" };
  }

  // Skip very complex rules (holidays, PH, off, etc.)
  if (/PH|SH|;|week|sunrise|sunset|open|"/i.test(text) && text.includes(";")) {
    // still try simple single-rule strings without PH
  }
  if (/\bPH\b|\boff\b/i.test(text)) return null;

  const { dayIndex, minutes } = localMinutesNow(timeZone);
  const rules = text.split(";").map((r) => r.trim()).filter(Boolean);

  for (const rule of rules) {
    // "Mo-Fr 09:00-17:00" or "Mo,Tu,We 10:00-18:00" or "Sa-Su 11:00-15:00"
    const match = rule.match(
      /^([A-Za-z,\-]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/
    );
    if (!match) continue;

    const dayPart = match[1];
    const start = parseTimeToken(match[2]);
    let end = parseTimeToken(match[3]);
    if (start == null || end == null) continue;
    if (end === 0) end = 24 * 60;

    const days = new Set();
    for (const chunk of dayPart.split(",")) {
      const c = chunk.trim();
      if (c.includes("-")) {
        const [a, b] = c.split("-");
        expandDayRange(a, b).forEach((d) => days.add(d));
      } else {
        const idx = DAY_KEYS.indexOf(c);
        if (idx >= 0) days.add(idx);
      }
    }

    if (!days.has(dayIndex)) continue;

    const open =
      end > start
        ? minutes >= start && minutes < end
        : minutes >= start || minutes < end; // overnight

    return {
      open,
      label: open ? "Open now" : "Closed now",
    };
  }

  return null;
}
