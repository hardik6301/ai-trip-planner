"use client";

/**
 * Travora home page — Stitch-matched hero, planning form, destinations,
 * features, and testimonials. Form state lives in useTrip; extra UI fields
 * (traveler type, interests, advanced options) compose into the API payload.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTrip } from "@/hooks/useTrip";
import { parseAuthErrorFromHash } from "@/utils/parseAuthError";
import {
  TRAVEL_VIBES,
} from "@/constants/tripOptions";

// Original WanderAI Dolomites hero (stitch_wanderai_travel_planner/wanderai_home)
const HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBClOAFjQFJzz2px3Ek8Wih1oANUgtcBUIZpphzV98fg3Xa-AImWI6EUnysajzk2_X5DOmq_0ezjtGNmBPXA0l6fYaDrdEEDZ36dxQo5_0BVVvtKlwvbiP0xmqs8Os9c9JOpDCJJ07zwG6eux5c9s2dCNOH7Twxdjcy03_otXXFhBn7ODnP5N6HtRkEyamtDHPlQa8v4885gP_8eSCAhERGKO01hvqDw3OzyxhWOb6jXc9UwKhV2zNsCC7SHR6eFQi86ynGN0kDuGn7";

/** Today's date as YYYY-MM-DD for date input min values */
function getTodayISO() {
  return new Date().toISOString().split("T")[0];
}

/** Add n days to an ISO date string */
function addDaysToISO(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/** Inclusive day count between two ISO date strings */
function daysBetweenISO(from, to) {
  if (!from || !to) return 0;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const diff = Math.round((end - start) / 86400000) + 1;
  return Math.max(diff, 1);
}

/** Format an ISO date as "Month YYYY" for the API travelMonth field */
function monthYearFromISO(isoDate) {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

/** Resolve the flexible-tab month dropdown value to an API-ready string */
function resolveTravelMonth(value) {
  if (!value) return null;
  if (value === "next") {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toLocaleString("en-US", { month: "long", year: "numeric" });
  }
  return value;
}

/** Build "Roughly when?" options — Next Month + 12 rolling months */
function buildRoughMonthOptions() {
  const now = new Date();
  const options = [{ value: "", label: "Any time (optional)" }];
  options.push({ value: "next", label: "Next Month" });
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    options.push({ value: label, label });
  }
  return options;
}

const ROUGH_MONTH_OPTIONS = buildRoughMonthOptions();

/** Budget tiers shown in the Stitch form dropdown */
const BUDGET_OPTIONS = ["Economy", "Mid-range", "Luxury"];

/** Who's traveling — single-select cards */
const TRAVELER_TYPES = [
  { id: "Solo", icon: "person", label: "Solo" },
  { id: "Couple", icon: "favorite", label: "Couple" },
  { id: "Family", icon: "family_restroom", label: "Family" },
  { id: "Friends", icon: "group", label: "Friends" },
];

/** Activity interest chips — multi-select */
const ACTIVITY_INTERESTS = [
  "Adventure",
  "Relaxation",
  "Culture",
  "Foodie",
  "Nightlife",
];

/** Popular destination cards for the horizontal scroll section */
const POPULAR_DESTINATIONS = [
  {
    name: "Manali",
    region: "Himachal Pradesh, India",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCHl0iRBY2rKwjhI82BIJowwxBk9pgWvnyQFCZagZGtmjQC6GARvzRfCc0JcjvboMD9-ZZXtmze-I46X3r81dO9e4Mf4BbqQmZ_1D1HFxEg6I0ML0NlU6h9jEuPICtFnFdMtirhJ10qarIa83ibmNcvh4dPq7mcrSuFyEzciHBjSGwb9c-x4IczWDJcmECQQU8vN1RJZoCj9RVyRprBSGovlLjjRSJn4Hi46rGq9-x8sJdjMJQJw-zwAEMg_r3V_fHjwjJM8e1OJgIV",
  },
  {
    name: "Goa",
    region: "India",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDHThhCy0MiTxu6l0vozH6rj8Kc1sOQ8sh3qrd9mmjzgl8uMZxFCg9uH6sdegEgiyDsff5FpELQedL3PRvtEKB_PPSIXLj1WK56jXtGkeDJtAJcMPSO7lh-Hq9IdT5UUygL_Pn52vLYSweQ17AppF5PqNsXoFvjLPh-7NMn5F2K7Vhv2bflpofN6rkpkqD3mfefFJpSTxop3rYsoxwdrVhd84tZpyQSdzFDkGnw6NXXo2cuUb3_2MsAJlqhjWn1GvEWm1VY2D6sOI5a",
  },
  {
    name: "Bali",
    region: "Indonesia",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAvsJnIfdvlWUw7xCvIElzlaRPC_6kzAWL9jJs8YhFAxIS7NCf2mGRihq-3fhlrBGEcbc3Pr5pGKNgoX3kk6zwdRntPyvGbmnhyIvWxSP2B-12shjVKVvm3ZffukzH7_biQGgK-tF8Mn9gDoq7oYJi0nTEQwmULsLL2COXXiUp3E3Laa-b23V03bjvp3vEOv0QhrVM4cPKpfmYIe9Id-nBN-bdANGxem3fGo_hJ05a5kuSq8Eew-Gp-qj7oInaC5Gd9p41uHPG0WKC8",
  },
  {
    name: "Dubai",
    region: "UAE",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBc3ACMVkGxvn2bRhIHCy-4f-14GYLBA8ORMG9enrwBoJqmkzygyteKoHNQEa61_vfCulbSvlmz9P66QezOmbzpAIUn4qdpdk5bYxCefje7A_GE4HhFGRDzPfjsIziacPb88CFiOdSFhESELyvln_Y8ieLi1BrcGu-ZJPeulSV943m0Tg8SpX1GDaKqY6b6TdpVVRR90ejmfqExVDXDQJ62i872kHldybnEzi54a_eyjKPNSZ5_eIkF9facuHn0HkPoZOc3SbfpR3ts",
  },
  {
    name: "Paris",
    region: "France",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBb0pwsfiJ_z71YVRosKF00JDkR8g5AC4Z4GfNaD_DkSiN0XhsnGvmqIyyVo_cGHzPCigNRmivYCKGNsroDTsusqwLGudc-AxsdRXTSeshyAWbjoYtXnVWORT3A-QReBXYoxU8WElqkSBTw3YSFI62NFwQ0TUQbPEi5ubwSKxWPeU3dbhbM8ZweYamGy9-8DYEM62TfaNNcPc9nQi7WOuNFAW7qNngdg6I5NAWq52WViGt1tj-LwHlzFPyA6gNDh_ozWd5OLkVYEXjg",
  },
];

/** Circular clock/calendar illustration for Adaptive Timelines (WanderAI design) */
function ScheduleCircleIllustration() {
  return (
    <svg
      viewBox="0 0 192 192"
      className="h-full w-full"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="schedGrad" cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#5a6bc7" />
          <stop offset="100%" stopColor="#1a2160" />
        </radialGradient>
      </defs>
      <rect width="192" height="192" fill="url(#schedGrad)" />
      <circle cx="28" cy="36" r="1.5" fill="white" opacity="0.3" />
      <circle cx="158" cy="28" r="1.2" fill="white" opacity="0.25" />
      <circle cx="172" cy="72" r="1.5" fill="white" opacity="0.3" />
      <circle cx="44" cy="148" r="1.2" fill="white" opacity="0.25" />
      <circle cx="96" cy="98" r="46" fill="white" fillOpacity="0.96" />
      <circle cx="96" cy="98" r="46" fill="none" stroke="#e8ecff" strokeWidth="2" />
      <line x1="96" y1="98" x2="96" y2="68" stroke="#2e3192" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="96" y1="98" x2="120" y2="108" stroke="#fe7d5e" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="96" cy="98" r="4" fill="#2e3192" />
      <rect x="118" y="48" width="32" height="34" rx="5" fill="white" fillOpacity="0.95" />
      <rect x="118" y="48" width="32" height="9" rx="5" fill="#fe7d5e" />
      <line x1="126" y1="66" x2="142" y2="66" stroke="#c6c5d4" strokeWidth="2" strokeLinecap="round" />
      <line x1="126" y1="73" x2="142" y2="73" stroke="#c6c5d4" strokeWidth="2" strokeLinecap="round" />
      <circle cx="48" cy="128" r="14" fill="#ffb84d" />
      <ellipse cx="142" cy="130" rx="18" ry="11" fill="white" fillOpacity="0.9" />
      <ellipse cx="128" cy="126" rx="12" ry="9" fill="white" fillOpacity="0.9" />
    </svg>
  );
}

/** Testimonial cards */
const TESTIMONIALS = [
  {
    quote:
      "Travora planned my 2-week solo trip to Japan in under 5 minutes. The restaurant recommendations were hidden gems I'd never have found!",
    initials: "SJ",
    name: "Sarah Jenkins",
    role: "Digital Nomad",
  },
  {
    quote:
      "The group planning feature is a lifesaver. No more endless WhatsApp threads. We just voted on the AI suggestions and booked!",
    initials: "MK",
    name: "Marcus Knight",
    role: "Family Traveler",
  },
  {
    quote:
      "I was skeptical about AI, but the relaxation vibe it curated for Bali was perfect. It even accounted for travel fatigue between flights.",
    initials: "AL",
    name: "Aisha Lopez",
    role: "Luxury Explorer",
  },
];

export default function Home() {
  const router = useRouter();

  // Redirect OAuth failures (hash errors from Supabase) to login with a readable message
  useEffect(() => {
    const authError = parseAuthErrorFromHash(window.location.hash);
    if (authError) {
      router.replace(
        `/auth/login?error=${encodeURIComponent(authError)}`
      );
    }
  }, [router]);

  const {
    destination,
    setDestination,
    budget,
    setBudget,
    vibe,
    setVibe,
    loading,
    error,
    generateTrip,
  } = useTrip();

  // Extra form UI state — composed into the API vibe string on submit
  const [travelerType, setTravelerType] = useState("Solo");
  const [activityInterests, setActivityInterests] = useState(["Relaxation"]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [preferredMonth, setPreferredMonth] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");

  // Flexible date system — default tab is "I'll decide later"
  const [dateTab, setDateTab] = useState("flexible");
  const [flexibleDays, setFlexibleDays] = useState(5);
  const [roughMonth, setRoughMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const todayISO = getTodayISO();
  const toDateMin = fromDate ? addDaysToISO(fromDate, 1) : todayISO;
  const specificDayCount =
    fromDate && toDate ? daysBetweenISO(fromDate, toDate) : 0;

  // Keep "To" date valid when "From" date moves forward
  useEffect(() => {
    if (fromDate && toDate && toDate <= fromDate) {
      setToDate(addDaysToISO(fromDate, 1));
    }
  }, [fromDate, toDate]);

  // Default budget tier to match Stitch form
  useEffect(() => {
    if (!budget) setBudget("Economy");
  }, [budget, setBudget]);

  // Toggle a multi-select activity interest chip
  function toggleInterest(interest) {
    setActivityInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  }

  // Build enriched vibe string from all preference fields for the Gemini prompt
  function buildComposedVibe() {
    const parts = [
      `${travelerType} trip`,
      vibe,
      activityInterests.length
        ? `Interests: ${activityInterests.join(", ")}`
        : null,
      preferredMonth ? `Preferred month: ${preferredMonth}` : null,
      specialRequests ? `Notes: ${specialRequests}` : null,
    ].filter(Boolean);
    return parts.join(". ");
  }

  // Resolve days + travelMonth from the active date tab for the API
  function getTripDates() {
    if (dateTab === "specific") {
      return {
        days: daysBetweenISO(fromDate, toDate),
        travelMonth: monthYearFromISO(fromDate),
      };
    }
    return {
      days: flexibleDays,
      travelMonth: resolveTravelMonth(roughMonth),
    };
  }

  // Submit — delegates to useTrip with composed vibe and date overrides
  function handleSubmit(e) {
    const { days, travelMonth } = getTripDates();
    generateTrip(e, { vibe: buildComposedVibe(), days, travelMonth });
  }

  // Clicking a destination card pre-fills the destination input
  function handleDestinationPick(name) {
    setDestination(name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="bg-surface text-on-surface font-sans">
      {/* ─── Hero — full-width mountain background, headline left, form right ─── */}
      <section className="relative flex min-h-[700px] items-center overflow-hidden lg:min-h-[921px]">
        {/* Background image — WanderAI Dolomites with light overlay + bottom fade */}
        <div className="absolute inset-0 z-0">
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url('${HERO_IMAGE}')` }}
            role="img"
            aria-label="Mountain landscape"
          />
          <div className="absolute inset-0 bg-black/30" />
          <div className="hero-gradient absolute inset-0" />
        </div>

        <div className="relative z-10 mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-10 px-5 py-12 md:px-6 lg:grid-cols-12 lg:gap-10">
          {/* Left — headline and subheading */}
          <div className="space-y-4 text-white lg:col-span-7">
            <h1 className="text-[42px] leading-tight font-extrabold tracking-tight text-white drop-shadow-xl md:text-[56px]">
              Plan Your Perfect <br />
              Trip with{" "}
              <span className="text-secondary-container">AI</span>
            </h1>
            <p className="max-w-xl text-lg text-white/90 drop-shadow-md md:text-xl">
              Tell us where you want to go, we&apos;ll handle the rest.
              Personal itineraries crafted by intelligence, inspired by your
              unique travel soul.
            </p>
          </div>

          {/* Right — floating glass form card */}
          <div className="lg:col-span-5">
            <div className="space-y-5 rounded-xl border border-outline-variant/30 bg-white p-6 shadow-2xl md:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Start Planning header + destination search input */}
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-primary">
                    Start Planning
                  </h3>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-on-surface-variant text-[20px]">
                      search
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Where to?"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full rounded-lg border border-outline-variant bg-white py-3 pr-4 pl-10 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Date mode tabs — Specific Dates vs I'll decide later */}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDateTab("specific")}
                      className={`flex-1 cursor-pointer rounded-full border px-3 py-2 text-sm font-medium ${
                        dateTab === "specific"
                          ? "border-primary-container bg-primary-container text-white"
                          : "border-outline-variant bg-white text-on-surface-variant"
                      }`}
                    >
                      Specific Dates
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateTab("flexible")}
                      className={`flex-1 cursor-pointer rounded-full border px-3 py-2 text-sm font-medium ${
                        dateTab === "flexible"
                          ? "border-primary-container bg-primary-container text-white"
                          : "border-outline-variant bg-white text-on-surface-variant"
                      }`}
                    >
                      I&apos;ll decide later
                    </button>
                  </div>

                  {/* Flexible tab — day count + optional rough month */}
                  {dateTab === "flexible" && (
                    <div className="space-y-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="flexibleDays"
                        className="text-sm font-medium text-on-surface-variant"
                      >
                        How many days?
                      </label>
                      <input
                        id="flexibleDays"
                        type="number"
                        required={dateTab === "flexible"}
                        min={1}
                        max={30}
                        value={flexibleDays}
                        onChange={(e) =>
                          setFlexibleDays(Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-outline-variant bg-white px-4 py-2 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="roughMonth"
                        className="text-sm font-medium text-on-surface-variant"
                      >
                        Roughly when?
                      </label>
                      <select
                        id="roughMonth"
                        value={roughMonth}
                        onChange={(e) => setRoughMonth(e.target.value)}
                        className="w-full rounded-lg border border-outline-variant bg-white px-4 py-2 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      >
                        {ROUGH_MONTH_OPTIONS.map((opt) => (
                          <option key={opt.value || "any"} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  )}

                  {/* Specific dates tab — from/to pickers with auto day count */}
                  {dateTab === "specific" && (
                    <div className="space-y-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="fromDate"
                        className="text-sm font-medium text-on-surface-variant"
                      >
                        From
                      </label>
                      <input
                        id="fromDate"
                        type="date"
                        required={dateTab === "specific"}
                        min={todayISO}
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full rounded-lg border border-outline-variant bg-white px-4 py-2 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="toDate"
                        className="text-sm font-medium text-on-surface-variant"
                      >
                        To
                      </label>
                      <input
                        id="toDate"
                        type="date"
                        required={dateTab === "specific"}
                        min={toDateMin}
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full rounded-lg border border-outline-variant bg-white px-4 py-2 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    {fromDate && toDate && (
                      <p className="text-sm font-medium text-secondary-container">
                        {specificDayCount} day
                        {specificDayCount !== 1 ? "s" : ""} selected
                      </p>
                    )}
                  </div>
                  )}
                </div>

                {/* Budget tier */}
                <div className="space-y-1">
                  <label
                    htmlFor="budget"
                    className="text-sm font-medium text-on-surface-variant"
                  >
                    Budget ($)
                  </label>
                  <select
                    id="budget"
                    required
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant bg-white px-4 py-2 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {BUDGET_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Who's traveling — 4 clickable cards */}
                <div className="space-y-2">
                  <span className="text-sm font-medium text-on-surface-variant">
                    Who&apos;s traveling?
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {TRAVELER_TYPES.map(({ id, icon, label }) => {
                      const selected = travelerType === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setTravelerType(id)}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                            selected
                              ? "border-primary bg-secondary-container text-white shadow-md"
                              : "border-outline-variant bg-white text-primary"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {icon}
                          </span>
                          <span className="text-sm font-medium">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Travel vibe — horizontal scrollable chips (single select) */}
                <div className="space-y-2">
                  <span className="text-sm font-medium text-on-surface-variant">
                    Travel Vibe
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {TRAVEL_VIBES.map((option) => {
                      const selected = vibe === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setVibe(option)}
                          className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            selected
                              ? "border-secondary-container bg-secondary-container text-white"
                              : "border-outline-variant bg-white text-primary"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Activity interests — multi-select chips */}
                <div className="space-y-2">
                  <span className="text-sm font-medium text-on-surface-variant">
                    Activity Interests
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {ACTIVITY_INTERESTS.map((interest) => {
                      const selected = activityInterests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            selected
                              ? "border-secondary-container bg-secondary-container text-white"
                              : "border-outline-variant bg-white text-primary"
                          }`}
                        >
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Advanced Options — collapsed by default */}
                <div className="border-t border-outline-variant/40 pt-3">
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((o) => !o)}
                    className="flex w-full cursor-pointer items-center justify-between text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
                  >
                    Advanced Options
                    <span className="material-symbols-outlined text-[20px]">
                      {advancedOpen ? "expand_less" : "expand_more"}
                    </span>
                  </button>
                  {advancedOpen && (
                    <div className="mt-3 space-y-3">
                      <div className="space-y-1">
                        <label
                          htmlFor="preferredMonth"
                          className="text-sm font-medium text-on-surface-variant"
                        >
                          Preferred travel month
                        </label>
                        <select
                          id="preferredMonth"
                          value={preferredMonth}
                          onChange={(e) => setPreferredMonth(e.target.value)}
                          className="w-full rounded-lg border border-outline-variant bg-white px-4 py-2 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="">Any time</option>
                          {[
                            "January",
                            "February",
                            "March",
                            "April",
                            "May",
                            "June",
                            "July",
                            "August",
                            "September",
                            "October",
                            "November",
                            "December",
                          ].map((month) => (
                            <option key={month} value={month}>
                              {month}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor="specialRequests"
                          className="text-sm font-medium text-on-surface-variant"
                        >
                          Special requests
                        </label>
                        <textarea
                          id="specialRequests"
                          rows={2}
                          placeholder="Dietary needs, accessibility, must-see spots..."
                          value={specialRequests}
                          onChange={(e) => setSpecialRequests(e.target.value)}
                          className="w-full resize-none rounded-lg border border-outline-variant bg-white px-4 py-2 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Orange CTA — Generate My Itinerary */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-secondary-container py-4 text-base font-bold text-white shadow-lg hover:bg-secondary active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Generating..." : "Generate My Itinerary ⚡"}
                </button>
              </form>

              {/* API error message */}
              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Popular Destinations — horizontal scroll ─── */}
      <section className="bg-surface py-10 md:py-12">
        <div className="mx-auto max-w-[1280px] px-5 md:px-6">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-primary md:text-3xl">
                Popular Destinations
              </h2>
              <p className="text-on-surface-variant">
                Trending places curated by our global community
              </p>
            </div>
            <button
              type="button"
              className="hidden cursor-pointer items-center gap-1 text-sm font-bold text-secondary-container sm:flex"
            >
              View All
              <span className="material-symbols-outlined text-[18px]">
                arrow_forward
              </span>
            </button>
          </div>

          <div className="flex gap-6 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {POPULAR_DESTINATIONS.map((dest) => (
              <button
                key={dest.name}
                type="button"
                onClick={() => handleDestinationPick(dest.name)}
                className="min-w-[280px] shrink-0 cursor-pointer text-left"
              >
                <div className="relative h-[380px] overflow-hidden rounded-xl">
                  <img
                    src={dest.image}
                    alt={dest.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 p-4 text-white">
                    <h4 className="text-lg font-bold">{dest.name}</h4>
                    <p className="text-sm text-white/80">{dest.region}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Smart Features — bento grid (WanderAI layout, Travora branding) ─── */}
      <section className="mx-auto max-w-[1280px] px-5 py-24 md:px-12">
        <div className="mb-16 flex flex-col items-center text-center">
          <span className="mb-4 inline-block rounded-full bg-primary-fixed px-3 py-1 text-xs font-semibold text-on-primary-fixed">
            SMART FEATURES
          </span>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-primary">
            Beyond Just a Schedule
          </h2>
          <p className="max-w-2xl text-lg text-on-surface-variant">
            We don&apos;t just list places; we curate experiences that match
            your rhythm.
          </p>
        </div>

        {/* Bento layout — 4 feature cards in a 12-column grid */}
        <div className="grid h-auto grid-cols-1 gap-6 md:h-[600px] md:grid-cols-12 md:grid-rows-2">
          {/* Wide card — Adaptive Timelines */}
          <div className="itinerary-card-shadow flex items-center justify-between gap-6 rounded-xl border border-outline-variant/30 bg-white p-8 md:col-span-8 md:row-span-1">
            <div className="max-w-md">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                <span className="material-symbols-outlined feature-card-icon">
                  schedule
                </span>
              </div>
              <h3 className="mb-2 text-2xl font-semibold text-primary">
                Adaptive Timelines
              </h3>
              <p className="text-on-surface-variant">
                Itineraries that adjust based on weather forecasts, opening
                hours, and your energy levels.
              </p>
            </div>
            <div className="hidden h-48 w-48 shrink-0 overflow-hidden rounded-full lg:block">
              <ScheduleCircleIllustration />
            </div>
          </div>

          {/* Tall card — Deep AI Personalization (navy from WanderAI palette) */}
          <div className="relative flex flex-col justify-end overflow-hidden rounded-xl bg-primary-container p-8 shadow-xl md:col-span-4 md:col-start-9 md:row-span-2 md:row-start-1">
            {/* Decorative watermark — 64px faint icon, top-right */}
            <div className="pointer-events-none absolute top-0 right-0 p-8">
              <span className="material-symbols-outlined feature-watermark-icon">
                psychology_alt
              </span>
            </div>
            <div className="relative z-10">
              <h3 className="mb-4 text-2xl font-semibold text-white">
                Deep AI Personalization
              </h3>
              <p className="mb-6 text-on-primary-container/80">
                Our neural networks understand nuance—from &apos;hidden
                gem&apos; cafes to &apos;quietest&apos; hiking trails.
              </p>
              <div className="flex gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                  Neural Engine 2.0
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                  Real-time Data
                </span>
              </div>
            </div>
          </div>

          {/* Local Flavors card */}
          <div className="itinerary-card-shadow rounded-xl border border-outline-variant/30 bg-white p-8 md:col-span-4 md:row-span-1">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-fixed text-secondary">
              <span className="material-symbols-outlined feature-card-icon">
                restaurant
              </span>
            </div>
            <h3 className="mb-2 text-2xl font-semibold text-primary">
              Local Flavors
            </h3>
            <p className="text-on-surface-variant">
              Discover authentic dining spots that locals keep to themselves.
            </p>
          </div>

          {/* Smart Navigation card */}
          <div className="itinerary-card-shadow rounded-xl border border-outline-variant/30 bg-white p-8 md:col-span-4 md:row-span-1">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-tertiary-fixed text-tertiary">
              <span className="material-symbols-outlined feature-card-icon">
                explore
              </span>
            </div>
            <h3 className="mb-2 text-2xl font-semibold text-primary">
              Smart Navigation
            </h3>
            <p className="text-on-surface-variant">
              Optimized routes that minimize travel time and maximize
              discovery.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Testimonials — Travelers Love Us ─── */}
      <section className="bg-surface py-10 md:py-12">
        <div className="mx-auto max-w-[1280px] px-5 md:px-6">
          <h2 className="mb-10 text-center text-2xl font-bold text-primary md:text-3xl">
            Travelers Love Us
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <div
                key={item.name}
                className="relative rounded-xl border border-outline-variant bg-white p-6 italic"
              >
                <span className="material-symbols-outlined absolute -top-4 -left-2 text-5xl text-secondary-container/20">
                  format_quote
                </span>
                <p className="mb-6 text-on-surface not-italic">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 not-italic">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-variant text-sm font-bold text-primary">
                    {item.initials}
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold">{item.name}</h5>
                    <p className="text-xs text-on-surface-variant">
                      {item.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
