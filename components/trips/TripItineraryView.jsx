"use client";

/**
 * Travora itinerary — pixel-perfect match to reference screenshot.
 * Used on /results and /trip/[id]. Functionality preserved; layout is fixed.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
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
import QuickAddExpense from "@/components/trips/QuickAddExpense";
import {
  buildTripShareText,
  getTripShareUrl,
  openWhatsAppShare,
  sanitizeTripId,
  shareTripNative,
} from "@/utils/shareTrip";
import {
  buildWhatsAppDayDigest,
  listDigestDays,
} from "@/utils/whatsappDigest";
import { downloadTripPdf } from "@/utils/downloadTripPdf";
import { getGoogleMapsLink } from "@/utils/googleMaps";
import { formatMoney, parseBudgetRange } from "@/utils/expenseBudget";
import Modal from "@/components/ui/Modal";
import LiveWeatherCard from "@/components/trips/LiveWeatherCard";
import LiveCurrencyCard from "@/components/trips/LiveCurrencyCard";
import OpenNowBadge from "@/components/trips/OpenNowBadge";
import EditInviteControls from "@/components/trips/EditInviteControls";
import { useTripLiveData } from "@/hooks/useTripLiveData";
import { parseTripVibe } from "@/lib/destinationLive";
import {
  formatTravelersLabel,
  formatTripTypeLine,
  resolveTravelProfile,
} from "@/lib/travelProfile";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80";

const PERIODS = [
  { key: "morning", label: "MORNING", duration: "2 hrs", category: "Easy" },
  { key: "afternoon", label: "AFTERNOON", duration: "3 hrs", category: "Moderate" },
  { key: "evening", label: "EVENING", duration: "2 hrs", category: "Dinner" },
];

const PACKING_ICON_MAP = {
  "hiking boots": Footprints,
  sunscreen: Sun,
  "power bank": Battery,
  "rain shell": CloudRain,
  "first aid kit": Cross,
};

/** Sidebar checklist → tappable prompts that open AI chat prefilled */
const AI_QUICK_PROMPTS = [
  {
    label: "Swap an activity",
    prompt:
      "Swap the afternoon activity on Day 1 for a different option that still matches my traveler type and interests, and update its cost.",
  },
  {
    label: "Ask travel questions",
    prompt:
      "Quick question — what's the best local tip for Day 1 without changing my itinerary yet?",
  },
  {
    label: "Add attractions",
    prompt:
      "Add one new attraction that fits my trip type and interests — place it in an open slot or replace the weakest stop, and update costs.",
  },
  {
    label: "Change budget",
    prompt:
      "Regenerate Day 2 around a tighter budget while keeping my traveler type the same, and update activity costs.",
  },
];

function formatOverviewDate(iso) {
  if (!iso) return null;
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function buildOverviewSchedule(tripData, tripMeta, dayCount) {
  const from = tripData.fromDate || tripMeta?.fromDate;
  const to = tripData.toDate || tripMeta?.toDate;
  const fromLabel = formatOverviewDate(from);
  const toLabel = formatOverviewDate(to);

  if (fromLabel && toLabel) {
    const end = new Date(`${to}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = end < today;
    return {
      startLabel: "Start",
      startValue: fromLabel,
      endLabel: "End",
      endValue: isPast ? `${toLabel} · Past` : toLabel,
      isPast,
    };
  }

  const month = tripData.travelMonth || tripMeta?.travelMonth;
  if (month) {
    return {
      startLabel: "Timing",
      startValue: `Roughly ${month}`,
      endLabel: "Length",
      endValue: `${dayCount} days`,
      isPast: false,
    };
  }

  return {
    startLabel: "Timing",
    startValue: "Flexible",
    endLabel: "Length",
    endValue: `${dayCount} days`,
    isPast: false,
  };
}

function isNonMonetaryCost(cost) {
  if (!cost) return true;
  const s = String(cost).trim().toLowerCase();
  return s === "free" || s === "included" || s === "n/a" || s === "—" || s === "-";
}

/** Drop parenthetical breakdowns so "฿300 (Wat Pho ฿200…)" stays ฿300 */
function stripCostNotes(cost) {
  return String(cost)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .trim();
}

/**
 * Parse AI cost strings into a numeric range.
 * Handles "฿200-500", "approx ₹1,500", and ignores nested price notes.
 */
function parseCostRange(cost) {
  if (isNonMonetaryCost(cost)) return null;

  const core = stripCostNotes(cost);
  if (!core) return null;

  const symbolMatch = core.match(/[₹$€£¥฿]/);
  const symbol = symbolMatch ? symbolMatch[0] : "";
  const cleaned = core.replace(/,/g, "");

  const rangeMatch = cleaned.match(
    /(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)/
  );
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    if (Number.isNaN(low) || Number.isNaN(high)) return null;
    return { low: Math.min(low, high), high: Math.max(low, high), symbol };
  }

  const single = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!single) return null;
  const n = parseFloat(single[1]);
  if (Number.isNaN(n)) return null;
  return { low: n, high: n, symbol };
}

function parseCostValue(cost) {
  const range = parseCostRange(cost);
  if (!range) return 0;
  return (range.low + range.high) / 2;
}

function getCurrencyPrefix(day) {
  for (const p of PERIODS) {
    const range = parseCostRange(day[p.key]?.cost);
    if (range?.symbol) return range.symbol;
  }
  return "₹";
}

function formatMoneyAmount(amount, symbol) {
  const locale = symbol === "₹" ? "en-IN" : "en-US";
  return `${symbol}${Math.round(amount).toLocaleString(locale)}`;
}

function sumDayCost(day) {
  let low = 0;
  let high = 0;
  let symbol = "";
  let found = false;

  for (const p of PERIODS) {
    const range = parseCostRange(day[p.key]?.cost);
    if (!range) continue;
    found = true;
    low += range.low;
    high += range.high;
    if (!symbol && range.symbol) symbol = range.symbol;
  }

  if (!found) return null;
  if (!symbol) symbol = getCurrencyPrefix(day);

  if (Math.round(low) === Math.round(high)) {
    return formatMoneyAmount(low, symbol);
  }
  return `${formatMoneyAmount(low, symbol)} – ${formatMoneyAmount(high, symbol)}`;
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
  const cleaned = stripCostNotes(str).replace(/,/g, "");
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

/** AI activity-cost estimate vs budget (used before any expenses are logged) */
function computePlannedSpend(days, budgetEstimate) {
  let total = 0;
  let found = false;
  let symbol = "";

  days?.forEach((day) => {
    PERIODS.forEach((p) => {
      const range = parseCostRange(day[p.key]?.cost);
      if (!range) return;
      total += (range.low + range.high) / 2;
      found = true;
      if (!symbol && range.symbol) symbol = range.symbol;
    });
  });

  const budget = parseBudgetRange(budgetEstimate);
  if (!found || !budget.low) {
    return { title: "—", percentage: null, caption: "of estimated budget" };
  }

  const percentage = Math.min(100, Math.round((total / budget.low) * 100));
  return {
    title: formatMoney(total, symbol || budget.symbol),
    percentage,
    caption: "of estimated budget",
  };
}

/** Logged expenses vs estimated budget range — drives the live progress bar */
function computeLoggedSpend(totalSpent, budgetEstimate, metaBudget) {
  const budget = parseBudgetRange(budgetEstimate, metaBudget);
  if (!budget.low) {
    return {
      title: formatMoney(totalSpent, budget.symbol),
      percentage: null,
      caption: "log expenses to track budget",
      label: "Trip Spend",
    };
  }

  const percentage = Math.min(
    100,
    Math.round((totalSpent / budget.low) * 100)
  );
  return {
    title: formatMoney(totalSpent, budget.symbol),
    percentage,
    caption: `of ${budget.label}`,
    label: "Trip Spend",
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
  onOpenAiAssistant = null,
  showEditInvite = false,
}) {
  const { tripMeta } = tripData;
  const destination = capitalizeDestination(tripData.destination);
  const title = destination.includes("Adventure")
    ? destination
    : `${destination} Adventure`;

  const dayCount = tripData.days?.length ?? tripMeta?.days ?? 0;
  const activityCount = countActivities(tripData.days);
  const placeCount = countPlaces(tripData.days);
  const travelProfile = resolveTravelProfile(tripData, tripMeta?.vibe);
  const tripVibeParsed = {
    styleParts: formatTripTypeLine(travelProfile)
      ? formatTripTypeLine(travelProfile).split(" · ")
      : parseTripVibe(tripMeta?.vibe).styleParts,
    interests: travelProfile.interests?.length
      ? travelProfile.interests
      : parseTripVibe(tripMeta?.vibe).interests,
  };
  const vibeShort =
    formatTripTypeLine(travelProfile) ||
    tripVibeParsed.styleParts.join(" · ") ||
    tripMeta?.vibe?.split(". Interests:")[0]?.trim() ||
    "";
  const budget = tripData.totalBudgetEstimate || tripMeta?.budget || "₹42,500";
  const budgetCap = tripMeta?.budget || "₹50,000";
  const budgetDisplay = formatBudgetDisplay(budget, budgetCap, vibeShort);
  const overviewSchedule = buildOverviewSchedule(
    tripData,
    tripMeta,
    dayCount
  );
  const travelersLabel = formatTravelersLabel(travelProfile);
  const aiPlannedSpend = computePlannedSpend(
    tripData.days,
    tripData.totalBudgetEstimate || tripMeta?.budget
  );

  const [activeDay, setActiveDay] = useState(1);
  const [budgetInfoOpen, setBudgetInfoOpen] = useState(false);
  const budgetInfoRef = useRef(null);
  // Live logged expenses (Expense Tracker — owners Pro / collab editors)
  const [loggedTotal, setLoggedTotal] = useState(null);
  const trackLiveSpend = Boolean(expensesHref && tripId);
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
  const [whatsappDayPickerOpen, setWhatsappDayPickerOpen] = useState(false);
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

  // Live Trip Spend bar — sum logged expenses for this trip (Pro tracker)
  useEffect(() => {
    if (!trackLiveSpend) {
      setLoggedTotal(null);
      return;
    }

    let cancelled = false;

    async function loadLoggedSpend() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("expenses")
        .select("amount")
        .eq("trip_id", tripId);

      if (cancelled) return;
      if (error) {
        setLoggedTotal(0);
        return;
      }
      const total = (data ?? []).reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0
      );
      setLoggedTotal(total);
    }

    loadLoggedSpend();

    function onFocus() {
      loadLoggedSpend();
    }
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [trackLiveSpend, tripId]);

  const spendCard = trackLiveSpend
    ? loggedTotal == null
      ? {
          label: "Trip Spend",
          title: "…",
          percentage: null,
          caption: "loading logged expenses",
        }
      : computeLoggedSpend(
          loggedTotal,
          tripData.totalBudgetEstimate || tripMeta?.budget,
          tripMeta?.budget
        )
    : {
        ...aiPlannedSpend,
        label: "Planned Spend",
        caption: aiPlannedSpend.caption || "of estimated budget",
      };

  const tripVibe = tripVibeParsed;

  const atRegenerationLimit =
    canRegenerate && !isPro && regenerationsUsed >= FREE_REGENERATIONS_PER_TRIP;

  const liveTimezone =
    liveData?.timezone || liveData?.weather?.timezone || "UTC";

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
    return {
      url,
      shareText,
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

  /** WhatsApp = day digest (not a duplicate of Share’s link) */
  function sendWhatsAppDayDigest(dayNumber) {
    if (!tripData?.days?.length) return;

    const url = canShare ? getTripShareUrl(activeShareId) : "";
    const digest = buildWhatsAppDayDigest({
      tripData: { ...tripData, destination: title },
      dayNumber,
      url,
    });
    openWhatsAppShare(digest);
    setWhatsappDayPickerOpen(false);
    showToast(`Day ${dayNumber} digest ready in WhatsApp`, "success");
  }

  function handleWhatsAppDigest() {
    if (!tripData?.days?.length) return;

    const days = listDigestDays(tripData);
    if (days.length <= 1) {
      sendWhatsAppDayDigest(days[0]?.day ?? 1);
      return;
    }
    setWhatsappDayPickerOpen(true);
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

  const budgetActions = (
    <>
      <div ref={budgetInfoRef} className="relative flex items-center gap-1">
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
          <div className="absolute top-full left-0 z-20 mt-2 w-[min(248px,calc(100vw-3rem))] rounded-xl border border-[#E2E8F0]/80 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.12)] sm:left-auto sm:right-0">
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
      <p className="mt-1 text-xl font-bold leading-tight tracking-tight text-[#0F172A] sm:text-2xl">
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
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F97316] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c]"
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
                ? "Copy or share your saved trip link"
                : "Save this trip first to get a shareable link"
            }
            className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Share2 className="h-3.5 w-3.5" />
            {shareBusy ? "Sharing…" : "Share"}
          </button>
          <button
            type="button"
            onClick={handleWhatsAppDigest}
            disabled={!tripData?.days?.length}
            title="Send a formatted day itinerary via WhatsApp"
            className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#25D366]/30 bg-[#25D366]/5 px-3 py-2 text-xs font-medium text-[#128C7E] transition-colors hover:bg-[#25D366]/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <WhatsAppIcon className="h-3.5 w-3.5" />
            WhatsApp
          </button>
        </div>
        {!canShare && (
          <p className="text-center text-[10px] leading-snug text-[#94A3B8]">
            Save trip to unlock Share link · WhatsApp works now
          </p>
        )}
        {showEditInvite && tripId && (
          <EditInviteControls tripId={tripId} />
        )}
        <button
          type="button"
          onClick={handlePdfDownload}
          disabled={pdfBusy || !tripData?.days?.length}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <FileText className={`h-3.5 w-3.5 ${pdfBusy ? "animate-pulse" : ""}`} />
          {pdfBusy ? "Generating…" : "Download PDF"}
        </button>
        {expensesHref && (
          <Link
            href={expensesHref}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#F97316]/40 bg-[#FFF7ED] px-3 py-2 text-xs font-semibold text-[#F97316] transition-colors hover:bg-[#F97316] hover:text-white"
          >
            <Wallet className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Expense Tracker</span>
            <ProBadge className="ml-0.5 shrink-0 scale-90" />
          </Link>
        )}
      </div>
    </>
  );

  return (
    <div className="overflow-x-hidden bg-[#F8FAFC] pb-20 sm:pb-16">
      <div className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-6 sm:pt-6">
        {/* ─── Hero: image + title; budget overlays on lg, stacks below on smaller ─── */}
        <section className="relative">
          <div className="relative h-[260px] overflow-hidden rounded-[16px] shadow-soft sm:h-[340px] sm:rounded-[20px] lg:h-[420px]">
            <div
              className="absolute inset-0 bg-cover bg-center transition-[background-image] duration-500"
              style={{ backgroundImage: `url('${heroImage}')` }}
              role="img"
              aria-label={destination}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />

            {/* Title block */}
            <div className="absolute inset-x-4 bottom-4 text-white sm:inset-x-6 sm:bottom-6 lg:right-[300px] lg:left-6 lg:bottom-8">
              <div className="mb-2 flex flex-wrap gap-1.5 sm:mb-3 sm:gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/35 px-2.5 py-1 text-[11px] font-medium backdrop-blur-md sm:px-3 sm:py-1.5 sm:text-xs">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{heroBadge}</span>
                </span>
                {canRegenerate && (
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/25 bg-black/35 px-2.5 py-1 text-[11px] font-medium backdrop-blur-md sm:px-3 sm:py-1.5 sm:text-xs">
                    <Zap className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {isPro
                        ? "Pro · Unlimited regenerations"
                        : `${regenerationsUsed}/${FREE_REGENERATIONS_PER_TRIP} regenerations`}
                    </span>
                  </span>
                )}
              </div>
              <h1 className="text-[clamp(1.5rem,5vw,2.5rem)] font-bold leading-tight tracking-tight drop-shadow-sm">
                {title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-white/95 sm:mt-3 sm:gap-x-4 sm:gap-y-2 sm:text-sm">
                {tripData.bestTimeToVisit && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" />
                    <span className="line-clamp-1">{tripData.bestTimeToVisit}</span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" />
                  Est. {budgetDisplay.heroShort}
                </span>
                <span>{dayCount} Days</span>
                <span className="text-white/40">·</span>
                <span>{activityCount} Activities</span>
                <span className="hidden text-white/40 sm:inline">·</span>
                <span className="hidden sm:inline">{placeCount} Destinations</span>
              </div>
            </div>
          </div>

          {/* Single budget panel: below hero on mobile, overlay on lg+ */}
          <div className="relative z-10 mt-4 rounded-[16px] border border-[#E2E8F0]/60 bg-white p-4 shadow-[0_8px_32px_rgba(15,23,42,0.14)] sm:rounded-[20px] sm:p-5 lg:absolute lg:top-6 lg:right-6 lg:mt-0 lg:w-[272px] lg:rounded-[22px] lg:border-0 lg:p-5">
            {budgetActions}
          </div>
        </section>

        {/* ─── Stats row ─── */}
        <div className="mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:mt-6 sm:gap-4 md:grid-cols-4">
          <LiveWeatherCard
            weather={liveData?.weather}
            loading={liveLoading}
          />
          <LiveCurrencyCard
            currency={liveData?.currency}
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
            label={spendCard.label}
            title={spendCard.title}
            progress={spendCard.percentage}
            progressCaption={spendCard.caption}
          >
            {trackLiveSpend && (
              <QuickAddExpense
                tripId={tripId}
                onAdded={(amt) =>
                  setLoggedTotal((prev) => Number(prev || 0) + Number(amt || 0))
                }
              />
            )}
          </StatCard>
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
          <div className="mt-6 sm:mt-8">
            <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
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
        <div className="mt-6 flex flex-col gap-5 sm:mt-8 sm:gap-6 lg:flex-row lg:gap-8">
          {/* LEFT sidebar */}
          <aside className="min-w-0 lg:w-[300px] lg:shrink-0">
            <div className="space-y-4 sm:space-y-5 lg:sticky lg:top-[88px]">
              {/* Jump To — horizontal chips on mobile, list on lg */}
              <div className="rounded-[16px] bg-white p-4 shadow-soft sm:p-5">
                <h3 className="mb-3 text-sm font-bold text-[#0F172A]">
                  Jump To
                </h3>
                <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:mx-0 lg:max-h-[260px] lg:flex-col lg:gap-1 lg:overflow-y-auto lg:overflow-x-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
                  {tripData.days?.map((day) => {
                    const isActive = activeDay === day.day;
                    return (
                      <button
                        key={day.day}
                        type="button"
                        onClick={() => scrollToDay(day.day)}
                        className={`flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-left text-sm transition-colors lg:w-full lg:rounded-lg lg:gap-3 lg:py-2.5 ${
                          isActive
                            ? "bg-[#1E3A8A] font-medium text-white lg:border-l-[3px] lg:border-[#1E3A8A] lg:bg-[#EFF6FF] lg:text-[#1E3A8A]"
                            : "bg-[#F8FAFC] text-[#64748B] hover:bg-[#EFF6FF] lg:bg-transparent"
                        }`}
                      >
                        <span
                          className={`font-semibold ${
                            isActive
                              ? "text-white lg:text-[#64748B]"
                              : "text-[#64748B]"
                          }`}
                        >
                          {String(day.day).padStart(2, "0")}
                        </span>
                        <span className="max-w-[140px] truncate lg:max-w-none">
                          {day.theme}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* AI Assistant Pro — opens the floating chat */}
              <div className="relative overflow-hidden rounded-[16px] bg-[#1E3A8A] p-4 text-white shadow-soft sm:p-5">
                <ProBadge className="absolute top-3 right-3 sm:top-4 sm:right-4" />
                <h3 className="flex items-center gap-2 pr-14 text-sm font-bold">
                  <Sparkles className="h-4 w-4" />
                  AI Assistant
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/80">
                  Your flagship editor — tap a prompt below or open chat.
                  Changes update the itinerary live.
                </p>
                <ul className="mt-3 space-y-2">
                  {AI_QUICK_PROMPTS.map((feat) => (
                    <li key={feat.label}>
                      <button
                        type="button"
                        onClick={() => onOpenAiAssistant?.(feat.prompt)}
                        disabled={!onOpenAiAssistant}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-left text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5 shrink-0 text-[#F97316]" />
                        {feat.label}
                      </button>
                    </li>
                  ))}
                </ul>
                {isPro ? (
                  <button
                    type="button"
                    onClick={() => onOpenAiAssistant?.()}
                    disabled={!onOpenAiAssistant}
                    className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#F97316] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Sparkles className="h-4 w-4" />
                    Open AI chat
                  </button>
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
                    label={overviewSchedule.startLabel}
                    value={overviewSchedule.startValue}
                  />
                  <OverviewRow
                    icon={Calendar}
                    label={overviewSchedule.endLabel}
                    value={overviewSchedule.endValue}
                  />
                  <OverviewRow
                    icon={Users}
                    label="Travelers"
                    value={travelersLabel}
                  />
                </dl>

                <TripTypeBlock vibeParts={tripVibeParsed} />
              </div>
            </div>
          </aside>

          {/* RIGHT timeline */}
          <div className="min-w-0 flex-1">
            {tripData.days?.map((day, dayIndex) => {
              const isExpanded = expandedDays.has(day.day);
              const dayCostTotal = sumDayCost(day);
              const slots = PERIODS.filter((p) => day[p.key]);
              // Consistent day marker (not rotating theme icons)
              const DayIcon = Calendar;
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
                    className={`scroll-mt-24 relative mb-3 flex w-full cursor-pointer items-center gap-3 rounded-xl bg-[#F1F5F9] px-3 py-3.5 text-left transition-shadow duration-700 hover:bg-[#E2E8F0] sm:gap-4 sm:px-4 sm:py-4 md:px-5 ${isAiFlash ? "ai-day-flash" : ""}`}
                  >
                    {aiBadge}
                    <div
                      className="timeline-day-node !h-10 !w-10"
                      title={`Day ${day.day}`}
                    >
                      <DayIcon className="h-5 w-5" aria-hidden="true" />
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
                  className={`relative mb-8 scroll-mt-24 rounded-xl transition-shadow duration-700 sm:mb-12 sm:scroll-mt-28 ${isAiFlash ? "ai-day-flash" : ""}`}
                >
                  {aiBadge}
                  <div
                    className="itinerary-timeline-rail pointer-events-none absolute top-[44px] bottom-8 left-[21px] hidden sm:block"
                    aria-hidden="true"
                  />

                  {/* Day header */}
                  <div className="relative flex gap-3 sm:gap-5">
                    <div className="relative z-10 hidden w-11 shrink-0 justify-center sm:flex">
                      <div className="timeline-day-node">
                        <DayIcon className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mb-4 flex min-w-0 flex-1 flex-col gap-2 sm:mb-6 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="itinerary-day-label">
                          {formatDayLabel(day.day)}
                        </p>
                        <h2 className="text-lg font-bold leading-tight text-[#0F172A] sm:text-[22px] md:text-[26px]">
                          {day.theme}
                        </h2>
                        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#64748B]">
                          {getDaySummary(day, destination)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-start gap-3 sm:gap-4">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 sm:gap-x-4">
                          <span className="flex items-center gap-1.5 text-xs text-[#64748B] sm:text-sm">
                            <Calendar className="h-4 w-4" />
                            {slots.length} Activities
                          </span>
                          {dayCostTotal && (
                            <span className="flex items-center gap-1.5 text-xs text-[#64748B] sm:text-sm">
                              <Wallet className="h-4 w-4" />
                              Est. {dayCostTotal}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleDay(day.day)}
                          className="cursor-pointer rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] md:block"
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
                      <div key={period.key} className="relative flex gap-3 sm:gap-5">
                        <div className="relative z-10 hidden w-11 shrink-0 justify-center pt-7 sm:flex">
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

                        <div className="mb-3 flex min-w-0 flex-1 flex-col gap-0 rounded-[16px] border border-[#E2E8F0] bg-white p-3.5 shadow-soft sm:mb-4 sm:flex-row sm:gap-5 sm:p-5 md:mb-5">
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
                            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#64748B]">
                              <span className="inline-flex min-w-0 items-start gap-1">
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span className="leading-snug">{slot.place}</span>
                              </span>
                              {slot.place && (
                                <OpenNowBadge
                                  place={slot.place}
                                  destination={tripData.destination}
                                  timezone={liveTimezone}
                                />
                              )}
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

                  <div className="flex gap-3 sm:gap-5">
                    <div className="hidden w-11 shrink-0 sm:block" aria-hidden="true" />
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

      {/* WhatsApp day digest picker */}
      <Modal
        isOpen={whatsappDayPickerOpen}
        onClose={() => setWhatsappDayPickerOpen(false)}
        title="Send day digest on WhatsApp"
      >
        <p className="mb-4 text-sm text-[#64748B]">
          Pick a day to send as a formatted itinerary message. Share still
          handles the trip link.
        </p>
        <div className="max-h-[320px] space-y-2 overflow-y-auto">
          {listDigestDays(tripData).map((d) => (
            <button
              key={d.day}
              type="button"
              onClick={() => sendWhatsAppDayDigest(d.day)}
              className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors hover:border-[#25D366]/50 hover:bg-[#25D366]/5 ${
                Number(d.day) === Number(activeDay)
                  ? "border-[#25D366]/40 bg-[#25D366]/5"
                  : "border-[#E2E8F0]"
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0F172A] text-xs font-bold text-white">
                {String(d.day).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#0F172A]">
                  Day {d.day}
                </span>
                <span className="mt-0.5 block truncate text-xs text-[#64748B]">
                  {d.theme}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Modal>

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
  children = null,
}) {
  const iconWrap =
    iconTone === "green"
      ? "bg-emerald-50 text-emerald-600"
      : "bg-blue-50 text-blue-600";

  return (
    <div className="rounded-xl border border-[#E2E8F0]/50 bg-white px-3 py-3 shadow-soft transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(15,23,42,0.08)] sm:px-4 sm:py-4">
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
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[#0F172A] sm:gap-x-3 sm:text-xs">
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

      {children}
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
