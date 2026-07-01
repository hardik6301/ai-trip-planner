"use client";

/**
 * Custom hook that encapsulates all trip form state and API generation logic.
 * Keeps page components thin by owning form fields, loading/error states,
 * the POST /api/generate-trip call, and sessionStorage persistence.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  TRAVEL_VIBES,
  DEFAULT_DAYS,
  PENDING_TRIP_REQUEST_KEY,
  TRIP_GENERATION_ERROR_KEY,
} from "@/constants/tripOptions";

export function useTrip() {
  const router = useRouter();

  // Form field — destination city or region
  const [destination, setDestination] = useState("");
  // Form field — trip length in days
  const [days, setDays] = useState(DEFAULT_DAYS);
  // Form field — budget as free text
  const [budget, setBudget] = useState("");
  // Form field — selected travel vibe
  const [vibe, setVibe] = useState(TRAVEL_VIBES[0]);
  // Error message shown below the form on API failure
  const [error, setError] = useState("");
  // Holds the parsed itinerary JSON returned by the API
  const [tripData, setTripData] = useState(null);

  // Surface errors returned from /generating when user navigates back home
  useEffect(() => {
    const message = sessionStorage.getItem(TRIP_GENERATION_ERROR_KEY);
    if (message) {
      setError(message);
      sessionStorage.removeItem(TRIP_GENERATION_ERROR_KEY);
    }
  }, []);

  // Submit handler — stores payload and navigates to /generating for Stitch loading UI
  async function generateTrip(e, overrides = {}) {
    e.preventDefault();
    setError("");
    setTripData(null);

    const payload = {
      destination,
      days: overrides.days ?? days,
      budget: overrides.budget ?? budget,
      vibe: overrides.vibe ?? vibe,
      travelMonth: overrides.travelMonth ?? null,
    };

    sessionStorage.setItem(PENDING_TRIP_REQUEST_KEY, JSON.stringify(payload));
    router.push("/generating");
  }

  return {
    destination,
    setDestination,
    days,
    setDays,
    budget,
    setBudget,
    vibe,
    setVibe,
    error,
    tripData,
    generateTrip,
  };
}
