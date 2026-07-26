"use client";

/**
 * My Trips — premium dashboard for saved AI itineraries.
 * Client-side fetch from Supabase; card grid with cover images and filters.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Sparkles } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import {
  capitalizeDestination,
  formatBudget,
  formatTripDate,
} from "@/utils/formatTrip";
import { getPlaceImage, PLACE_IMAGE_FALLBACK } from "@/utils/placeImages";
import { fetchUserProStatus, isProUser } from "@/lib/userPlan";
import { FREE_TRIP_LIMIT } from "@/constants/tripOptions";

const FILTER_TABS = [
  { id: "all", label: "All Trips" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "drafts", label: "Drafts" },
];

/** True when itinerary JSON is missing or has no day entries */
function isDraftTrip(trip) {
  const days = trip.itinerary?.days;
  return !trip.itinerary || !Array.isArray(days) || days.length === 0;
}

/** Upcoming = saved itineraries; Past = older than 6 months */
function isPastTrip(trip) {
  if (isDraftTrip(trip)) return false;
  const created = new Date(trip.created_at);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return created < sixMonthsAgo;
}

function isUpcomingTrip(trip) {
  return !isDraftTrip(trip) && !isPastTrip(trip);
}

/** Cover image URL — destination keyword match via placeImages helper */
function getTripCoverUrl(destination) {
  return getPlaceImage(destination, "landmark", destination);
}

/** Display budget from itinerary estimate or stored budget field */
function getTripBudget(trip) {
  return (
    trip.itinerary?.totalBudgetEstimate ||
    formatBudget(trip.budget) ||
    "Budget TBD"
  );
}

export default function MyTripsPage() {
  const router = useRouter();

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [deletingId, setDeletingId] = useState(null);
  const [renamingTrip, setRenamingTrip] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState("");
  const [isPro, setIsPro] = useState(false);

  /** Load trips for the authenticated user */
  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError("");

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth/login");
      return;
    }

    const { isPro: proStatus } = await fetchUserProStatus(supabase, user.id);
    setIsPro(proStatus || isProUser(user));

    const { data: owned, error: fetchError } = await supabase
      .from("trips")
      .select("id, destination, days, budget, vibe, itinerary, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Collaborator trips (edit-token members) — additive; ignore if table missing
    let shared = [];
    const { data: memberships } = await supabase
      .from("trip_members")
      .select("trip_id, role")
      .eq("user_id", user.id)
      .in("role", ["editor", "owner"]);

    if (memberships?.length) {
      const ids = memberships
        .map((m) => m.trip_id)
        .filter((id) => !(owned || []).some((t) => t.id === id));
      if (ids.length) {
        const { data: memberTrips } = await supabase
          .from("trips")
          .select("id, destination, days, budget, vibe, itinerary, created_at")
          .in("id", ids)
          .order("created_at", { ascending: false });
        shared = (memberTrips || []).map((t) => ({ ...t, _role: "editor" }));
      }
    }

    if (fetchError) {
      setError("Could not load your trips. Please try again.");
      setTrips([]);
    } else {
      setTrips([...(owned ?? []), ...shared]);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  /** Filter trips by active pill tab */
  const filteredTrips = useMemo(() => {
    switch (activeFilter) {
      case "upcoming":
        return trips.filter(isUpcomingTrip);
      case "past":
        return trips.filter(isPastTrip);
      case "drafts":
        return trips.filter(isDraftTrip);
      default:
        return trips;
    }
  }, [trips, activeFilter]);

  const showLimitBanner = !isPro && trips.length >= FREE_TRIP_LIMIT;

  /** Open the rename modal for a trip card */
  function openRename(trip) {
    setRenamingTrip(trip);
    setRenameValue(trip.destination || "");
    setRenameError("");
  }

  /** Close rename modal and reset form state */
  function closeRename() {
    if (renameSaving) return;
    setRenamingTrip(null);
    setRenameValue("");
    setRenameError("");
  }

  /** Save a new display name via PATCH /api/update-trip */
  async function handleRenameSubmit(e) {
    e.preventDefault();
    if (!renamingTrip) return;

    const nextName = renameValue.trim();
    if (!nextName) {
      setRenameError("Enter a trip name.");
      return;
    }
    if (nextName === renamingTrip.destination) {
      closeRename();
      return;
    }

    setRenameSaving(true);
    setRenameError("");

    try {
      const response = await fetch("/api/update-trip", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: renamingTrip.id, destination: nextName }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Rename failed");
      }

      setTrips((prev) =>
        prev.map((t) =>
          t.id === renamingTrip.id
            ? {
                ...t,
                destination: data.trip?.destination ?? nextName,
                itinerary: data.trip?.itinerary ?? t.itinerary,
              }
            : t
        )
      );
      closeRename();
    } catch (err) {
      setRenameError(err.message || "Could not rename trip. Try again.");
    } finally {
      setRenameSaving(false);
    }
  }

  /** Delete trip via API and remove from local state */
  async function handleDelete(tripId, destination) {
    if (!window.confirm("Delete this trip?")) return;

    setDeletingId(tripId);
    try {
      const response = await fetch(`/api/delete-trip?id=${tripId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Delete failed");

      setTrips((prev) => prev.filter((t) => t.id !== tripId));
    } catch {
      window.alert(`Failed to delete ${destination}. Please try again.`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F8FAFC] pb-12 sm:pb-16">
      <div className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6 sm:pt-8">
        {/* ─── Trip limit banner (free users at 5 trips) ─── */}
        {showLimitBanner && (
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[#FED7AA] bg-[#FFF7ED] px-4 py-3.5 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
            <p className="text-sm leading-relaxed text-[#9A3412]">
              You&apos;ve reached your free limit of {FREE_TRIP_LIMIT} trips.
              Upgrade to Pro for unlimited trips.
            </p>
            <Link
              href="/pricing"
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c] sm:w-auto sm:min-h-0 sm:py-2"
            >
              Upgrade to Pro
            </Link>
          </div>
        )}

        {/* ─── Page header ─── */}
        <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl md:text-4xl">
              My Trips
            </h1>
            <p className="mt-1.5 text-sm text-[#64748B] sm:mt-2 sm:text-base">
              Manage your AI-crafted adventures
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#F97316] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#ea580c] sm:w-auto sm:min-h-0"
          >
            <Plus className="h-4 w-4" />
            Plan New Trip
          </Link>
        </div>

        {/* ─── Filter tabs — horizontal scroll on narrow screens ─── */}
        <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:mb-8 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`min-h-10 shrink-0 cursor-pointer rounded-full px-3.5 py-2 text-sm font-medium transition-colors sm:px-4 ${
                  isActive
                    ? "bg-[#0F172A] text-white shadow-sm"
                    : "border border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ─── Error state ─── */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ─── Loading skeleton grid ─── */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-[#E2E8F0]/60 bg-white shadow-md"
              >
                <div className="aspect-[16/10] animate-pulse bg-[#E2E8F0] sm:aspect-auto sm:h-[200px]" />
                <div className="space-y-3 p-4">
                  <div className="h-5 w-2/3 animate-pulse rounded bg-[#E2E8F0]" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-[#E2E8F0]" />
                  <div className="h-9 animate-pulse rounded-lg bg-[#E2E8F0]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── Empty state ─── */}
        {!loading && !error && trips.length === 0 && (
          <div className="flex flex-col items-center justify-center px-2 py-14 text-center sm:py-20">
            <span className="text-6xl sm:text-8xl" role="img" aria-label="Map">
              🗺️
            </span>
            <h2 className="mt-5 text-xl font-bold text-[#0F172A] sm:mt-6 sm:text-2xl">
              No trips planned yet
            </h2>
            <p className="mt-2 max-w-sm text-sm text-[#64748B] sm:text-base">
              Start planning your first AI adventure
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex min-h-11 w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-[#F97316] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c] sm:mt-8 sm:w-auto"
            >
              Plan Your First Trip →
            </Link>
          </div>
        )}

        {/* ─── Filtered empty (has trips but none in tab) ─── */}
        {!loading &&
          !error &&
          trips.length > 0 &&
          filteredTrips.length === 0 && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-10 text-center shadow-sm sm:px-6 sm:py-12">
              <p className="text-sm text-[#64748B] sm:text-base">
                No trips in this category yet.
              </p>
            </div>
          )}

        {/* ─── Trip cards grid ─── */}
        {!loading && filteredTrips.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {filteredTrips.map((trip) => (
              <TripGridCard
                key={trip.id}
                trip={trip}
                deleting={deletingId === trip.id}
                onDelete={handleDelete}
                onRename={openRename}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rename trip modal */}
      <Modal
        isOpen={Boolean(renamingTrip)}
        onClose={closeRename}
        title="Rename trip"
      >
        <form onSubmit={handleRenameSubmit}>
          <label htmlFor="rename-trip" className="text-sm font-medium text-[#64748B]">
            Trip name
          </label>
          <input
            id="rename-trip"
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={120}
            autoFocus
            placeholder="e.g. Summer in Manali"
            className="mt-2 w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-base text-[#0F172A] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 sm:py-2.5 sm:text-sm"
          />
          {renameError && (
            <p className="mt-2 text-sm text-red-600">{renameError}</p>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={closeRename}
              disabled={renameSaving}
              className="min-h-11 cursor-pointer rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm font-semibold text-[#64748B] transition-colors hover:bg-[#F8FAFC] disabled:opacity-60 sm:min-h-0 sm:py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={renameSaving || !renameValue.trim()}
              className="min-h-11 cursor-pointer rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:py-2"
            >
              {renameSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/** Single trip card with cover image, badges, and actions */
function TripGridCard({ trip, deleting, onDelete, onRename }) {
  const destination = capitalizeDestination(trip.destination);
  const budget = getTripBudget(trip);
  const draft = isDraftTrip(trip);

  const [imgSrc, setImgSrc] = useState(null);
  const [imgLoading, setImgLoading] = useState(!draft);

  // Real destination cover via place-image API
  useEffect(() => {
    if (draft) return;
    let cancelled = false;
    setImgLoading(true);

    const params = new URLSearchParams({
      place: trip.destination || "",
      activity: "city landmark",
      destination: trip.destination || "",
    });

    fetch(`/api/place-image?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setImgSrc(data.url || getTripCoverUrl(trip.destination));
      })
      .catch(() => {
        if (!cancelled) setImgSrc(getTripCoverUrl(trip.destination));
      })
      .finally(() => {
        if (!cancelled) setImgLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [trip.destination, draft]);

  const vibeShort =
    typeof trip.vibe === "string" && trip.vibe.length > 42
      ? `${trip.vibe.slice(0, 40)}…`
      : trip.vibe;
  const isEditor = trip._role === "editor";

  return (
    <article className="group overflow-hidden rounded-xl border border-[#E2E8F0]/60 bg-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      {/* ─── Cover image area ─── */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#E2E8F0] sm:aspect-auto sm:h-[200px]">
        {draft ? (
          /* Draft placeholder — dashed border style from reference */
          <div className="flex h-full w-full flex-col items-center justify-center border-b border-dashed border-[#CBD5E1] bg-[#F1F5F9]">
            <Pencil className="h-8 w-8 text-[#94A3B8] sm:h-10 sm:w-10" strokeWidth={1.5} />
            <span className="mt-2 text-xs font-medium text-[#64748B]">
              Draft — no cover yet
            </span>
          </div>
        ) : imgLoading || !imgSrc ? (
          <div className="h-full w-full animate-pulse bg-[#CBD5E1]/70" />
        ) : (
          <img
            src={imgSrc}
            alt={destination}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            onError={() => setImgSrc(PLACE_IMAGE_FALLBACK)}
          />
        )}

        {/* Badges — top left */}
        <div className="absolute top-2.5 left-2.5 flex max-w-[70%] flex-wrap gap-1.5 sm:top-3 sm:left-3">
          {!draft && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#0F172A]/85 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm sm:px-2.5 sm:text-[11px]">
              <Sparkles className="h-3 w-3 text-[#F97316]" />
              AI Crafted
            </span>
          )}
          {isEditor && (
            <span className="inline-flex items-center rounded-full bg-[#F97316]/95 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm sm:text-[11px]">
              Shared
            </span>
          )}
        </div>

        {/* Rename + delete icon buttons — top right */}
        <div className="absolute top-2.5 right-2.5 flex gap-1.5 sm:top-3 sm:right-3 sm:gap-2">
          <button
            type="button"
            onClick={() => onRename(trip)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/95 text-base shadow-sm transition-colors hover:bg-white sm:h-8 sm:w-8"
            aria-label={`Rename ${destination}`}
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={() => onDelete(trip.id, destination)}
            disabled={deleting}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/95 text-base shadow-sm transition-colors hover:bg-white disabled:opacity-60 sm:h-8 sm:w-8"
            aria-label={`Delete ${destination}`}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* ─── Card body ─── */}
      <div className="p-3.5 sm:p-4">
        {/* Title + budget row */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
          <h2 className="line-clamp-2 text-lg font-bold text-[#0F172A] sm:text-xl">
            {destination}
          </h2>
          {!draft && (
            <span className="shrink-0 text-sm font-bold text-[#C2410C]">
              {budget.length > 22 ? `${budget.slice(0, 20)}…` : budget}
            </span>
          )}
          {draft && (
            <span className="shrink-0 text-xs italic text-[#64748B]">
              Draft
            </span>
          )}
        </div>

        {/* Days + vibe badges */}
        <div className="mt-2.5 flex flex-wrap gap-2 sm:mt-3">
          <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-[#0F172A]">
            {trip.days} Days
          </span>
          {vibeShort && (
            <span
              className="max-w-full truncate rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-[#64748B]"
              title={trip.vibe}
            >
              {vibeShort}
            </span>
          )}
        </div>

        {/* Budget detail line */}
        {!draft && (
          <p className="mt-2 truncate text-sm text-[#64748B]">{budget}</p>
        )}

        {/* Saved date */}
        <p className="mt-1 text-xs text-[#94A3B8]">
          Saved {formatTripDate(trip.created_at)}
        </p>

        {/* CTA button */}
        {draft ? (
          <Link
            href="/"
            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg border border-[#E2E8F0] bg-white py-2.5 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC] sm:mt-4"
          >
            Continue Planning
          </Link>
        ) : (
          <Link
            href={`/trip/${trip.id}`}
            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg bg-[#0F172A] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E293B] sm:mt-4"
          >
            View Itinerary →
          </Link>
        )}
      </div>
    </article>
  );
}
