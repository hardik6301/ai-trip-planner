"use client";

/**
 * Client wrapper for saved trips — owners + editors (edit-token collaborators).
 * Refresh-based sync on focus; optimistic versioning on AI saves.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import TripItineraryView from "@/components/trips/TripItineraryView";
import TripChatEditor from "@/components/trips/TripChatEditor";
import { createClient } from "@/lib/supabase/client";
import { fetchUserProStatus, isProUser } from "@/lib/userPlan";
import { capitalizeDestination } from "@/utils/formatTrip";
import { useToast } from "@/components/ui/Toast";

export default function SavedTripView({ trip, ownerId }) {
  const { showToast } = useToast();
  const [tripData, setTripData] = useState(() => buildTripData(trip));
  const [itineraryVersion, setItineraryVersion] = useState(
    trip.itinerary_version ?? 1
  );
  const [isPro, setIsPro] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [role, setRole] = useState("viewer");
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [conflictBanner, setConflictBanner] = useState("");

  const [aiFlashDays, setAiFlashDays] = useState([]);
  const [aiBadgeDays, setAiBadgeDays] = useState([]);
  const aiTimersRef = useRef([]);
  const versionRef = useRef(itineraryVersion);

  useEffect(() => {
    versionRef.current = itineraryVersion;
  }, [itineraryVersion]);

  const refreshTrip = useCallback(
    async ({ silent = true } = {}) => {
      try {
        const res = await fetch(`/api/trip/${trip.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const nextVersion = data.itineraryVersion ?? 1;

        setRole(data.role || "viewer");
        setCanEdit(Boolean(data.canEdit));
        setIsOwner(data.role === "owner");

        if (nextVersion !== versionRef.current) {
          setTripData(buildTripData(data.trip));
          setItineraryVersion(nextVersion);
          if (!silent) {
            showToast("Trip refreshed with latest changes", "info");
          }
        } else if (data.trip) {
          // Still sync role flags even if version unchanged
          setItineraryVersion(nextVersion);
        }
      } catch {
        /* ignore refresh errors */
      }
    },
    [trip.id, showToast]
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      const owner = Boolean(user && ownerId && user.id === ownerId);
      setIsOwner(owner);
      if (user) {
        const { isPro: proStatus } = await fetchUserProStatus(supabase, user.id);
        setIsPro(proStatus || isProUser(user));
        // Resolve editor membership via refresh endpoint
        await refreshTrip({ silent: true });
        if (owner) {
          setCanEdit(true);
          setRole("owner");
        }
      } else {
        setIsPro(false);
        setCanEdit(false);
        setRole("viewer");
      }
    });
  }, [ownerId, refreshTrip]);

  // Refresh-based sync — pull latest when the tab regains focus
  useEffect(() => {
    function onFocus() {
      refreshTrip({ silent: true }).then(() => {
        /* version bump handled inside */
      });
    }
    window.addEventListener("focus", onFocus);
    const interval = setInterval(() => refreshTrip({ silent: true }), 45000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [refreshTrip]);

  function handleTripDataChange(next) {
    setTripData(next);
  }

  function handleVersionUpdate(nextVersion) {
    if (nextVersion != null) {
      setItineraryVersion(nextVersion);
      setConflictBanner("");
    }
  }

  async function handleVersionConflict() {
    setConflictBanner(
      "Someone else updated this trip. Reloaded the latest version — review and try your edit again."
    );
    await refreshTrip({ silent: false });
    showToast("Trip changed — refreshed latest itinerary", "error");
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

  const heroBadge =
    role === "owner"
      ? "AI Optimized Itinerary"
      : role === "editor"
        ? "Collaborator · Editor"
        : "Shared Itinerary";

  return (
    <>
      {conflictBanner && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-900">
          {conflictBanner}{" "}
          <button
            type="button"
            onClick={() => setConflictBanner("")}
            className="ml-2 font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <TripItineraryView
        tripData={tripData}
        tripId={canEdit ? trip.id : null}
        shareTripId={trip.id}
        onTripDataChange={handleTripDataChange}
        isPro={isPro}
        canRegenerate={canEdit}
        aiFlashDays={aiFlashDays}
        aiBadgeDays={aiBadgeDays}
        expensesHref={isOwner && isPro ? `/trip/${trip.id}/expenses` : null}
        heroBadge={heroBadge}
        saveButton={false}
        showEditInvite={isOwner}
        onOpenAiAssistant={
          canEdit && isPro ? () => setAiChatOpen(true) : null
        }
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

      {canEdit && (
        <TripChatEditor
          tripData={tripData}
          destination={tripData.destination}
          isPro={isPro}
          onTripDataChange={handleTripDataChange}
          onDaysUpdated={handleAiDaysUpdated}
          tripId={trip.id}
          itineraryVersion={itineraryVersion}
          onVersionUpdate={handleVersionUpdate}
          onVersionConflict={handleVersionConflict}
          open={aiChatOpen}
          onOpenChange={setAiChatOpen}
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
