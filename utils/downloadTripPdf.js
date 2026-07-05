/**
 * Client-side PDF export for Travora itineraries (jsPDF).
 * Layout: branded header, card-based activity blocks, clean spacing.
 */

import { jsPDF } from "jspdf";
import { capitalizeDestination } from "@/utils/formatTrip";

const PERIODS = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
];

const NAVY = [30, 58, 138];
const ORANGE = [249, 115, 22];
const GRAY = [100, 116, 139];
const SLATE = [71, 85, 105];
const CARD_BG = [248, 250, 252];
const CARD_BORDER = [226, 232, 240];

const PAGE_MARGIN = 16;
const FOOTER_RESERVE = 14;
const LINE_H = 4.6;

/** Strip emoji / unsupported chars — Helvetica cannot render them */
function sanitizePdfText(text) {
  if (!text) return "";
  return String(text)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sanitize destination for use in a filename */
function pdfFilename(destination) {
  const base = String(destination || "trip")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 48);
  return `Travora-${base || "Trip"}-Itinerary.pdf`;
}

function pageBottom(doc) {
  return doc.internal.pageSize.getHeight() - FOOTER_RESERVE;
}

/** Add a new page when needed; returns updated Y */
function ensureSpace(doc, y, needed) {
  if (y + needed > pageBottom(doc)) {
    doc.addPage();
    return 22;
  }
  return y;
}

/** Wrapped line count at a given font size */
function wrappedLines(doc, text, maxWidth, fontSize) {
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(sanitizePdfText(text), maxWidth);
}

/** Draw wrapped paragraph; returns new Y */
function writeParagraph(doc, text, x, y, maxWidth, fontSize, color = GRAY) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = wrappedLines(doc, text, maxWidth, fontSize);
  lines.forEach((line) => {
    y = ensureSpace(doc, y, LINE_H + 1);
    doc.text(line, x, y);
    y += LINE_H;
  });
  return y;
}

/** Split composed vibe string into style vs interests */
function parseVibeDetails(vibeString) {
  const raw = sanitizePdfText(vibeString);
  if (!raw) return { style: "", interests: "" };

  const match = raw.match(/^(.*?)(?:\.\s*)?Interests:\s*(.+)$/i);
  if (match) {
    return {
      style: match[1].replace(/\.\s*$/, "").trim(),
      interests: match[2].trim(),
    };
  }

  return { style: raw, interests: "" };
}

/** Trip summary box — highlighted labels, separated from body text */
function writeTripMetaBlock(doc, y, contentWidth, fields) {
  const activeFields = fields.filter((f) => f.value);
  if (!activeFields.length) return y;

  const fontSize = 9.5;
  const labelCol = 36;
  const pad = 5;
  const valueWidth = contentWidth - labelCol - pad * 2;
  let blockH = 10;

  const measured = activeFields.map(({ label, value }) => {
    const lines = wrappedLines(doc, value, valueWidth, fontSize);
    const h = lines.length * LINE_H + 3;
    blockH += h;
    return { label, lines };
  });

  y = ensureSpace(doc, y, blockH + 4);

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(...CARD_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(PAGE_MARGIN, y, contentWidth, blockH, 3, 3, "FD");

  let cy = y + 7;
  measured.forEach(({ label, lines }) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    doc.setTextColor(...ORANGE);
    doc.text(`${label}:`, PAGE_MARGIN + pad, cy);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...SLATE);
    lines.forEach((line) => {
      doc.text(line, PAGE_MARGIN + pad + labelCol, cy);
      cy += LINE_H;
    });
    cy += 3;
  });

  return y + blockH + 5;
}

/** Draw orange + navy day section header */
function writeDayHeader(doc, day, y, contentWidth) {
  const theme = sanitizePdfText(day.theme || "Exploration");
  const title = `Day ${day.day} — ${theme}`;
  const titleLines = wrappedLines(doc, title, contentWidth, 12);

  const blockH = titleLines.length * 6 + 6 + (day.summary ? 12 : 0);
  y = ensureSpace(doc, y, Math.min(blockH, 40));

  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.6);
  doc.line(PAGE_MARGIN, y - 2, PAGE_MARGIN + 28, y - 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  titleLines.forEach((line) => {
    doc.text(line, PAGE_MARGIN, y + 4);
    y += 6;
  });
  y += 4;

  if (day.summary) {
    y = writeParagraph(
      doc,
      day.summary,
      PAGE_MARGIN,
      y,
      contentWidth,
      9,
      GRAY
    );
    y += 2;
  }

  return y + 2;
}

/** Draw one activity card; returns new Y */
function drawActivityCard(doc, slot, periodLabel, y, contentWidth) {
  const cardX = PAGE_MARGIN;
  const cardW = contentWidth;
  const innerX = cardX + 7;
  const innerW = cardW - 12;

  const titleLines = wrappedLines(doc, slot.activity || "Activity", innerW, 10);
  const meta = [slot.place, slot.cost, slot.duration]
    .filter(Boolean)
    .map(sanitizePdfText)
    .join("  ·  ");
  const descLines = slot.description
    ? wrappedLines(doc, slot.description, innerW, 8.5)
    : [];

  const cardH =
    6 +
    LINE_H +
    titleLines.length * LINE_H +
    (meta ? LINE_H + 2 : 0) +
    (descLines.length ? descLines.length * LINE_H + 3 : 0) +
    5;

  y = ensureSpace(doc, y, cardH + 3);

  doc.setFillColor(...CARD_BG);
  doc.setDrawColor(...CARD_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(cardX, y, cardW, cardH, 2.5, 2.5, "FD");

  doc.setFillColor(...ORANGE);
  doc.rect(cardX, y + 1, 2, cardH - 2, "F");

  let cy = y + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...ORANGE);
  doc.text(periodLabel.toUpperCase(), innerX, cy);
  cy += LINE_H + 1.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  titleLines.forEach((line) => {
    doc.text(line, innerX, cy);
    cy += LINE_H;
  });

  if (meta) {
    cy += 1.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    const metaLines = wrappedLines(doc, meta, innerW, 8.5);
    metaLines.forEach((line) => {
      doc.text(line, innerX, cy);
      cy += LINE_H;
    });
  }

  if (descLines.length) {
    cy += 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...SLATE);
    descLines.forEach((line) => {
      doc.text(line, innerX, cy);
      cy += LINE_H;
    });
  }

  return y + cardH + 3;
}

/** Compact tip callout */
function writeTip(doc, tip, y, contentWidth) {
  const text = sanitizePdfText(tip);
  const lines = wrappedLines(doc, text, contentWidth - 10, 8.5);
  const boxH = lines.length * LINE_H + 8;
  y = ensureSpace(doc, y, boxH + 2);

  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(254, 215, 170);
  doc.roundedRect(PAGE_MARGIN, y, contentWidth, boxH, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...ORANGE);
  doc.text("Local tip", PAGE_MARGIN + 5, y + 5);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  let cy = y + 10;
  lines.forEach((line) => {
    doc.text(line, PAGE_MARGIN + 5, cy);
    cy += LINE_H;
  });

  return y + boxH + 4;
}

/**
 * Build and download a PDF for the given trip itinerary.
 * @param {object} tripData — same shape as sessionStorage / API response
 */
export function downloadTripPdf(tripData) {
  if (!tripData?.days?.length) {
    throw new Error("No itinerary data to export");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;

  const destination = sanitizePdfText(
    capitalizeDestination(tripData.destination)
  );
  const { tripMeta } = tripData;
  const dayCount = tripData.days.length;
  const budget = sanitizePdfText(
    tripData.totalBudgetEstimate || tripMeta?.budget || ""
  );
  const vibe = sanitizePdfText(tripMeta?.vibe || "");
  const bestTime = sanitizePdfText(tripData.bestTimeToVisit || "");

  // ─── Header band ───
  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, pageWidth, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Travora", PAGE_MARGIN, 11);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("AI Travel Itinerary", PAGE_MARGIN, 17);
  doc.text(
    new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    pageWidth - PAGE_MARGIN,
    11,
    { align: "right" }
  );

  let y = 34;

  // ─── Trip title + meta (stacked lines — avoids stretched bullet rows) ───
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...NAVY);
  doc.text(destination, PAGE_MARGIN, y);
  y += 10;

  const { style: tripStyle, interests } = parseVibeDetails(vibe);
  const durationValue = [
    `${dayCount} day${dayCount !== 1 ? "s" : ""}`,
    budget ? `Est. ${budget}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  y = writeTripMetaBlock(doc, y, contentWidth, [
    { label: "Duration", value: durationValue },
    { label: "Style", value: tripStyle },
    { label: "Interests", value: interests },
    { label: "Best time to visit", value: bestTime },
  ]);
  y += 4;

  // ─── Day-by-day itinerary ───
  tripData.days.forEach((day, index) => {
    if (index > 0) y += 4;
    y = writeDayHeader(doc, day, y, contentWidth);

    PERIODS.forEach(({ key, label }) => {
      const slot = day[key];
      if (!slot) return;
      y = drawActivityCard(doc, slot, label, y, contentWidth);
    });

    if (day.tips) {
      y = writeTip(doc, day.tips, y, contentWidth);
    }

    y += 2;
  });

  // ─── Packing essentials ───
  if (tripData.packingEssentials?.length) {
    y = ensureSpace(doc, y, 20);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text("Packing Essentials", PAGE_MARGIN, y);
    y += 7;

    tripData.packingEssentials.forEach((item) => {
      y = ensureSpace(doc, y, LINE_H + 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...SLATE);
      doc.text(`•  ${sanitizePdfText(item)}`, PAGE_MARGIN + 2, y);
      y += LINE_H + 1;
    });
  }

  // ─── Footer on every page ───
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...CARD_BORDER);
    doc.setLineWidth(0.2);
    doc.line(
      PAGE_MARGIN,
      pageBottom(doc) - 2,
      pageWidth - PAGE_MARGIN,
      pageBottom(doc) - 2
    );
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(
      `Generated by Travora-Ai  ·  Page ${i} of ${totalPages}  ·  travora-ai.app`,
      pageWidth / 2,
      pageBottom(doc) + 5,
      { align: "center" }
    );
  }

  doc.save(pdfFilename(destination));
}
