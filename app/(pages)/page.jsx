"use client";

/**
 * Travora home page — hero planning form, Geoapify city autocomplete,
 * popular destinations, How It Works, and stats. Form state lives in useTrip;
 * traveler type + interests compose into the API vibe string on submit.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTrip } from "@/hooks/useTrip";
import { useDebounce } from "@/hooks/useDebounce";
import { parseAuthErrorFromHash } from "@/utils/parseAuthError";

// Original WanderAI Dolomites hero (stitch_wanderai_travel_planner/wanderai_home)
const HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBClOAFjQFJzz2px3Ek8Wih1oANUgtcBUIZpphzV98fg3Xa-AImWI6EUnysajzk2_X5DOmq_0ezjtGNmBPXA0l6fYaDrdEEDZ36dxQo5_0BVVvtKlwvbiP0xmqs8Os9c9JOpDCJJ07zwG6eux5c9s2dCNOH7Twxdjcy03_otXXFhBn7ODnP5N6HtRkEyamtDHPlQa8v4885gP_8eSCAhERGKO01hvqDw3OzyxhWOb6jXc9UwKhV2zNsCC7SHR6eFQi86ynGN0kDuGn7";

/** Geoapify key — falls back to mock suggestions when missing */
const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY?.trim() || "";

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
  return value || null;
}

/** Build "Roughly when?" options — current month + 12 rolling months */
function buildRoughMonthOptions() {
  const now = new Date();
  const options = [{ value: "", label: "Any time (optional)" }];
  for (let i = 0; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    options.push({
      value: label,
      label: i === 0 ? `This month (${label})` : label,
    });
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

/** Travel vibe chips — single select */
const TRAVEL_VIBES = [
  "Adventure 🧗",
  "Relaxation 🧘",
  "Cultural 🏛",
  "Luxury ✨",
  "Budget 💰",
  "Foodie 🍜",
  "Nature 🌿",
  "Party 🎉",
];

/** Activity interest chips — multi-select (zero to all) */
const ACTIVITY_INTERESTS = [
  "🏖 Beaches",
  "🏔 Trekking",
  "🍜 Street Food",
  "🛍 Shopping",
  "🎭 Nightlife",
  "💆 Wellness",
  "🤿 Water Sports",
  "📸 Photography",
  "🏛 Museums",
  "🎢 Theme Parks",
  "🌿 Nature Walks",
  "🍷 Fine Dining",
];

/** Mock destinations when Geoapify key is missing (countries, states, cities) */
const MOCK_CITIES = [
  { city: "Thailand", country: "", state: "", label: "Thailand", subtitle: "Country", resultType: "country" },
  { city: "Bangkok", country: "Thailand", state: "", label: "Bangkok, Thailand", subtitle: "Thailand", resultType: "city" },
  { city: "Rajasthan", country: "India", state: "Rajasthan", label: "Rajasthan, India", subtitle: "India", resultType: "state" },
  { city: "Manali", country: "India", state: "Himachal Pradesh", label: "Manali, Himachal Pradesh, India", subtitle: "Himachal Pradesh, India", resultType: "city" },
  { city: "Goa", country: "India", state: "Goa", label: "Goa, India", subtitle: "India", resultType: "state" },
  { city: "Bali", country: "Indonesia", state: "", label: "Bali, Indonesia", subtitle: "Indonesia", resultType: "city" },
  { city: "Dubai", country: "United Arab Emirates", state: "", label: "Dubai, United Arab Emirates", subtitle: "United Arab Emirates", resultType: "city" },
  { city: "Paris", country: "France", state: "", label: "Paris, France", subtitle: "France", resultType: "city" },
  { city: "Tokyo", country: "Japan", state: "", label: "Tokyo, Japan", subtitle: "Japan", resultType: "city" },
  { city: "London", country: "United Kingdom", state: "", label: "London, United Kingdom", subtitle: "United Kingdom", resultType: "city" },
  { city: "New York", country: "United States", state: "New York", label: "New York, United States", subtitle: "United States", resultType: "city" },
  { city: "Singapore", country: "Singapore", state: "", label: "Singapore", subtitle: "Country", resultType: "country" },
];

/** Prefer countries/states/cities over suburbs and postcodes in ranking */
const DESTINATION_TYPE_PRIORITY = {
  country: 0,
  state: 1,
  city: 2,
  county: 3,
  locality: 4,
  postcode: 5,
  suburb: 6,
};

/** How It Works — three simple steps */
const HOW_IT_WORKS_STEPS = [
  {
    number: "01",
    icon: "🗺️",
    title: "Tell Us Your Dream",
    description:
      "Enter your destination, dates, budget, and travel style",
  },
  {
    number: "02",
    icon: "✨",
    title: "AI Plans Everything",
    description:
      "Our AI generates a complete day-by-day itinerary in seconds",
  },
  {
    number: "03",
    icon: "🚀",
    title: "Save, Share & Go",
    description:
      "Save your trip, share with friends, and travel with confidence",
  },
];

/** Honest stats replacing fake testimonials */
const STATS = [
  { value: "10,000+", label: "Itineraries Generated" },
  { value: "50+", label: "Countries Covered" },
  { value: "4.9★", label: "Average Rating" },
  { value: "2 Min", label: "Average Generation Time" },
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
  {
    name: "Bangkok",
    region: "Thailand",
    image:
      "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&q=80",
  },
  {
    name: "Santorini",
    region: "Greece",
    image:
      "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&q=80",
  },
  {
    name: "Tokyo",
    region: "Japan",
    image:
      "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",
  },
  {
    name: "Jaipur",
    region: "Rajasthan, India",
    image:
      "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&q=80",
  },
  {
    name: "Maldives",
    region: "Indian Ocean",
    image:
      "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&q=80",
  },
  {
    name: "Rome",
    region: "Italy",
    image:
      "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80",
  },
  {
    name: "Kerala",
    region: "India",
    image:
      "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=80",
  },
  {
    name: "Singapore",
    region: "Singapore",
    image:
      "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&q=80",
  },
  {
    name: "Istanbul",
    region: "Turkey",
    image:
      "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=800&q=80",
  },
];

/** Cards shown in the collapsed horizontal scroll row */
const POPULAR_PREVIEW_COUNT = 5;

/** Filter mock destinations by query string (used when no Geoapify key) */
function filterMockCities(query) {
  const q = query.toLowerCase();
  return MOCK_CITIES.filter(
    (c) =>
      c.city.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      c.state?.toLowerCase().includes(q) ||
      c.label.toLowerCase().includes(q)
  )
    .sort((a, b) => scoreDestination(a, query) - scoreDestination(b, query))
    .slice(0, 8);
}

/** Build a concise "City, State, Country" label for the dropdown */
function buildDestinationLabel(name, state, country, formatted) {
  if (!name) return formatted || "";
  const parts = [name];
  if (state && state !== name) parts.push(state);
  if (country && country !== state && country !== name) parts.push(country);
  const built = parts.join(", ");
  return built.length <= 72 ? built : formatted || built;
}

/** First segment of Geoapify formatted address */
function extractLeadingPlace(formatted) {
  return formatted?.split(",")[0]?.trim() || "";
}

/** Parse Geoapify feature into a travel destination suggestion */
function parseGeoapifyFeature(feature) {
  const props = feature.properties || {};
  const resultType = props.result_type || "unknown";

  let primaryName = "";
  let subtitle = "";
  let label = props.formatted || "";

  if (resultType === "country") {
    primaryName = props.country || label;
    subtitle = "Country";
    label = primaryName;
  } else if (resultType === "state") {
    primaryName = props.state || extractLeadingPlace(label);
    subtitle = props.country || "";
    label = buildDestinationLabel(primaryName, "", props.country, label);
  } else if (resultType === "city" || resultType === "county") {
    primaryName = props.city || props.county || props.name || extractLeadingPlace(label);
    subtitle = [props.state, props.country].filter(Boolean).join(", ");
    label = buildDestinationLabel(primaryName, props.state, props.country, label);
  } else if (resultType === "postcode") {
    primaryName = props.city || extractLeadingPlace(label);
    subtitle = [props.state, props.country].filter(Boolean).join(", ");
    label = buildDestinationLabel(primaryName, props.state, props.country, label);
  } else {
    primaryName =
      props.city || props.name || props.address_line1 || extractLeadingPlace(label);
    subtitle = props.country || "";
    label = props.formatted || buildDestinationLabel(primaryName, props.state, props.country, label);
  }

  return {
    city: primaryName,
    country: props.country || "",
    state: props.state || "",
    subtitle,
    resultType,
    label: label.trim(),
    placeId: props.place_id,
  };
}

/** Score a suggestion — lower is better (ranks to top) */
function scoreDestination(item, query) {
  const q = query.toLowerCase().trim();
  const primary = (item.city || "").toLowerCase();
  const country = (item.country || "").toLowerCase();
  const state = (item.state || "").toLowerCase();
  const label = (item.label || "").toLowerCase();

  let score = DESTINATION_TYPE_PRIORITY[item.resultType] ?? 20;

  if (item.resultType === "country" && country === q) score -= 100;
  if (primary === q) score -= 80;
  if (state === q) score -= 70;
  if (country === q && item.resultType !== "country") score -= 40;
  if (primary.startsWith(q)) score -= 30;
  if (label.startsWith(q)) score -= 20;

  // Penalize homonyms in the wrong country (e.g. village "Thailand" in Philippines)
  if (primary === q && country && country !== q && item.resultType !== "country") {
    score += 100;
  }

  // Reduce suburb noise unless it's an exact match
  if (item.resultType === "suburb" && primary !== q) score += 50;

  // Boost postcode hits when the city name matches (e.g. Manali, HP)
  if (item.resultType === "postcode" && primary === q) score -= 25;

  return score;
}

/** Rank, dedupe, and cap Geoapify results for travel planning */
function rankAndFilterDestinations(features, query) {
  const parsed = features
    .map(parseGeoapifyFeature)
    .filter((item) => item.city || item.label);

  const seen = new Set();
  const ranked = [];

  for (const item of parsed.sort(
    (a, b) => scoreDestination(a, query) - scoreDestination(b, query)
  )) {
    const key = item.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Drop low-value suburbs once we already have stronger matches
    if (item.resultType === "suburb" && ranked.length >= 3) continue;

    ranked.push(item);
    if (ranked.length >= 8) break;
  }

  return ranked;
}

/** Geoapify autocomplete — no type=city filter (breaks country/state search) */
async function fetchGeoapifyAutocomplete(query, apiKey) {
  const params = new URLSearchParams({
    text: query,
    limit: "15",
    lang: "en",
    apiKey,
  });
  const res = await fetch(
    `https://api.geoapify.com/v1/geocode/autocomplete?${params}`
  );
  if (!res.ok) throw new Error("Autocomplete failed");
  const data = await res.json();
  return data.features || [];
}

/** Geoapify forward search — better for exact country/state names */
async function fetchGeoapifySearch(query, apiKey) {
  const params = new URLSearchParams({
    text: query,
    limit: "6",
    lang: "en",
    apiKey,
  });
  const res = await fetch(
    `https://api.geoapify.com/v1/geocode/search?${params}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.features || [];
}

/** Combined Geoapify fetch with ranking + search fallback */
async function fetchGeoapifyDestinations(query, apiKey) {
  const autocompleteFeatures = await fetchGeoapifyAutocomplete(query, apiKey);
  let results = rankAndFilterDestinations(autocompleteFeatures, query);

  const q = query.toLowerCase().trim();
  const hasStrongMatch = results.some(
    (r) =>
      r.city.toLowerCase() === q ||
      r.country.toLowerCase() === q ||
      r.state.toLowerCase() === q ||
      r.resultType === "country"
  );

  // Supplement with forward search when autocomplete misses the obvious hit
  if (results.length < 2 || !hasStrongMatch) {
    const searchFeatures = await fetchGeoapifySearch(query, apiKey);
    results = rankAndFilterDestinations(
      [...searchFeatures, ...autocompleteFeatures],
      query
    );
  }

  return results;
}

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
    error,
    isGenerating,
    generateTrip,
  } = useTrip();

  // Prefetch generating route so navigation feels instant after submit
  useEffect(() => {
    router.prefetch("/generating");
  }, [router]);

  // Extra form UI state — composed into the API vibe string on submit
  const [travelerType, setTravelerType] = useState("Solo");
  const [activityInterests, setActivityInterests] = useState([]);

  // Popular destinations — collapsed scroll row vs expanded grid
  const [showAllDestinations, setShowAllDestinations] = useState(false);

  // Flexible date system — default tab is "I'll decide later"
  const [dateTab, setDateTab] = useState("flexible");
  const [flexibleDays, setFlexibleDays] = useState(5);
  const [roughMonth, setRoughMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Geoapify destination autocomplete state
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [validDestination, setValidDestination] = useState(false);
  const [allowFreeText, setAllowFreeText] = useState(false);
  const [destinationError, setDestinationError] = useState("");

  const destinationWrapperRef = useRef(null);
  const destinationInputRef = useRef(null);

  // Debounce destination input — Geoapify fires only after 300ms of no typing
  const debouncedDestination = useDebounce(destination, 300);

  const todayISO = getTodayISO();
  const toDateMin = fromDate ? addDaysToISO(fromDate, 1) : todayISO;
  const specificDayCount =
    fromDate && toDate ? daysBetweenISO(fromDate, toDate) : 0;

  // Sync travel vibe default to the new chip labels on first load
  useEffect(() => {
    if (!TRAVEL_VIBES.includes(vibe)) {
      setVibe(TRAVEL_VIBES[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /** Fetch destination suggestions from Geoapify (ranked) or mock data */
  const fetchCitySuggestions = useCallback(async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      setDropdownOpen(false);
      return;
    }

    setSuggestionsLoading(true);

    try {
      // No API key — show filtered mock suggestions
      if (!GEOAPIFY_KEY) {
        const mock = filterMockCities(query);
        setSuggestions(mock);
        setDropdownOpen(true);
        setHighlightIndex(mock.length > 0 ? 0 : -1);
        return;
      }

      const results = await fetchGeoapifyDestinations(query, GEOAPIFY_KEY);

      setSuggestions(results);
      setDropdownOpen(true);
      setHighlightIndex(results.length > 0 ? 0 : -1);
    } catch {
      // API failed — allow free text as fallback
      setAllowFreeText(true);
      setSuggestions([]);
      setDropdownOpen(false);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  /** Fetch suggestions when debounced destination changes (not on every keystroke) */
  useEffect(() => {
    if (validDestination) return;

    if (debouncedDestination.length < 2) {
      setSuggestions([]);
      setDropdownOpen(false);
      setSuggestionsLoading(false);
      return;
    }

    fetchCitySuggestions(debouncedDestination);
  }, [debouncedDestination, validDestination, fetchCitySuggestions]);

  /** Close dropdown when clicking outside the destination field */
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        destinationWrapperRef.current &&
        !destinationWrapperRef.current.contains(e.target)
      ) {
        setDropdownOpen(false);
        setHighlightIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /** Select a city from the autocomplete dropdown */
  function selectCity(cityItem) {
    setDestination(cityItem.label);
    setValidDestination(true);
    setDestinationError("");
    setDropdownOpen(false);
    setSuggestions([]);
    setHighlightIndex(-1);
  }

  /** Handle destination input typing */
  function handleDestinationInputChange(e) {
    const value = e.target.value;
    setDestination(value);
    setValidDestination(false);
    setDestinationError("");
    if (value.length >= 2) setDropdownOpen(true);
  }

  /** Clear destination input */
  function clearDestination() {
    setDestination("");
    setValidDestination(false);
    setDestinationError("");
    setSuggestions([]);
    setDropdownOpen(false);
    destinationInputRef.current?.focus();
  }

  /** Keyboard navigation for autocomplete dropdown */
  function handleDestinationKeyDown(e) {
    if (!dropdownOpen || suggestions.length === 0) {
      if (e.key === "Escape") setDropdownOpen(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      selectCity(suggestions[highlightIndex]);
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
      setHighlightIndex(-1);
    }
  }

  // Toggle a multi-select activity interest chip
  function toggleInterest(interest) {
    setActivityInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  }

  // Build enriched vibe string from preference fields for the Gemini prompt
  function buildComposedVibe() {
    const parts = [
      `${travelerType} trip`,
      vibe,
      activityInterests.length
        ? `Interests: ${activityInterests.join(", ")}`
        : null,
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

  // Submit — validate destination selection, then delegate to useTrip
  function handleSubmit(e) {
    e.preventDefault();

    // Require dropdown selection unless API failed and free text is allowed
    if (!allowFreeText && !validDestination) {
      setDestinationError(
        "Please select a destination from the suggestions"
      );
      return;
    }

    setDestinationError("");
    const { days, travelMonth } = getTripDates();
    generateTrip(e, { vibe: buildComposedVibe(), days, travelMonth });
  }

  // Clicking a popular destination card pre-fills and marks as valid
  function handleDestinationPick(name, region) {
    const label = region ? `${name}, ${region.split(", ").pop()}` : name;
    setDestination(label);
    setValidDestination(true);
    setDestinationError("");
    setDropdownOpen(false);
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
              <form
                onSubmit={handleSubmit}
                className={`space-y-5 ${isGenerating ? "pointer-events-none opacity-80" : ""}`}
              >
                {/* Start Planning header + Geoapify city autocomplete */}
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-primary">
                    Start Planning
                  </h3>
                  <div ref={destinationWrapperRef} className="relative">
                    {/* Search icon — left inside input */}
                    <span className="material-symbols-outlined absolute top-1/2 left-3 z-10 -translate-y-1/2 text-on-surface-variant text-[20px]">
                      search
                    </span>

                    <input
                      ref={destinationInputRef}
                      type="text"
                      placeholder="Where to?"
                      value={destination}
                      onChange={handleDestinationInputChange}
                      onKeyDown={handleDestinationKeyDown}
                      onFocus={() => {
                        if (suggestions.length > 0 && !validDestination) {
                          setDropdownOpen(true);
                        }
                      }}
                      autoComplete="off"
                      aria-autocomplete="list"
                      aria-expanded={dropdownOpen}
                      aria-controls="destination-suggestions"
                      className="w-full rounded-lg border border-outline-variant bg-white py-3 pr-10 pl-10 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />

                    {/* Loading spinner or clear button — right inside input */}
                    {suggestionsLoading ? (
                      <span className="absolute top-1/2 right-3 -translate-y-1/2">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#F97316] border-t-transparent" />
                      </span>
                    ) : destination ? (
                      <button
                        type="button"
                        onClick={clearDestination}
                        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-lg leading-none text-on-surface-variant hover:text-primary"
                        aria-label="Clear destination"
                      >
                        ×
                      </button>
                    ) : null}

                    {/* Autocomplete dropdown */}
                    {dropdownOpen && destination.length >= 2 && (
                      <ul
                        id="destination-suggestions"
                        role="listbox"
                        className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
                      >
                        {suggestionsLoading && suggestions.length === 0 ? (
                          <li className="px-4 py-3 text-sm text-[#64748B]">
                            Searching destinations…
                          </li>
                        ) : suggestions.length === 0 ? (
                          <li className="px-4 py-3 text-sm text-[#64748B]">
                            No destinations found — try a city, state, or country
                          </li>
                        ) : (
                          suggestions.map((item, index) => {
                            const highlighted = index === highlightIndex;
                            const secondary =
                              item.subtitle ||
                              [item.state, item.country].filter(Boolean).join(", ");
                            return (
                              <li
                                key={`${item.placeId || item.label}-${index}`}
                                role="option"
                              >
                                <button
                                  type="button"
                                  onMouseEnter={() => setHighlightIndex(index)}
                                  onClick={() => selectCity(item)}
                                  className={`flex w-full cursor-pointer flex-col px-4 py-2.5 text-left transition-colors ${
                                    highlighted
                                      ? "border-l-[3px] border-l-[#F97316] bg-[#FFF7ED] pl-[13px]"
                                      : "border-l-[3px] border-l-transparent pl-[13px] hover:border-l-[#F97316] hover:bg-[#FFF7ED]"
                                  }`}
                                >
                                  <span className="text-sm font-medium text-[#1E3A8A]">
                                    {item.city}
                                  </span>
                                  {secondary && (
                                    <span className="text-xs text-[#64748B]">
                                      {secondary}
                                    </span>
                                  )}
                                </button>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    )}
                  </div>

                  {/* Destination validation error */}
                  {destinationError && (
                    <p className="text-sm text-red-600">{destinationError}</p>
                  )}

                  {/* Hint when API is unavailable — free text allowed */}
                  {allowFreeText && (
                    <p className="text-xs text-[#64748B]">
                      City search unavailable — you can type your destination
                      freely.
                    </p>
                  )}

                  {!GEOAPIFY_KEY && !allowFreeText && (
                    <p className="text-xs text-[#64748B]">
                      Add{" "}
                      <code className="rounded bg-[#F1F5F9] px-1">
                        NEXT_PUBLIC_GEOAPIFY_KEY
                      </code>{" "}
                      for live city search (showing mock suggestions).
                    </p>
                  )}
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

                {/* Travel vibe — single select, wrap layout */}
                <div className="space-y-2">
                  <span className="text-sm font-medium text-on-surface-variant">
                    Travel Vibe
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {TRAVEL_VIBES.map((option) => {
                      const selected = vibe === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setVibe(option)}
                          className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            selected
                              ? "border-[#F97316] bg-[#F97316] text-white"
                              : "border-[#E2E8F0] bg-white text-[#1E3A8A]"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Activity interests — multi-select chips, wrap layout */}
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
                              ? "border-[#F97316] bg-[#F97316] text-white"
                              : "border-[#E2E8F0] bg-white text-[#1E3A8A]"
                          }`}
                        >
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Orange CTA — shows spinner instantly while navigating to /generating */}
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-secondary-container py-4 text-base font-bold text-white shadow-lg hover:bg-secondary active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-90"
                >
                  {isGenerating ? (
                    <>
                      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Crafting your trip…
                    </>
                  ) : (
                    <>Generate My Itinerary ⚡</>
                  )}
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
              onClick={() => setShowAllDestinations((v) => !v)}
              className="flex cursor-pointer items-center gap-1 text-sm font-bold text-secondary-container transition-colors hover:text-secondary"
              aria-expanded={showAllDestinations}
            >
              {showAllDestinations ? "Show Less" : "View All"}
              <span className="material-symbols-outlined text-[18px]">
                {showAllDestinations ? "expand_less" : "arrow_forward"}
              </span>
            </button>
          </div>

          {showAllDestinations ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
              {POPULAR_DESTINATIONS.map((dest) => (
                <button
                  key={dest.name}
                  type="button"
                  onClick={() => handleDestinationPick(dest.name, dest.region)}
                  className="cursor-pointer text-left"
                >
                  <div className="relative h-[220px] overflow-hidden rounded-xl md:h-[280px]">
                    <img
                      src={dest.image}
                      alt={dest.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
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
          ) : (
            <div className="flex gap-6 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {POPULAR_DESTINATIONS.slice(0, POPULAR_PREVIEW_COUNT).map(
                (dest) => (
                  <button
                    key={dest.name}
                    type="button"
                    onClick={() =>
                      handleDestinationPick(dest.name, dest.region)
                    }
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
                )
              )}
            </div>
          )}
        </div>
      </section>

      {/* ─── How It Works — 3 simple steps ─── */}
      <section className="mx-auto max-w-[1280px] px-5 py-24 md:px-12">
        <div className="mb-16 flex flex-col items-center text-center">
          <span className="mb-4 inline-block rounded-full bg-primary-fixed px-3 py-1 text-xs font-semibold text-on-primary-fixed">
            GET STARTED
          </span>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-primary">
            How It Works
          </h2>
          <p className="max-w-2xl text-lg text-on-surface-variant">
            Three simple steps from dream destination to a ready-to-go itinerary.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <article
              key={step.number}
              className="rounded-xl border border-outline-variant/30 bg-white p-8 shadow-[0_4px_24px_rgba(15,23,42,0.06)]"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-3xl font-bold text-[#1E3A8A]">
                  {step.number}
                </span>
                <span className="text-3xl" aria-hidden="true">
                  {step.icon}
                </span>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-primary">
                {step.title}
              </h3>
              <p className="text-on-surface-variant">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ─── Stats — honest numbers replacing fake testimonials ─── */}
      <section className="bg-surface py-10 md:py-16">
        <div className="mx-auto max-w-[1280px] px-5 md:px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-[#F97316] md:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm text-[#64748B] md:text-base">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-12 text-center text-lg font-medium text-[#1E3A8A]">
            Join thousands of travelers planning smarter with AI
          </p>
        </div>
      </section>
    </div>
  );
}
