"use client";

/**
 * Travora itinerary — pixel-perfect match to reference screenshot.
 * Used on /results and /trip/[id]. Functionality preserved; layout is fixed.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Battery,
  Bookmark,
  Cable,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudRain,
  Cross,
  ExternalLink,
  FileText,
  Footprints,
  Heart,
  Info,
  MapPin,
  Moon,
  Plus,
  RefreshCw,
  Settings,
  Share2,
  Sparkles,
  Sun,
  Users,
  UtensilsCrossed,
  Wallet,
  Zap,
} from "lucide-react";
import { capitalizeDestination } from "@/utils/formatTrip";
import { getPlaceImage, PLACE_IMAGE_FALLBACK } from "@/utils/placeImages";
import { FREE_REGENERATIONS_PER_TRIP } from "@/constants/tripOptions";
import { useToast } from "@/components/ui/Toast";
import ProBadge from "@/components/ui/ProBadge";
import {
  buildTripShareMessage,
  buildTripShareText,
  getTripShareUrl,
  openWhatsAppShare,
  sanitizeTripId,
  shareTripNative,
} from "@/utils/shareTrip";
import { downloadTripPdf } from "@/utils/downloadTripPdf";
import { downloadTripIcs } from "@/utils/downloadTripIcs";
import { downloadOfflinePack } from "@/utils/downloadOfflinePack";
import { getGoogleMapsLink } from "@/utils/googleMaps";
import Modal from "@/components/ui/Modal";
import { useTripLiveData } from "@/hooks/useTripLiveData";
import { currencySymbol, parseTripVibe } from "@/lib/destinationLive";

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80";

const PERIODS = [
  { key: "morning", label: "MORNING", duration: "2 hrs", category: "Easy" },
  { key: "afternoon", label: "AFTERNOON", duration: "3 hrs", category: "Moderate" },
  { key: "evening", label: "EVENING", duration: "2 hrs", category: "Dinner" },
];

const DAY_ICONS = [Sun, Settings, Sparkles, Zap];

const PACKING_ICON_MAP = {
  "hiking boots": Footprints,
  sunscreen: Sun,
  "power bank": Battery,
  "rain shell": CloudRain,
  "first aid kit": Cross,
};

const AI_FEATURES = [
  "Modify itinerary",
  "Ask travel questions",
  "Add attractions",
  "Change budget",
];

function isNonMonetaryCost(cost) {
  if (!cost) return true;
  const s = String(cost).trim().toLowerCase();
  return s === "free" || s === "included" || s === "n/a";
}

function parseCostValue(cost) {
  if (isNonMonetaryCost(cost)) return 0;
  const n = parseFloat(String(cost).replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function getCurrencyPrefix(day) {
  for (const p of PERIODS) {
    const cost = day[p.key]?.cost;
    if (cost && !isNonMonetaryCost(cost)) {
      const match = String(cost).match(/^[^\d]+/);
      return match ? match[0].trim() : "₹";
    }
  }
  return "₹";
}

function sumDayCost(day) {
  const total = PERIODS.reduce(
    (sum, p) => sum + parseCostValue(day[p.key]?.cost),
    0
  );
  if (total === 0) return null;
  return `${getCurrencyPrefix(day)}${total.toLocaleString("en-IN")}`;
}

function getDaySummary(day, destination) {
  if (day.summary) return day.summary;
  const place = day.morning?.place || day.afternoon?.place;
  if (place) {
    return `Your journey begins in ${place.split(",")[0]} with ${day.theme.toLowerCase()}.`;
  }
  return `Explore ${day.theme.toLowerCase()} across ${destination}.`;
}

function getActivityDescription(slot, period) {
  if (slot.description) return slot.description;
  return `${slot.activity} at ${slot.place}. A relaxed ${period.key} experience tailored to your trip.`;
}

function getCategoryMeta(slot, period) {
  const text = `${slot.activity} ${slot.place} ${slot.category || ""}`.toLowerCase();
  if (text.includes("dinner") || text.includes("fondue") || text.includes("restaurant"))
    return { Icon: UtensilsCrossed, label: slot.category || "Dinner" };
  if (text.includes("cable") || text.includes("gondola") || text.includes("railway"))
    return { Icon: Cable, label: slot.category || "Cable Car" };
  if (text.includes("paraglid") || text.includes("hike") || text.includes("moderate"))
    return { Icon: Footprints, label: slot.category || "Moderate" };
  if (slot.category?.toLowerCase().includes("easy"))
    return { Icon: Footprints, label: slot.category };
  return { Icon: Footprints, label: slot.category || period.category };
}

function countActivities(days) {
  if (!days?.length) return 0;
  return days.reduce(
    (sum, day) => sum + PERIODS.filter((p) => day[p.key]).length,
    0
  );
}

function countPlaces(days) {
  const places = new Set();
  days?.forEach((day) => {
    PERIODS.forEach((p) => {
      if (day[p.key]?.place) places.add(day[p.key].place);
    });
  });
  return places.size || days?.length || 0;
}

function getPackingIcon(item) {
  const key = item.toLowerCase();
  for (const [match, Icon] of Object.entries(PACKING_ICON_MAP)) {
    if (key.includes(match)) return Icon;
  }
  return Footprints;
}

function formatDayLabel(n) {
  return `DAY ${n}`;
}

/** Split long AI budget strings into clean card-friendly parts */
function formatBudgetDisplay(estimate, metaBudget, vibe) {
  const raw = String(estimate || "—").trim();

  let exclusionNote = "Excludes international flights";
  const parenMatch = raw.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inner = parenMatch[1].trim();
    exclusionNote = /^exclud/i.test(inner)
      ? inner.charAt(0).toUpperCase() + inner.slice(1)
      : `Excludes ${inner.toLowerCase()}`;
  }

  const core = raw.replace(/\([^)]*\)/g, "").trim();
  const shortExclusion = exclusionNote.toLowerCase().includes("flight")
    ? "Excludes flights"
    : exclusionNote;

  const rangeParts = core.split(/\s*[-–—]\s*/).filter(Boolean);
  if (rangeParts.length >= 2) {
    const mainAmount = `${rangeParts[0].trim()} – ${rangeParts[1].trim()}`;
    const tier =
      vibe ||
      (metaBudget && !/^[\₹$€£]/.test(metaBudget) ? metaBudget : null);
    return {
      mainAmount,
      rangeLine: null,
      subtitle: tier ? `${tier} • ${shortExclusion}` : exclusionNote,
      heroShort: mainAmount,
      progressTitle: mainAmount,
    };
  }

  const mainAmount = core || "—";
  const tier =
    vibe || (metaBudget && !/^[\₹$€£\d]/.test(metaBudget) ? metaBudget : null);

  return {
    mainAmount,
    rangeLine: null,
    subtitle: tier ? `${tier} • ${shortExclusion}` : exclusionNote,
    heroShort: mainAmount,
    progressTitle: metaBudget && /^[\₹$€£]/.test(metaBudget)
      ? `${mainAmount} of ${metaBudget}`
      : mainAmount,
  };
}

/** Extract the first numeric amount from a cost/budget string ("₹1,500", "approx ฿300") */
function parseAmount(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/,/g, "");
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

/** Sum all activity costs and compare against the trip's budget estimate */
function computePlannedSpend(days, budgetEstimate) {
  let total = 0;
  let found = false;
  let symbol = "";

  days?.forEach((day) => {
    PERIODS.forEach((p) => {
      const cost = day[p.key]?.cost;
      const amount = parseAmount(cost);
      if (amount != null) {
        total += amount;
        found = true;
        if (!symbol) {
          const sym = String(cost).match(/[₹$€£¥฿]/);
          if (sym) symbol = sym[0];
        }
      }
    });
  });

  // Lower bound of the estimate, ignoring parenthetical notes like "(excludes flights)"
  const budgetCore = String(budgetEstimate || "").replace(/\([^)]*\)/g, "");
  const budgetLow =
    parseAmount(budgetCore.split(/[-–—]/)[0]) ?? parseAmount(budgetCore);

  if (!found || !budgetLow) {
    return { title: "—", percentage: null };
  }

  const percentage = Math.min(100, Math.round((total / budgetLow) * 100));
  const locale = symbol === "₹" ? "en-IN" : "en-US";
  return {
    title: `${symbol}${total.toLocaleString(locale)}`,
    percentage,
  };
}

const BUDGET_INFO_ITEMS = [
  "AI estimated cost based on your trip preferences",
  "Includes hotels, activities, food and local transport",
  "Excludes flights, shopping, visa and insurance",
  "Prices may vary depending on season and availability",
];

export default function TripItineraryView({
  tripData,
  saveButton = null,
  footerExtra = null,
  heroBadge = "AI Optimized Itinerary",
  tripId = null,
  shareTripId = null,
  onTripDataChange = null,
  isPro = false,
  canRegenerate = true,
  aiFlashDays = [],
  aiBadgeDays = [],
  expensesHref = null,
}) {
  const { tripMeta } = tripData;
  const destination = capitalizeDestination(tripData.destination);
  const title = destination.includes("Adventure")
    ? destination
    : `${destination} Adventure`;

  const dayCount = tripData.days?.length ?? tripMeta?.days ?? 0;
  const activityCount = countActivities(tripData.days);
  const placeCount = countPlaces(tripData.days);
  const tripVibeParsed = parseTripVibe(tripMeta?.vibe);
  const vibeShort =
    tripVibeParsed.styleParts.join(" · ") ||
    tripMeta?.vibe?.split(". Interests:")[0]?.trim() ||
    "";
  const budget = tripData.totalBudgetEstimate || tripMeta?.budget || "₹42,500";
  const budgetCap = tripMeta?.budget || "₹50,000";
  const budgetDisplay = formatBudgetDisplay(budget, budgetCap, vibeShort);
  const plannedSpend = computePlannedSpend(
    tripData.days,
    tripData.totalBudgetEstimate || tripMeta?.budget
  );

  const [activeDay, setActiveDay] = useState(1);
  const [budgetInfoOpen, setBudgetInfoOpen] = useState(false);
  const budgetInfoRef = useRef(null);
  const [expandedDays, setExpandedDays] = useState(() => {
    const initial = new Set();
    tripData.days?.forEach((d, i) => {
      if (i < 2) initial.add(d.day);
    });
    return initial;
  });
  const [regeneratingDay, setRegeneratingDay] = useState(null);
  const [regenerateError, setRegenerateError] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [icsBusy, setIcsBusy] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);
  // Custom activity builder (Pro)
  const [activityModal, setActivityModal] = useState(null); // { dayNumber }
  const [activityForm, setActivityForm] = useState({
    period: "morning",
    activity: "",
    place: "",
    cost: "",
    description: "",
    duration: "2 hrs",
  });
  const [activitySaving, setActivitySaving] = useState(false);
  // Real destination photo for the hero (not the hardcoded mountain stock image)
  const [heroImage, setHeroImage] = useState(DEFAULT_HERO);

  const { showToast } = useToast();
  const activeShareId = sanitizeTripId(shareTripId ?? tripId);
  const canShare = Boolean(activeShareId);

  const regenerationsUsed = tripData.regenerationsUsed ?? 0;
  const { liveData, loading: liveLoading } = useTripLiveData(
    tripData.destination
  );

  // Load a real photo of this destination for the hero banner
  useEffect(() => {
    const dest = tripData.destination;
    if (!dest) return;

    let cancelled = false;
    const params = new URLSearchParams({
      place: dest,
      activity: "city skyline landmark",
      destination: dest,
    });

    fetch(`/api/place-image?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.url) setHeroImage(data.url);
      })
      .catch(() => {
        /* keep DEFAULT_HERO */
      });

    return () => {
      cancelled = true;
    };
  }, [tripData.destination]);

  const tripVibe = tripVibeParsed;

  const atRegenerationLimit =
    canRegenerate && !isPro && regenerationsUsed >= FREE_REGENERATIONS_PER_TRIP;

  const weatherTitle = liveLoading
    ? "…"
    : liveData?.weather
      ? `${liveData.weather.tempC}°C`
      : "—";
  const weatherSubtitle = liveLoading
    ? "Loading…"
    : liveData?.weather?.description || "Unavailable";

  const localCurrency = liveData?.currency?.localCode || "—";
  const currencySubtitle = liveLoading
    ? "Loading…"
    : liveData?.currency?.exchangeLine || "—";
  const currencyTitle = liveLoading
    ? "…"
    : `${localCurrency} (${currencySymbol(localCurrency)})`;

  useEffect(() => {
    if (!budgetInfoOpen) return;
    function handleClickOutside(e) {
      if (budgetInfoRef.current && !budgetInfoRef.current.contains(e.target)) {
        setBudgetInfoOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [budgetInfoOpen]);

  function scrollToDay(dayNumber) {
    setActiveDay(dayNumber);
    document.getElementById(`day-${dayNumber}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function toggleDay(dayNumber) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayNumber)) next.delete(dayNumber);
      else next.add(dayNumber);
      return next;
    });
  }

  function getSharePayload() {
    const url = getTripShareUrl(activeShareId);
    const shareText = buildTripShareText({
      destination: title,
      dayCount,
    });
    const whatsappText = buildTripShareMessage({
      destination: title,
      dayCount,
      url,
    });
    return {
      url,
      shareText,
      whatsappText,
      title: `${title} | Travora`,
    };
  }

  async function handleShare() {
    if (!canShare || shareBusy) return;

    setShareBusy(true);
    try {
      const { url, shareText, title: shareTitle } = getSharePayload();
      const result = await shareTripNative({
        title: shareTitle,
        text: shareText,
        url,
      });
      showToast(
        result === "shared"
          ? "Trip shared!"
          : "Link copied! Paste it to share your trip.",
        "success"
      );
    } catch (err) {
      if (err?.name !== "AbortError") {
        showToast("Could not share trip. Try again.", "error");
      }
    } finally {
      setShareBusy(false);
    }
  }

  function handleWhatsAppShare() {
    if (!canShare || shareBusy) return;

    const { whatsappText } = getSharePayload();
    openWhatsAppShare(whatsappText);
    showToast("Opening WhatsApp…", "info");
  }

  /** Download itinerary as a formatted PDF */
  function handlePdfDownload() {
    if (pdfBusy || !tripData?.days?.length) return;

    setPdfBusy(true);
    try {
      downloadTripPdf(tripData);
      showToast("PDF downloaded!", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not generate PDF",
        "error"
      );
    } finally {
      setPdfBusy(false);
    }
  }

  /** Pro — export activities to Google Calendar (.ics) */
  function handleCalendarExport() {
    if (!isPro) {
      showToast("Calendar export is a Pro feature", "error");
      return;
    }
    if (icsBusy || !tripData?.days?.length) return;
    setIcsBusy(true);
    try {
      downloadTripIcs(tripData);
      showToast("Calendar file downloaded — open it in Google Calendar", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Calendar export failed", "error");
    } finally {
      setIcsBusy(false);
    }
  }

  /** Pro — offline PDF with QR + map links */
  async function handleOfflinePack() {
    if (!isPro) {
      showToast("Offline travel pack is a Pro feature", "error");
      return;
    }
    if (offlineBusy || !tripData?.days?.length) return;
    setOfflineBusy(true);
    try {
      await downloadOfflinePack(tripData, { tripId: activeShareId });
      showToast("Offline travel pack downloaded!", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not build offline pack",
        "error"
      );
    } finally {
      setOfflineBusy(false);
    }
  }

  function openActivityBuilder(dayNumber) {
    if (!isPro) {
      showToast("Custom activity builder is a Pro feature", "error");
      return;
    }
    const day = tripData.days?.find((d) => d.day === dayNumber);
    const emptyPeriod =
      PERIODS.find((p) => !day?.[p.key]?.activity)?.key || "morning";
    setActivityForm({
      period: emptyPeriod,
      activity: "",
      place: "",
      cost: "",
      description: "",
      duration: "2 hrs",
    });
    setActivityModal({ dayNumber });
  }

  /** Save custom activity into the chosen day slot (Pro) */
  async function handleSaveCustomActivity(e) {
    e.preventDefault();
    if (!activityModal || activitySaving) return;

    const name = activityForm.activity.trim();
    if (!name) {
      showToast("Enter an activity name", "error");
      return;
    }

    setActivitySaving(true);
    const { dayNumber } = activityModal;
    const periodKey = activityForm.period;

    const nextDays = (tripData.days || []).map((d) => {
      if (d.day !== dayNumber) return d;
      return {
        ...d,
        [periodKey]: {
          activity: name,
          place: activityForm.place.trim() || destination,
          cost: activityForm.cost.trim() || "—",
          description:
            activityForm.description.trim() ||
            `Custom activity added for ${destination}.`,
          duration: activityForm.duration.trim() || "2 hrs",
          category: "Custom",
        },
      };
    });

    const next = { ...tripData, days: nextDays };
    onTripDataChange?.(next);

    // Persist when this is a saved trip
    if (tripId) {
      try {
        await fetch("/api/update-trip", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: tripId, itinerary: next }),
        });
      } catch {
        /* local state already updated */
      }
    }

    setActivitySaving(false);
    setActivityModal(null);
    setExpandedDays((prev) => new Set(prev).add(dayNumber));
    showToast(`Added to Day ${dayNumber}`, "success");
  }

  async function handleRegenerateDay(dayNumber) {
    if (!canRegenerate || regeneratingDay != null) return;

    if (!isPro && regenerationsUsed >= FREE_REGENERATIONS_PER_TRIP) {
      setRegenerateError(
        `Free plan allows ${FREE_REGENERATIONS_PER_TRIP} day regenerations per trip. Upgrade to Pro for unlimited.`
      );
      return;
    }

    const currentDay = tripData.days?.find((d) => d.day === dayNumber);
    if (!currentDay) return;

    setRegenerateError("");
    setRegeneratingDay(dayNumber);

    try {
      const response = await fetch("/api/regenerate-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: tripData.destination,
          budget: tripMeta?.budget ?? tripData.totalBudgetEstimate ?? "",
          vibe: tripMeta?.vibe ?? "",
          dayNumber,
          currentDay,
          totalDays: dayCount,
          travelMonth: tripMeta?.travelMonth ?? null,
          tripId: tripId || undefined,
          regenerationsUsed,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        setRegenerateError("Sign in to regenerate days on your itinerary.");
        return;
      }

      if (response.status === 403 && data.code === "REGENERATION_LIMIT_REACHED") {
        setRegenerateError(data.error);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || data.details || "Regeneration failed");
      }

      const updatedDays = tripData.days.map((d) =>
        d.day === dayNumber ? data.day : d
      );

      const nextTripData = {
        ...tripData,
        days: updatedDays,
        regenerationsUsed: data.regenerationsUsed ?? regenerationsUsed + 1,
      };

      onTripDataChange?.(nextTripData);

      if (tripId) {
        const patchRes = await fetch("/api/update-trip", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: tripId, itinerary: nextTripData }),
        });

        if (!patchRes.ok) {
          const patchData = await patchRes.json();
          throw new Error(
            patchData.error || "Day updated locally but failed to save"
          );
        }
      }

      setExpandedDays((prev) => new Set(prev).add(dayNumber));
    } catch (err) {
      setRegenerateError(
        err instanceof Error ? err.message : "Could not regenerate this day"
      );
    } finally {
      setRegeneratingDay(null);
    }
  }

  return (
    <div className="bg-[#F8FAFC] pb-16">
      <div className="mx-auto max-w-[1400px] px-6 pt-6">
        {/* ─── Hero ─── */}
        <section className="relative h-[400px] overflow-hidden rounded-[20px] shadow-soft md:h-[420px]">
          <div
            className="absolute inset-0 bg-cover bg-center transition-[background-image] duration-500"
            style={{ backgroundImage: `url('${heroImage}')` }}
            role="img"
            aria-label={destination}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />

          {/* Budget card — top right */}
          <div className="absolute top-6 right-6 w-[272px] rounded-[22px] bg-white p-5 shadow-[0_8px_32px_rgba(15,23,42,0.14)]">
            <div
              ref={budgetInfoRef}
              className="relative flex items-center gap-1"
            >
              <p className="text-[10px] font-semibold tracking-[0.1em] text-[#64748B] uppercase">
                Estimated Budget
              </p>
              <button
                type="button"
                onClick={() => setBudgetInfoOpen((o) => !o)}
                className="cursor-pointer rounded-full p-0.5 text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#64748B]"
                aria-label="Budget estimate details"
                aria-expanded={budgetInfoOpen}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
              {budgetInfoOpen && (
                <div className="absolute top-full right-0 z-20 mt-2 w-[248px] rounded-xl border border-[#E2E8F0]/80 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.12)]">
                  <p className="mb-2 text-xs font-semibold text-[#0F172A]">
                    About this estimate
                  </p>
                  <ul className="space-y-2">
                    {BUDGET_INFO_ITEMS.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-[11px] leading-snug text-[#64748B]"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#F97316]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <p className="mt-1 text-2xl font-bold leading-tight tracking-tight text-[#0F172A]">
              {budgetDisplay.mainAmount}
            </p>
            {budgetDisplay.rangeLine && (
              <p className="mt-0.5 text-xs font-medium text-[#64748B]">
                Range: {budgetDisplay.rangeLine}
              </p>
            )}
            <p className="mt-1 text-[11px] leading-snug text-[#64748B]">
              {budgetDisplay.subtitle}
            </p>
            <div className="mt-4 space-y-2">
              {saveButton ?? (
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F97316] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c]"
                >
                  <Bookmark className="h-4 w-4" />
                  Save to My Trips
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={!canShare || shareBusy}
                  title={
                    canShare
                      ? "Share your saved trip link"
                      : "Save this trip first to get a shareable link"
                  }
                  className="flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {shareBusy ? "Sharing…" : "Share"}
                </button>
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  disabled={!canShare || shareBusy}
                  title={
                    canShare
                      ? "Share on WhatsApp"
                      : "Save this trip first to share on WhatsApp"
                  }
                  className="flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#25D366]/30 bg-[#25D366]/5 px-3 py-2 text-xs font-medium text-[#128C7E] transition-colors hover:bg-[#25D366]/10 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                  WhatsApp
                </button>
              </div>
              {!canShare && (
                <p className="text-center text-[10px] leading-snug text-[#94A3B8]">
                  Save trip to unlock sharing
                </p>
              )}
              <button
                type="button"
                onClick={handlePdfDownload}
                disabled={pdfBusy || !tripData?.days?.length}
                className="flex min-h-[40px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <FileText className={`h-3.5 w-3.5 ${pdfBusy ? "animate-pulse" : ""}`} />
                {pdfBusy ? "Generating…" : "Download PDF"}
              </button>
              {isPro && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCalendarExport}
                    disabled={icsBusy || !tripData?.days?.length}
                    className="flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] px-2 py-2 text-[11px] font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] disabled:opacity-45"
                  >
                    <Calendar className={`h-3.5 w-3.5 ${icsBusy ? "animate-pulse" : ""}`} />
                    {icsBusy ? "…" : "Calendar"}
                  </button>
                  <button
                    type="button"
                    onClick={handleOfflinePack}
                    disabled={offlineBusy || !tripData?.days?.length}
                    className="flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] px-2 py-2 text-[11px] font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] disabled:opacity-45"
                  >
                    <FileText className={`h-3.5 w-3.5 ${offlineBusy ? "animate-pulse" : ""}`} />
                    {offlineBusy ? "…" : "Offline Pack"}
                  </button>
                </div>
              )}
              {expensesHref && (
                <Link
                  href={expensesHref}
                  className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#F97316]/40 bg-[#FFF7ED] px-3 py-2 text-xs font-semibold text-[#F97316] transition-colors hover:bg-[#F97316] hover:text-white"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Expense Tracker
                  <ProBadge className="ml-1 scale-90" />
                </Link>
              )}
            </div>
          </div>

          {/* Title block — bottom left, clear of budget card */}
          <div className="absolute right-[300px] bottom-8 left-6 text-white">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/35 px-3 py-1.5 text-xs font-medium backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                {heroBadge}
              </span>
              {canRegenerate && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/35 px-3 py-1.5 text-xs font-medium backdrop-blur-md">
                  <Zap className="h-3.5 w-3.5" />
                  {isPro
                    ? "Pro · Unlimited regenerations"
                    : `${regenerationsUsed} / ${FREE_REGENERATIONS_PER_TRIP} Regenerations Used`}
                </span>
              )}
            </div>
            <h1 className="text-[32px] font-bold leading-tight tracking-tight drop-shadow-sm md:text-[40px]">
              {title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/95">
              {tripData.bestTimeToVisit && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 shrink-0 opacity-90" />
                  {tripData.bestTimeToVisit}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Wallet className="h-4 w-4 shrink-0 opacity-90" />
                Est. {budgetDisplay.heroShort}
              </span>
              <span className="hidden text-white/40 sm:inline">·</span>
              <span>{dayCount} Days</span>
              <span className="text-white/40">·</span>
              <span>{activityCount} Activities</span>
              <span className="text-white/40">·</span>
              <span>{placeCount} Destinations</span>
            </div>
          </div>
        </section>

        {/* ─── Stats row ─── */}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            emoji="⛅"
            label="Weather"
            title={weatherTitle}
            subtitle={weatherSubtitle}
            loading={liveLoading}
          />
          <StatCard
            icon={Banknote}
            iconTone="green"
            label="Currency"
            title={currencyTitle}
            subtitle={currencySubtitle}
            loading={liveLoading}
          />
          <StatCard
            icon={Calendar}
            iconTone="blue"
            label="Trip Stats"
            tripStats={{
              days: dayCount,
              activities: activityCount,
              places: placeCount,
            }}
          />
          <StatCard
            emoji="💰"
            label="Planned Spend"
            title={plannedSpend.title}
            progress={plannedSpend.percentage}
            progressCaption="of estimated budget"
          />
        </div>

        {regenerateError && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{regenerateError}</p>
            <button
              type="button"
              onClick={() => setRegenerateError("")}
              className="shrink-0 cursor-pointer text-xs font-semibold uppercase tracking-wide"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ─── Packing essentials ─── */}
        {tripData.packingEssentials?.length > 0 && (
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0F172A]">
                Packing Essentials
              </h2>
              <button
                type="button"
                className="cursor-pointer text-sm font-medium text-[#1E3A8A] transition-colors hover:text-[#1E40AF]"
              >
                View all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tripData.packingEssentials.map((item) => {
                const PackIcon = getPackingIcon(item);
                return (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE]/60 bg-[#EFF6FF] px-4 py-2.5 text-xs font-medium text-[#0F172A] transition-all hover:border-[#93C5FD]/80 hover:bg-[#DBEAFE] hover:shadow-sm"
                  >
                    <PackIcon className="h-4 w-4 shrink-0 text-[#3B82F6]" />
                    {item}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Two-column main ─── */}
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* LEFT sidebar */}
          <aside className="lg:w-[300px] lg:shrink-0">
            <div className="space-y-5 lg:sticky lg:top-[96px]">
              {/* Jump To */}
              <div className="rounded-[16px] bg-white p-5 shadow-soft">
                <h3 className="mb-3 text-sm font-bold text-[#0F172A]">
                  Jump To
                </h3>
                <nav className="day-scroller max-h-[260px] space-y-1 overflow-y-auto">
                  {tripData.days?.map((day) => {
                    const isActive = activeDay === day.day;
                    return (
                      <button
                        key={day.day}
                        type="button"
                        onClick={() => scrollToDay(day.day)}
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                          isActive
                            ? "border-l-[3px] border-[#1E3A8A] bg-[#EFF6FF] font-medium text-[#1E3A8A]"
                            : "text-[#64748B] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        <span className="font-semibold text-[#64748B]">
                          {String(day.day).padStart(2, "0")}
                        </span>
                        <span className="truncate">{day.theme}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* AI Assistant Pro */}
              <div className="relative overflow-hidden rounded-[16px] bg-[#1E3A8A] p-5 text-white shadow-soft">
                <ProBadge className="absolute top-4 right-4" />
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <Sparkles className="h-4 w-4" />
                  AI Assistant
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/80">
                  Edit itinerary, ask questions, add attractions and more.
                </p>
                <ul className="mt-3 space-y-2">
                  {AI_FEATURES.map((feat) => (
                    <li
                      key={feat}
                      className="flex items-center gap-2 text-sm text-white/75"
                    >
                      <Check className="h-3.5 w-3.5 shrink-0 text-[#F97316]" />
                      {feat}
                    </li>
                  ))}
                </ul>
                {isPro ? (
                  <p className="mt-4 rounded-xl bg-white/10 px-3 py-2.5 text-center text-xs font-medium text-white/90">
                    Pro active — AI features unlocked
                  </p>
                ) : (
                  <Link
                    href="/pricing"
                    className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#F97316] py-2.5 text-sm font-semibold text-white hover:bg-[#ea580c]"
                  >
                    Upgrade to Pro
                  </Link>
                )}
              </div>

              {/* Trip Overview */}
              <div className="rounded-[16px] bg-white p-5 shadow-soft">
                <h3 className="mb-4 text-sm font-bold text-[#0F172A]">
                  Trip Overview
                </h3>
                <dl className="space-y-3">
                  <OverviewRow
                    icon={Calendar}
                    label="Start Date"
                    value="Oct 12, 2024"
                  />
                  <OverviewRow
                    icon={Calendar}
                    label="End Date"
                    value={`Oct ${12 + dayCount - 1}, 2024`}
                  />
                  <OverviewRow
                    icon={Users}
                    label="Travelers"
                    value="2 Adults"
                  />
                </dl>

                <TripTypeBlock vibeParts={tripVibe} />
              </div>
            </div>
          </aside>

          {/* RIGHT timeline */}
          <div className="min-w-0 flex-1">
            {tripData.days?.map((day, dayIndex) => {
              const isExpanded = expandedDays.has(day.day);
              const dayCostTotal = sumDayCost(day);
              const slots = PERIODS.filter((p) => day[p.key]);
              const DayIcon = DAY_ICONS[dayIndex % DAY_ICONS.length];
              // AI chat editor highlight state for this day card
              const isAiFlash = aiFlashDays.includes(day.day);
              const hasAiBadge = aiBadgeDays.includes(day.day);
              const aiBadge = hasAiBadge && (
                <span className="absolute -top-2.5 right-4 z-10 rounded-full bg-[#F97316] px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
                  ✓ Updated by AI
                </span>
              );

              if (!isExpanded) {
                return (
                  <button
                    key={day.day}
                    type="button"
                    id={`day-${day.day}`}
                    onClick={() => toggleDay(day.day)}
                    className={`scroll-mt-28 relative mb-3 flex w-full cursor-pointer items-center gap-4 rounded-xl bg-[#F1F5F9] px-4 py-4 text-left transition-shadow duration-700 hover:bg-[#E2E8F0] md:px-5 ${isAiFlash ? "ai-day-flash" : ""}`}
                  >
                    {aiBadge}
                    <div className="timeline-day-node !h-10 !w-10">
                      <DayIcon className="h-5 w-5" />
                    </div>
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="itinerary-day-label">
                          {formatDayLabel(day.day)}
                        </p>
                        <h2 className="truncate text-base font-bold text-[#0F172A]">
                          {day.theme}
                        </h2>
                      </div>
                      <div className="hidden shrink-0 items-center gap-4 sm:flex">
                        <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
                          <Calendar className="h-4 w-4" />
                          {slots.length} Activities
                        </span>
                        {dayCostTotal && (
                          <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
                            <Wallet className="h-4 w-4" />
                            Est. {dayCostTotal}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className="h-5 w-5 shrink-0 text-[#64748B]" />
                  </button>
                );
              }

              return (
                <article
                  key={day.day}
                  id={`day-${day.day}`}
                  className={`relative mb-12 scroll-mt-28 rounded-xl transition-shadow duration-700 ${isAiFlash ? "ai-day-flash" : ""}`}
                >
                  {aiBadge}
                  <div
                    className="itinerary-timeline-rail pointer-events-none absolute top-[44px] bottom-8 left-[21px]"
                    aria-hidden="true"
                  />

                  {/* Day header */}
                  <div className="relative flex gap-5">
                    <div className="relative z-10 flex w-11 shrink-0 justify-center">
                      <div className="timeline-day-node">
                        <DayIcon className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mb-6 flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="itinerary-day-label">
                          {formatDayLabel(day.day)}
                        </p>
                        <h2 className="text-[22px] font-bold leading-tight text-[#0F172A] md:text-[26px]">
                          {day.theme}
                        </h2>
                        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#64748B]">
                          {getDaySummary(day, destination)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-start gap-4">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                          <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
                            <Calendar className="h-4 w-4" />
                            {slots.length} Activities
                          </span>
                          {dayCostTotal && (
                            <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
                              <Wallet className="h-4 w-4" />
                              Est. {dayCostTotal}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleDay(day.day)}
                          className="hidden cursor-pointer text-[#64748B] hover:text-[#0F172A] md:block"
                          aria-label="Collapse day"
                        >
                          <ChevronUp className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Activities */}
                  {PERIODS.map((period, periodIndex) => {
                    const slot = day[period.key];
                    if (!slot) return null;
                    const { Icon: CategoryIcon, label } = getCategoryMeta(
                      slot,
                      period
                    );
                    const mapsUrl = getGoogleMapsLink(
                      slot.place,
                      tripData.destination
                    );

                    return (
                      <div key={period.key} className="relative flex gap-5">
                        <div className="relative z-10 flex w-11 shrink-0 justify-center pt-7">
                          {period.key === "morning" && (
                            <div className="timeline-dot" />
                          )}
                          {period.key === "afternoon" && (
                            <div className="timeline-sun-marker">
                              <Sun className="h-3 w-3" />
                            </div>
                          )}
                          {period.key === "evening" && (
                            <div className="timeline-moon-marker">
                              <Moon className="h-3 w-3" />
                            </div>
                          )}
                        </div>

                        <div className="mb-4 flex min-w-0 flex-1 flex-col gap-0 rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-soft sm:flex-row sm:gap-5 md:mb-5">
                          <ActivityImage
                            place={slot.place}
                            activity={slot.activity}
                            destination={tripData.destination}
                          />
                          <div className="flex min-w-0 flex-1 flex-col pt-4 sm:pt-0">
                            {/* Row 1: time label + price — never overlaps title */}
                            <div className="flex items-start justify-between gap-4">
                              <p className="itinerary-time-label shrink-0 pt-0.5">
                                {period.label}
                              </p>
                              {slot.cost && (
                                <p className="max-w-[58%] text-right text-xs leading-snug font-bold text-[#0F172A] sm:text-sm">
                                  {slot.cost}
                                </p>
                              )}
                            </div>
                            {/* Row 2: title — full width */}
                            <h3 className="mt-2 text-[17px] font-bold leading-snug text-[#0F172A] md:text-lg">
                              {slot.activity}
                            </h3>
                            <p className="mt-1.5 flex items-start gap-1 text-sm text-[#64748B]">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span className="leading-snug">{slot.place}</span>
                            </p>
                            <p className="mt-2 line-clamp-3 text-sm leading-[1.65] text-[#64748B]">
                              {getActivityDescription(slot, period)}
                            </p>
                            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#64748B]">
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {slot.duration || period.duration}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <CategoryIcon className="h-3.5 w-3.5" />
                                {label}
                              </span>
                              {mapsUrl && (
                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 text-[11px] font-semibold text-[#1E3A8A] transition-colors hover:bg-white hover:border-[#CBD5E1]"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Maps
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex gap-5">
                    <div className="w-11 shrink-0" aria-hidden="true" />
                    <div className="flex flex-1 flex-col items-center gap-2 pb-2">
                      {isPro && (
                        <button
                          type="button"
                          onClick={() => openActivityBuilder(day.day)}
                          className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#F97316]/40 bg-[#FFF7ED] px-6 py-2 text-sm font-medium text-[#F97316] transition-colors hover:bg-[#F97316] hover:text-white"
                        >
                          <Plus className="h-4 w-4" />
                          Add custom activity
                        </button>
                      )}
                      {canRegenerate && (
                        <button
                          type="button"
                          onClick={() => handleRegenerateDay(day.day)}
                          disabled={
                            regeneratingDay != null || atRegenerationLimit
                          }
                          className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-8 py-2.5 text-sm font-medium text-[#0F172A] shadow-soft hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${
                              regeneratingDay === day.day ? "animate-spin" : ""
                            }`}
                          />
                          {regeneratingDay === day.day
                            ? "Regenerating..."
                            : "Regenerate this day"}
                        </button>
                      )}
                      {canRegenerate &&
                        atRegenerationLimit &&
                        day.day === tripData.days?.[tripData.days.length - 1]?.day && (
                          <p className="max-w-md text-center text-xs text-[#64748B]">
                            Free limit reached.{" "}
                            <Link
                              href="/"
                              className="font-semibold text-[#F97316] hover:underline"
                            >
                              Upgrade to Pro
                            </Link>{" "}
                            for unlimited day regenerations.
                          </p>
                        )}
                    </div>
                  </div>
                </article>
              );
            })}

            {footerExtra && <div className="pt-6">{footerExtra}</div>}
          </div>
        </div>
      </div>

      {/* Custom activity builder modal (Pro) */}
      <Modal
        isOpen={Boolean(activityModal)}
        onClose={() => !activitySaving && setActivityModal(null)}
        title={
          activityModal
            ? `Add activity — Day ${activityModal.dayNumber}`
            : "Add activity"
        }
      >
        <form onSubmit={handleSaveCustomActivity} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-[#64748B]">Time of day</label>
            <select
              value={activityForm.period}
              onChange={(e) =>
                setActivityForm((f) => ({ ...f, period: e.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm outline-none focus:border-[#F97316]"
            >
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748B]">Activity</label>
            <input
              required
              value={activityForm.activity}
              onChange={(e) =>
                setActivityForm((f) => ({ ...f, activity: e.target.value }))
              }
              placeholder="e.g. Sunset boat ride"
              className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm outline-none focus:border-[#F97316]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748B]">Place</label>
            <input
              value={activityForm.place}
              onChange={(e) =>
                setActivityForm((f) => ({ ...f, place: e.target.value }))
              }
              placeholder="e.g. Chao Phraya River"
              className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm outline-none focus:border-[#F97316]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#64748B]">Cost</label>
              <input
                value={activityForm.cost}
                onChange={(e) =>
                  setActivityForm((f) => ({ ...f, cost: e.target.value }))
                }
                placeholder="฿500"
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm outline-none focus:border-[#F97316]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#64748B]">Duration</label>
              <input
                value={activityForm.duration}
                onChange={(e) =>
                  setActivityForm((f) => ({ ...f, duration: e.target.value }))
                }
                placeholder="2 hrs"
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm outline-none focus:border-[#F97316]"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748B]">Notes</label>
            <textarea
              value={activityForm.description}
              onChange={(e) =>
                setActivityForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={2}
              placeholder="Optional details…"
              className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm outline-none focus:border-[#F97316]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActivityModal(null)}
              disabled={activitySaving}
              className="cursor-pointer rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-semibold text-[#64748B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={activitySaving}
              className="cursor-pointer rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-60"
            >
              {activitySaving ? "Saving…" : "Save activity"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ActivityImage({ place, activity, destination }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({
      place: place || "",
      activity: activity || "",
      destination: destination || "",
    });

    fetch(`/api/place-image?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSrc(data.url || PLACE_IMAGE_FALLBACK);
      })
      .catch(() => {
        if (cancelled) return;
        setSrc(getPlaceImage(place, activity, destination));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [place, activity, destination]);

  return (
    <div className="h-[140px] w-full shrink-0 overflow-hidden rounded-xl bg-[#E2E8F0] sm:h-[148px] sm:w-[148px]">
      {loading || !src ? (
        <div className="h-full w-full animate-pulse bg-[#CBD5E1]/60" aria-hidden="true" />
      ) : (
        <img
          src={src}
          alt={place || activity || "Activity"}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setSrc(PLACE_IMAGE_FALLBACK)}
        />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  emoji,
  iconTone = "blue",
  label,
  title,
  subtitle,
  progress,
  progressCaption,
  tripStats,
  loading = false,
}) {
  const iconWrap =
    iconTone === "green"
      ? "bg-emerald-50 text-emerald-600"
      : "bg-blue-50 text-blue-600";

  return (
    <div className="rounded-xl border border-[#E2E8F0]/50 bg-white px-4 py-4 shadow-soft transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(15,23,42,0.08)]">
      {/* Header: icon + label on one line */}
      <div className="flex items-center gap-2">
        {emoji ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center text-base leading-none" aria-hidden="true">
            {emoji}
          </span>
        ) : (
          Icon && (
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconWrap}`}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
            </span>
          )
        )}
        <span className="text-xs font-semibold text-[#1E3A8A]">{label}</span>
      </div>

      {tripStats ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-[#0F172A]">
          <span>{tripStats.days} Days</span>
          <span>{tripStats.activities} Activities</span>
          <span>{tripStats.places} Places</span>
        </div>
      ) : (
        <div className="mt-2">
          <p
            className={`font-bold leading-tight text-[#0F172A] ${
              progress != null ? "line-clamp-2 text-xs" : "text-sm"
            } ${loading ? "animate-pulse text-[#94A3B8]" : ""}`}
          >
            {title}
          </p>
          {subtitle && (
            <p
              className={`mt-1 text-xs leading-snug text-[#64748B] ${
                loading ? "animate-pulse" : ""
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}

      {progress != null && (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#E2E8F0]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] font-semibold text-[#0F172A]">
            {progress}%
          </span>
        </div>
      )}

      {progress != null && progressCaption && (
        <p className="mt-1.5 text-[10px] text-[#64748B]">{progressCaption}</p>
      )}
    </div>
  );
}

function TripTypeBlock({ vibeParts }) {
  const { styleParts, interests } = vibeParts;
  const hasContent = styleParts.length > 0 || interests.length > 0;

  if (!hasContent) {
    return (
      <div className="mt-4 border-t border-[#F1F5F9] pt-4">
        <p className="flex items-center gap-2 text-sm text-[#64748B]">
          <Heart className="h-4 w-4 shrink-0" />
          Trip Type
        </p>
        <p className="mt-2 text-sm font-medium text-[#0F172A]">
          Custom adventure
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-[#F1F5F9] pt-4">
      <p className="flex items-center gap-2 text-sm text-[#64748B]">
        <Heart className="h-4 w-4 shrink-0" />
        Trip Type
      </p>

      {styleParts.length > 0 && (
        <p className="mt-2 text-sm font-semibold leading-snug text-[#0F172A]">
          {styleParts.join(" · ")}
        </p>
      )}

      {interests.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {interests.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#FFEDD5] bg-[#FFF7ED] px-2.5 py-1 text-[11px] font-medium text-[#9A3412]"
            >
              <span className="h-1 w-1 shrink-0 rounded-full bg-[#F97316]" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OverviewRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="flex items-center gap-2 text-[#64748B]">
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </dt>
      <dd className="font-medium text-[#0F172A]">{value}</dd>
    </div>
  );
}

function WhatsAppIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
