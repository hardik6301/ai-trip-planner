/**
 * Offline Travel Pack — Pro PDF with trip share QR, map links, and day itinerary.
 * Uses jsPDF + a public QR image API (no extra npm dependency).
 */

import { jsPDF } from "jspdf";
import { capitalizeDestination } from "@/utils/formatTrip";
import { getGoogleMapsLink } from "@/utils/googleMaps";
import { getTripShareUrl } from "@/utils/shareTrip";

const PERIODS = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
];

const NAVY = [15, 27, 77];
const ORANGE = [249, 115, 22];
const GRAY = [100, 116, 139];
const DARK = [15, 23, 42];
const PAGE_MARGIN = 16;

function sanitize(text) {
  if (!text) return "";
  return String(text)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Load a QR code PNG as a data URL for jsPDF addImage */
async function fetchQrDataUrl(data, size = 160) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not generate QR code");
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * @param {object} tripData
 * @param {{ tripId?: string|null }} [opts]
 */
export async function downloadOfflinePack(tripData, opts = {}) {
  const destination = capitalizeDestination(tripData.destination || "Trip");
  const days = tripData.days || [];
  if (!days.length) throw new Error("No itinerary to export");

  const shareUrl = opts.tripId
    ? getTripShareUrl(opts.tripId)
    : typeof window !== "undefined"
      ? window.location.href
      : "https://travora-ai-app.vercel.app";

  const mapsHome = getGoogleMapsLink(destination, destination);

  // Prefetch QR codes (share + destination maps)
  const [shareQr, mapsQr] = await Promise.all([
    fetchQrDataUrl(shareUrl, 180),
    mapsHome ? fetchQrDataUrl(mapsHome, 140) : Promise.resolve(null),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  let y = 0;

  // Header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Travora Offline Travel Pack", PAGE_MARGIN, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(sanitize(destination), PAGE_MARGIN, 22);
  doc.setFontSize(8);
  doc.text("PRO  ·  Works offline once saved", PAGE_MARGIN, 28);
  y = 42;

  // QR row
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Scan on your phone", PAGE_MARGIN, y);
  y += 4;

  doc.addImage(shareQr, "PNG", PAGE_MARGIN, y, 38, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("Trip link / share", PAGE_MARGIN, y + 42);

  if (mapsQr) {
    doc.addImage(mapsQr, "PNG", PAGE_MARGIN + 50, y, 32, 32);
    doc.text("Destination on Maps", PAGE_MARGIN + 50, y + 38);
  }

  y += 52;
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  const linkLines = doc.splitTextToSize(shareUrl, contentWidth);
  doc.text(linkLines, PAGE_MARGIN, y);
  y += linkLines.length * 4 + 8;

  // Packing
  if (tripData.packingEssentials?.length) {
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Packing checklist", PAGE_MARGIN, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    tripData.packingEssentials.forEach((item) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(`[ ]  ${sanitize(item)}`, PAGE_MARGIN, y);
      y += 5;
    });
    y += 6;
  }

  // Days
  days.forEach((day) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(241, 245, 249);
    doc.rect(PAGE_MARGIN, y - 4, contentWidth, 8, "F");
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(
      `Day ${day.day}  —  ${sanitize(day.theme || "Itinerary")}`,
      PAGE_MARGIN + 2,
      y
    );
    y += 10;

    PERIODS.forEach((period) => {
      const slot = day[period.key];
      if (!slot?.activity) return;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.setTextColor(...ORANGE);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(period.label.toUpperCase(), PAGE_MARGIN, y);
      y += 4;

      doc.setTextColor(...DARK);
      doc.setFontSize(10);
      doc.text(sanitize(slot.activity), PAGE_MARGIN, y);
      y += 4;

      if (slot.place) {
        doc.setTextColor(...GRAY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(`Place: ${sanitize(slot.place)}`, PAGE_MARGIN, y);
        y += 3.5;
        const mapLink = getGoogleMapsLink(slot.place, destination);
        if (mapLink) {
          doc.setTextColor(...NAVY);
          doc.textWithLink("Open in Google Maps", PAGE_MARGIN, y, { url: mapLink });
          y += 4;
        }
      }

      if (slot.cost || slot.duration) {
        doc.setTextColor(...GRAY);
        doc.setFontSize(8);
        doc.text(
          [slot.duration, slot.cost].filter(Boolean).map(sanitize).join("  ·  "),
          PAGE_MARGIN,
          y
        );
        y += 4;
      }

      if (slot.description) {
        const lines = doc.splitTextToSize(sanitize(slot.description), contentWidth);
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text(lines.slice(0, 3), PAGE_MARGIN, y);
        y += Math.min(lines.length, 3) * 3.5 + 3;
      } else {
        y += 2;
      }
    });

    y += 4;
  });

  // Footer
  doc.setTextColor(...GRAY);
  doc.setFontSize(7);
  doc.text(
    `Generated by Travora Pro · ${new Date().toLocaleDateString("en-IN")}`,
    PAGE_MARGIN,
    doc.internal.pageSize.getHeight() - 8
  );

  const safe = sanitize(destination).replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  doc.save(`Travora-${safe || "Trip"}-Offline-Pack.pdf`);
}
