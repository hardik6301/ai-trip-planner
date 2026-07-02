"use client";

/**
 * Client wrapper for saved trips — enables day regeneration and persistence.
 */

import { useEffect, useState } from "react";
import TripItineraryView from "@/components/trips/TripItineraryView";
import { createClient } from "@/lib/supabase/client";
import { fetchUserProStatus, isProUser } from "@/lib/userPlan";
import { capitalizeDestination } from "@/utils/formatTrip";

export default function SavedTripView({ trip, ownerId }) {
  const [tripData, setTripData] = useState(() => buildTripData(trip));
  const [isPro, setIsPro] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

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

  return (
    <TripItineraryView
      tripData={tripData}
      tripId={isOwner ? trip.id : null}
      shareTripId={trip.id}
      onTripDataChange={handleTripDataChange}
      isPro={isPro}
      canRegenerate={isOwner}
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
