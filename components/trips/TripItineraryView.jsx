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
  FileText,
  Footprints,
  Heart,
  Info,
  MapPin,
  Moon,
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
}) {
  const { tripMeta } = tripData;
  const destination = capitalizeDestination(tripData.destination);
  const title = destination.includes("Adventure")
    ? destination
    : `${destination} Adventure`;

  const dayCount = tripData.days?.length ?? tripMeta?.days ?? 0;
  const activityCount = countActivities(tripData.days);
  const placeCount = countPlaces(tripData.days);
  const budget = tripData.totalBudgetEstimate || tripMeta?.budget || "₹42,500";
  const budgetCap = tripMeta?.budget || "₹50,000";
  const budgetDisplay = formatBudgetDisplay(
    budget,
    budgetCap,
    tripMeta?.vibe
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

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `Check out my ${title} itinerary on Travora!`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        /* cancelled */
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  }

  return (
    <div className="bg-[#F8FAFC] pb-16">
      <div className="mx-auto max-w-[1400px] px-6 pt-6">
        {/* ─── Hero ─── */}
        <section className="relative h-[400px] overflow-hidden rounded-[20px] shadow-soft md:h-[420px]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${DEFAULT_HERO}')` }}
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
                  className="flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC]"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </button>
                <button
                  type="button"
                  className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC]"
                >
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </button>
              </div>
            </div>
          </div>

          {/* Title block — bottom left, clear of budget card */}
          <div className="absolute right-[300px] bottom-8 left-6 text-white">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/35 px-3 py-1.5 text-xs font-medium backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                {heroBadge}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/35 px-3 py-1.5 text-xs font-medium backdrop-blur-md">
                <Zap className="h-3.5 w-3.5" />
                2 / 3 Regenerations Used
              </span>
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
            title="18°C"
            subtitle="Partly Cloudy"
          />
          <StatCard
            icon={Banknote}
            iconTone="green"
            label="Currency"
            title="CHF"
            subtitle="₹1 = 1.08 CHF"
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
            label="Budget Progress"
            title={budgetDisplay.progressTitle}
            progress={85}
          />
        </div>

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
                <span className="absolute top-4 right-4 rounded-md bg-[#F97316] px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                  Pro
                </span>
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
                <Link
                  href="/pricing"
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#F97316] py-2.5 text-sm font-semibold text-white hover:bg-[#ea580c]"
                >
                  Upgrade to Pro
                </Link>
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
                  <OverviewRow
                    icon={Heart}
                    label="Trip Type"
                    value={tripMeta?.vibe || "Romantic Getaway"}
                  />
                </dl>
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

              if (!isExpanded) {
                return (
                  <button
                    key={day.day}
                    type="button"
                    id={`day-${day.day}`}
                    onClick={() => toggleDay(day.day)}
                    className="scroll-mt-28 mb-3 flex w-full cursor-pointer items-center gap-4 rounded-xl bg-[#F1F5F9] px-4 py-4 text-left hover:bg-[#E2E8F0] md:px-5"
                  >
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
                  className="relative mb-12 scroll-mt-28"
                >
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
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex gap-5">
                    <div className="w-11 shrink-0" aria-hidden="true" />
                    <div className="flex flex-1 justify-center pb-2">
                      <button
                        type="button"
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-8 py-2.5 text-sm font-medium text-[#0F172A] shadow-soft hover:bg-[#F8FAFC]"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Regenerate this day
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {footerExtra && <div className="pt-6">{footerExtra}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityImage({ place, activity, destination }) {
  const [src, setSrc] = useState(() =>
    getPlaceImage(place, activity, destination)
  );

  return (
    <div className="h-[140px] w-full shrink-0 overflow-hidden rounded-xl sm:h-[148px] sm:w-[148px]">
      <img
        src={src}
        alt={place}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setSrc(PLACE_IMAGE_FALLBACK)}
      />
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
  tripStats,
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
            }`}
          >
            {title}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs leading-snug text-[#64748B]">
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
