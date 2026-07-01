/**
 * Public shareable trip view — fetches a saved trip by id from Supabase.
 * Logged-in owners and anonymous visitors (shared links) are both supported.
 */

import SavedTripView from "@/components/trips/SavedTripView";
import { fetchTripById } from "@/lib/fetchTrip";
import { sanitizeTripId } from "@/utils/shareTrip";
import Link from "next/link";

export default async function TripPage({ params }) {
  const { id: rawId } = await params;
  const id = sanitizeTripId(rawId);

  if (!id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-5 text-center">
        <h1 className="text-2xl font-bold text-primary">Invalid trip link</h1>
        <Link
          href="/"
          className="rounded-lg bg-secondary-container px-6 py-3 font-semibold text-white"
        >
          Plan Your Own Trip
        </Link>
      </div>
    );
  }

  const trip = await fetchTripById(id);

  if (!trip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-5 text-center">
        <span className="material-symbols-outlined text-6xl text-primary">
          travel_explore
        </span>
        <h1 className="text-2xl font-bold text-primary">Trip not found</h1>
        <p className="max-w-md text-on-surface-variant">
          This trip may have been deleted, the link is incorrect, or public
          viewing is not enabled yet. If you own this trip, make sure you are
          signed in.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-secondary-container px-6 py-3 font-semibold text-white transition-colors hover:bg-secondary"
        >
          Plan Your Own Trip
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans">
      <SavedTripView trip={trip} ownerId={trip.user_id} />
    </div>
  );
}
