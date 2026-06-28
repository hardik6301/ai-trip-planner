"use client";

/**
 * Custom hook that encapsulates all trip form state and API generation logic.
 * Keeps page components thin by owning form fields, loading/error states,
 * the POST /api/generate-trip call, and sessionStorage persistence.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TRAVEL_VIBES,
  DEFAULT_DAYS,
  TRIP_STORAGE_KEY,
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
  // True while the generate-trip API call is in progress
  const [loading, setLoading] = useState(false);
  // Error message shown below the form on API failure
  const [error, setError] = useState("");
  // Holds the parsed itinerary JSON returned by the API
  const [tripData, setTripData] = useState(null);

  // Submit handler — calls API then navigates to /results with trip data
  // Optional overrides let the home page compose vibe/budget from extra UI fields
  async function generateTrip(e, overrides = {}) {
    e.preventDefault();
    setError("");
    setTripData(null);
    setLoading(true);

    const payload = {
      destination,
      days: overrides.days ?? days,
      budget: overrides.budget ?? budget,
      vibe: overrides.vibe ?? vibe,
      travelMonth: overrides.travelMonth ?? null,
    };

    try {
      const response = await fetch("/api/generate-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Something went wrong");
      }

      const storedTrip = {
        ...data,
        tripMeta: {
          days: payload.days,
          budget: payload.budget,
          vibe: payload.vibe,
          travelMonth: payload.travelMonth,
        },
      };

      // Persist trip data for the results page (includes form meta for display)
      sessionStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(storedTrip));
      setTripData(storedTrip);

      router.push("/results");
    } catch (err) {
      setError(
        err.message || "Failed to generate itinerary. Please try again."
      );
    } finally {
      setLoading(false);
    }
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
    loading,
    error,
    tripData,
    generateTrip,
  };
}
