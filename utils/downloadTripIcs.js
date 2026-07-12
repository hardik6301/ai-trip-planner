/**
 * Export a trip itinerary as a Google Calendar–compatible .ics file.
 * Creates one all-day (or timed) event per day in the itinerary.
 */

import { capitalizeDestination } from "@/utils/formatTrip";

const PERIODS = [
  { key: "morning", label: "Morning", hour: 9 },
  { key: "afternoon", label: "Afternoon", hour: 13 },
  { key: "evening", label: "Evening", hour: 18 },
];

/** Format a Date as ICS UTC: 20241012T090000Z */
function toIcsUtc(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

/** Escape text for ICS (commas, semicolons, newlines) */
function icsEscape(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * @param {object} tripData
 * @param {{ startDate?: string }} [opts] — optional YYYY-MM-DD start; defaults to tomorrow
 */
export function downloadTripIcs(tripData, opts = {}) {
  const destination = capitalizeDestination(tripData.destination || "Trip");
  const days = tripData.days || [];
  if (!days.length) throw new Error("No days to export");

  const start = opts.startDate
    ? new Date(`${opts.startDate}T09:00:00`)
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      })();

  const stamp = toIcsUtc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Travora//Trip Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Travora — ${icsEscape(destination)}`,
  ];

  days.forEach((day, index) => {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + index);

    PERIODS.forEach((period) => {
      const slot = day[period.key];
      if (!slot?.activity) return;

      const eventStart = new Date(dayDate);
      eventStart.setHours(period.hour, 0, 0, 0);
      const eventEnd = new Date(eventStart);
      eventEnd.setHours(period.hour + 2, 0, 0, 0);

      const summary = `Day ${day.day}: ${slot.activity}`;
      const location = [slot.place, destination].filter(Boolean).join(", ");
      const description = [
        slot.description || "",
        slot.cost ? `Cost: ${slot.cost}` : "",
        slot.duration ? `Duration: ${slot.duration}` : "",
        "Planned with Travora",
      ]
        .filter(Boolean)
        .join("\n");

      const uid = `travora-d${day.day}-${period.key}-${Date.now()}@travora.app`;

      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${toIcsUtc(eventStart)}`,
        `DTEND:${toIcsUtc(eventEnd)}`,
        `SUMMARY:${icsEscape(summary)}`,
        `LOCATION:${icsEscape(location)}`,
        `DESCRIPTION:${icsEscape(description)}`,
        "END:VEVENT"
      );
    });
  });

  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = destination.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  a.href = url;
  a.download = `Travora-${safe || "Trip"}-Calendar.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
