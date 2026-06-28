"use client";

/**
 * Trip card for the My Trips dashboard with view and delete actions.
 * Client component so delete can call the API and refresh the page.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { capitalizeDestination, formatBudget, formatTripDate } from "@/utils/formatTrip";

export default function TripCard({ trip }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const destination = capitalizeDestination(trip.destination);
  const budget =
    trip.itinerary?.totalBudgetEstimate || formatBudget(trip.budget);

  // Delete this trip via the API and refresh the page list
  async function handleDelete() {
    if (!confirm(`Delete your ${destination} trip?`)) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/delete-trip?id=${trip.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Delete failed");

      router.refresh();
    } catch {
      alert("Failed to delete trip. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <article className="itinerary-card-shadow itinerary-card-hover rounded-xl border border-outline-variant/30 bg-white p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-primary">{destination}</h2>

          {/* Days + vibe badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-semibold text-primary">
              {trip.days} days
            </span>
            <span className="rounded-full bg-secondary-container/10 px-3 py-1 text-xs font-semibold text-secondary">
              {trip.vibe}
            </span>
          </div>

          <p className="mt-3 text-sm text-on-surface-variant">
            Budget: {formatBudget(trip.budget)}
            {budget && budget !== trip.budget && (
              <span className="ml-1">· Est. {budget}</span>
            )}
          </p>

          <p className="mt-1 text-xs text-on-surface-variant">
            Saved {formatTripDate(trip.created_at)}
          </p>
        </div>

        {/* View + delete actions */}
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/trip/${trip.id}`}
            className="rounded-lg bg-secondary-container px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary"
          >
            View Itinerary
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? "..." : "Delete"}
          </button>
        </div>
      </div>
    </article>
  );
}
