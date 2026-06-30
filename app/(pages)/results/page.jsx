"use client";

/**
 * Travora results page — displays the AI-generated itinerary after form submission.
 * Reads trip data from sessionStorage and supports saving to Supabase.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Check } from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import TripItineraryView from "@/components/trips/TripItineraryView";
import { TRIP_STORAGE_KEY } from "@/constants/tripOptions";

export default function ResultsPage() {
  // Parsed itinerary from sessionStorage after home page submission
  const [tripData, setTripData] = useState(null);
  // Avoid hydration mismatch before sessionStorage is read
  const [mounted, setMounted] = useState(false);

  // Save button states: idle | saving | saved | auth_error | error
  const [saveState, setSaveState] = useState("idle");
  // Optional server error detail for debugging save failures
  const [saveErrorDetail, setSaveErrorDetail] = useState("");

  // Load trip data from sessionStorage on mount (supports legacy key names)
  useEffect(() => {
    setMounted(true);
    const stored =
      sessionStorage.getItem(TRIP_STORAGE_KEY) ||
      sessionStorage.getItem("travoraTrip") ||
      sessionStorage.getItem("wanderaiTrip");
    if (stored) {
      setTripData(JSON.parse(stored));
    }
  }, []);

  // Save the current itinerary to Supabase via the API
  async function handleSave() {
    if (!tripData || saveState === "saved" || saveState === "saving") return;

    setSaveState("saving");
    setSaveErrorDetail("");

    const { tripMeta } = tripData;

    try {
      const response = await fetch("/api/save-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: tripData.destination,
          days: tripMeta?.days ?? tripData.days?.length ?? 0,
          budget: tripMeta?.budget ?? tripData.totalBudgetEstimate ?? "",
          vibe: tripMeta?.vibe ?? "",
          itinerary: tripData,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        setSaveState("auth_error");
        return;
      }

      if (!response.ok) {
        setSaveErrorDetail(data.details || data.error || "");
        setSaveState("error");
        return;
      }

      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  // Save button — rendered inside the hero budget card
  function renderSaveButton() {
    const isSaving = saveState === "saving";
    const isSaved = saveState === "saved";

    return (
      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isSaved}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#F97316] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaved ? (
            <Check className="h-4 w-4" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
          {isSaving ? "Saving..." : isSaved ? "Saved!" : "Save to My Trips"}
        </button>

        {saveState === "auth_error" && (
          <p className="mt-3 text-center text-sm text-red-600">
            Sign in to save this trip.{" "}
            <Link href="/auth/login" className="font-semibold underline">
              Sign in
            </Link>
          </p>
        )}

        {saveState === "error" && (
          <p className="mt-3 text-center text-sm text-red-600">
            Failed to save. Try again.
            {saveErrorDetail && (
              <span className="mt-1 block text-xs opacity-80">
                {saveErrorDetail}
              </span>
            )}
          </p>
        )}
      </div>
    );
  }

  // Loading state while waiting for client hydration
  if (!mounted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8FAFC] text-[#64748B]">
        <LoadingSpinner />
        Loading your itinerary...
      </div>
    );
  }

  // Empty state when user lands on /results without trip data
  if (!tripData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-5 text-center">
        <span className="material-symbols-outlined text-6xl text-primary">
          map
        </span>
        <h1 className="text-2xl font-bold text-primary">No trip found</h1>
        <p className="max-w-md text-on-surface-variant">
          Generate an itinerary from the home page first.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-secondary-container px-6 py-3 font-semibold text-white transition-colors hover:bg-secondary"
        >
          Plan a Trip
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans">
      <TripItineraryView
        tripData={tripData}
        saveButton={renderSaveButton()}
        footerExtra={
          <div className="text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-secondary-container"
            >
              <span className="material-symbols-outlined text-[18px]">
                arrow_back
              </span>
              Plan another trip
            </Link>
          </div>
        }
      />
    </div>
  );
}
