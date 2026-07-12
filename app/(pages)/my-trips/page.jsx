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

    const { data, error: fetchError } = await supabase
      .from("trips")
      .select("id, destination, days, budget, vibe, itinerary, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError("Could not load your trips. Please try again.");
      setTrips([]);
    } else {
      setTrips(data ?? []);
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
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      <div className="mx-auto max-w-[1400px] px-6 pt-8">
        {/* ─── Trip limit banner (free users at 5 trips) ─── */}
        {showLimitBanner && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-[#FED7AA] bg-[#FFF7ED] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#9A3412]">
              You&apos;ve reached your free limit of {FREE_TRIP_LIMIT} trips.
              Upgrade to Pro for unlimited trips.
            </p>
            <Link
              href="/pricing"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c]"
            >
              Upgrade to Pro
            </Link>
          </div>
        )}

        {/* ─── Page header ─── */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] md:text-4xl">
              My Trips
            </h1>
            <p className="mt-2 text-[#64748B]">
              Manage your AI-crafted adventures
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F97316] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#ea580c]"
          >
            <Plus className="h-4 w-4" />
            Plan New Trip
          </Link>
        </div>

        {/* ─── Filter tabs ─── */}
        <div className="mb-8 flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors ${
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-[#E2E8F0]/60 bg-white shadow-md"
              >
                <div className="h-[200px] animate-pulse bg-[#E2E8F0]" />
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
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-8xl" role="img" aria-label="Map">
              🗺️
            </span>
            <h2 className="mt-6 text-2xl font-bold text-[#0F172A]">
              No trips planned yet
            </h2>
            <p className="mt-2 max-w-sm text-[#64748B]">
              Start planning your first AI adventure
            </p>
            <Link
              href="/"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c]"
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
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-12 text-center shadow-sm">
              <p className="text-[#64748B]">
                No trips in this category yet.
              </p>
            </div>
          )}

        {/* ─── Trip cards grid ─── */}
        {!loading && filteredTrips.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
            className="mt-2 w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm text-[#0F172A] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
          />
          {renameError && (
            <p className="mt-2 text-sm text-red-600">{renameError}</p>
          )}
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeRename}
              disabled={renameSaving}
              className="cursor-pointer rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-semibold text-[#64748B] transition-colors hover:bg-[#F8FAFC] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={renameSaving || !renameValue.trim()}
              className="cursor-pointer rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
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

  return (
    <article className="group overflow-hidden rounded-xl border border-[#E2E8F0]/60 bg-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      {/* ─── Cover image area ─── */}
      <div className="relative h-[200px] w-full overflow-hidden bg-[#E2E8F0]">
        {draft ? (
          /* Draft placeholder — dashed border style from reference */
          <div className="flex h-full w-full flex-col items-center justify-center border-b border-dashed border-[#CBD5E1] bg-[#F1F5F9]">
            <Pencil className="h-10 w-10 text-[#94A3B8]" strokeWidth={1.5} />
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

        {/* AI Crafted badge — top left */}
        {!draft && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-[#0F172A]/85 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <Sparkles className="h-3 w-3 text-[#F97316]" />
            AI Crafted
          </span>
        )}

        {/* Rename + delete icon buttons — top right */}
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            type="button"
            onClick={() => onRename(trip)}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/95 text-base shadow-sm transition-colors hover:bg-white"
            aria-label={`Rename ${destination}`}
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={() => onDelete(trip.id, destination)}
            disabled={deleting}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/95 text-base shadow-sm transition-colors hover:bg-white disabled:opacity-60"
            aria-label={`Delete ${destination}`}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* ─── Card body ─── */}
      <div className="p-4">
        {/* Title + budget row */}
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-xl font-bold text-[#0F172A]">{destination}</h2>
          {!draft && (
            <span className="shrink-0 text-sm font-bold text-[#C2410C]">
              {budget.length > 18 ? `${budget.slice(0, 16)}…` : budget}
            </span>
          )}
          {draft && (
            <span className="shrink-0 text-xs italic text-[#64748B]">
              Draft
            </span>
          )}
        </div>

        {/* Days + vibe badges */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-[#0F172A]">
            {trip.days} Days
          </span>
          {trip.vibe && (
            <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-[#64748B]">
              {trip.vibe}
            </span>
          )}
        </div>

        {/* Budget detail line */}
        {!draft && (
          <p className="mt-2 text-sm text-[#64748B]">{budget}</p>
        )}

        {/* Saved date */}
        <p className="mt-1 text-xs text-[#94A3B8]">
          Saved {formatTripDate(trip.created_at)}
        </p>

        {/* CTA button */}
        {draft ? (
          <Link
            href="/"
            className="mt-4 flex w-full items-center justify-center rounded-lg border border-[#E2E8F0] bg-white py-2.5 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC]"
          >
            Continue Planning
          </Link>
        ) : (
          <Link
            href={`/trip/${trip.id}`}
            className="mt-4 flex w-full items-center justify-center rounded-lg bg-[#0F172A] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E293B]"
          >
            View Itinerary →
          </Link>
        )}
      </div>
    </article>
  );
}
