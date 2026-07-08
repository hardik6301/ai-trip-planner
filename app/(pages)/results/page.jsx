"use client";

/**
 * Travora results page — displays the AI-generated itinerary after form submission.
 * Reads trip data from sessionStorage and supports saving to Supabase.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, Check } from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import TripItineraryView from "@/components/trips/TripItineraryView";
import TripChatEditor from "@/components/trips/TripChatEditor";
import { TRIP_STORAGE_KEY, FREE_TRIP_LIMIT, FREE_REGENERATIONS_PER_TRIP } from "@/constants/tripOptions";
import { createClient } from "@/lib/supabase/client";
import { fetchUserProStatus, isProUser } from "@/lib/userPlan";
import { countUserTrips } from "@/lib/planLimits";

export default function ResultsPage() {
  // Parsed itinerary from sessionStorage after home page submission
  const [tripData, setTripData] = useState(null);
  // Avoid hydration mismatch before sessionStorage is read
  const [mounted, setMounted] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [tripCount, setTripCount] = useState(0);

  // Save button states: idle | saving | saved | auth_error | limit_reached | error
  const [saveState, setSaveState] = useState("idle");
  // Optional server error detail for debugging save failures
  const [saveErrorDetail, setSaveErrorDetail] = useState("");
  const [savedTripId, setSavedTripId] = useState(null);

  // Load trip data from sessionStorage on mount (legacy "wanderaiTrip" fallback)
  useEffect(() => {
    setMounted(true);
    const stored =
      sessionStorage.getItem(TRIP_STORAGE_KEY) ||
      sessionStorage.getItem("wanderaiTrip");
    if (stored) {
      setTripData(JSON.parse(stored));
    }

    createClient()
      .auth.getUser()
      .then(async ({ data: { user } }) => {
        if (!user) {
          setUserLoggedIn(false);
          setIsPro(false);
          setTripCount(0);
          return;
        }

        setUserLoggedIn(true);
        const supabase = createClient();
        const { isPro: proStatus } = await fetchUserProStatus(supabase, user.id);
        const pro = proStatus || isProUser(user);
        setIsPro(pro);

        if (!pro) {
          const count = await countUserTrips(supabase, user.id);
          setTripCount(count);
        } else {
          setTripCount(0);
        }
      });
  }, []);

  function handleTripDataChange(next) {
    setTripData(next);
    sessionStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(next));
  }

  // Day cards recently modified by the AI chat editor
  const [aiFlashDays, setAiFlashDays] = useState([]); // orange border flash (1.5s)
  const [aiBadgeDays, setAiBadgeDays] = useState([]); // "✓ Updated by AI" badge (3s)
  const aiTimersRef = useRef([]);

  // Highlight + badge the changed day cards, then scroll the first one into view
  function handleAiDaysUpdated(days) {
    aiTimersRef.current.forEach(clearTimeout);
    setAiFlashDays(days);
    setAiBadgeDays(days);
    aiTimersRef.current = [
      setTimeout(() => setAiFlashDays([]), 1500),
      setTimeout(() => setAiBadgeDays([]), 3000),
    ];
    // Wait a frame so the updated cards are painted before scrolling
    requestAnimationFrame(() => {
      document
        .getElementById(`day-${Math.min(...days)}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Clear pending highlight timers on unmount
  useEffect(() => {
    return () => aiTimersRef.current.forEach(clearTimeout);
  }, []);

  // Save the current itinerary to Supabase via the API
  async function handleSave() {
    if (!tripData || saveState === "saved" || saveState === "saving") return;

    if (!isPro && tripCount >= FREE_TRIP_LIMIT) {
      setSaveState("limit_reached");
      return;
    }

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

      if (response.status === 403 && data.code === "TRIP_LIMIT_REACHED") {
        setTripCount(data.tripCount ?? FREE_TRIP_LIMIT);
        setSaveState("limit_reached");
        return;
      }

      if (!response.ok) {
        setSaveErrorDetail(data.details || data.error || "");
        setSaveState("error");
        return;
      }

      setSavedTripId(data.trip?.id ?? null);
      setTripCount((c) => c + 1);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  const atTripLimit = !isPro && tripCount >= FREE_TRIP_LIMIT;

  // Save button — rendered inside the hero budget card
  function renderSaveButton() {
    const isSaving = saveState === "saving";
    const isSaved = saveState === "saved";
    const limitReached = saveState === "limit_reached" || atTripLimit;

    return (
      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isSaved || limitReached}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#F97316] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaved ? (
            <Check className="h-4 w-4" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
          {isSaving
            ? "Saving..."
            : isSaved
              ? "Saved!"
              : limitReached
                ? "Trip limit reached"
                : "Save to My Trips"}
        </button>

        {!isPro && userLoggedIn && !limitReached && !isSaved && (
          <p className="mt-2 text-center text-xs text-[#64748B]">
            {tripCount} / {FREE_TRIP_LIMIT} free trips saved
          </p>
        )}

        {saveState === "auth_error" && (
          <p className="mt-3 text-center text-sm text-red-600">
            Sign in to save this trip.{" "}
            <Link href="/auth/login" className="font-semibold underline">
              Sign in
            </Link>
          </p>
        )}

        {limitReached && (
          <p className="mt-3 text-center text-sm text-[#9A3412]">
            Free plan allows {FREE_TRIP_LIMIT} saved trips.{" "}
            <Link href="/pricing" className="font-semibold text-[#F97316] underline">
              Upgrade to Pro
            </Link>{" "}
            for unlimited.
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
        tripId={savedTripId}
        shareTripId={savedTripId}
        onTripDataChange={handleTripDataChange}
        isPro={isPro}
        canRegenerate={userLoggedIn}
        aiFlashDays={aiFlashDays}
        aiBadgeDays={aiBadgeDays}
        saveButton={renderSaveButton()}
        footerExtra={
          <div className="space-y-3 text-center">
            {!userLoggedIn && (
              <p className="text-sm text-[#64748B]">
                <Link href="/auth/login" className="font-semibold text-[#F97316] underline">
                  Sign in
                </Link>{" "}
                to regenerate days ({FREE_REGENERATIONS_PER_TRIP} free per trip on Free plan).
              </p>
            )}
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

      {/* Floating AI Chat Editor — Pro users can edit the itinerary via chat */}
      <TripChatEditor
        tripData={tripData}
        destination={tripData.destination}
        isPro={isPro}
        onTripDataChange={handleTripDataChange}
        onDaysUpdated={handleAiDaysUpdated}
        tripId={savedTripId}
      />
    </div>
  );
}
