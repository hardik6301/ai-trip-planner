"use client";

/**
 * Client wrapper for saved trips — enables day regeneration, persistence,
 * and the floating AI chat editor for trip owners.
 */

import { useEffect, useRef, useState } from "react";
import TripItineraryView from "@/components/trips/TripItineraryView";
import TripChatEditor from "@/components/trips/TripChatEditor";
import { createClient } from "@/lib/supabase/client";
import { fetchUserProStatus, isProUser } from "@/lib/userPlan";
import { capitalizeDestination } from "@/utils/formatTrip";

export default function SavedTripView({ trip, ownerId }) {
  const [tripData, setTripData] = useState(() => buildTripData(trip));
  const [isPro, setIsPro] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Day cards highlighted after AI chat edits
  const [aiFlashDays, setAiFlashDays] = useState([]);
  const [aiBadgeDays, setAiBadgeDays] = useState([]);
  const aiTimersRef = useRef([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setIsOwner(Boolean(user && ownerId && user.id === ownerId));
      if (user) {
        const { isPro: proStatus } = await fetchUserProStatus(supabase, user.id);
        setIsPro(proStatus || isProUser(user));
      } else {
        setIsPro(false);
      }
    });
  }, [ownerId]);

  function handleTripDataChange(next) {
    setTripData(next);
  }

  function handleAiDaysUpdated(days) {
    aiTimersRef.current.forEach(clearTimeout);
    setAiFlashDays(days);
    setAiBadgeDays(days);
    aiTimersRef.current = [
      setTimeout(() => setAiFlashDays([]), 1500),
      setTimeout(() => setAiBadgeDays([]), 3000),
    ];
    requestAnimationFrame(() => {
      document
        .getElementById(`day-${Math.min(...days)}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  useEffect(() => {
    return () => aiTimersRef.current.forEach(clearTimeout);
  }, []);

  return (
    <>
      <TripItineraryView
        tripData={tripData}
        tripId={isOwner ? trip.id : null}
        shareTripId={trip.id}
        onTripDataChange={handleTripDataChange}
        isPro={isPro}
        canRegenerate={isOwner}
        aiFlashDays={aiFlashDays}
        aiBadgeDays={aiBadgeDays}
        expensesHref={isOwner && isPro ? `/trip/${trip.id}/expenses` : null}
        heroBadge={isOwner ? "AI Optimized Itinerary" : "Shared Itinerary"}
        saveButton={false}
        footerExtra={
          <div className="text-center">
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F97316] px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-[#ea580c]"
            >
              Plan Your Own Trip
            </a>
          </div>
        }
      />

      {/* Floating AI chat — bottom-right, owners only (matches /results) */}
      {isOwner && (
        <TripChatEditor
          tripData={tripData}
          destination={tripData.destination}
          isPro={isPro}
          onTripDataChange={handleTripDataChange}
          onDaysUpdated={handleAiDaysUpdated}
          tripId={trip.id}
        />
      )}
    </>
  );
}

function buildTripData(trip) {
  return {
    ...trip.itinerary,
    destination: capitalizeDestination(trip.destination),
    regenerationsUsed: trip.itinerary?.regenerationsUsed ?? 0,
    tripMeta: {
      days: trip.days,
      budget: trip.budget,
      vibe: trip.vibe,
    },
  };
}
