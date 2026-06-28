/**
 * Public shareable trip view — fetches a saved trip by id from Supabase.
 * No authentication required; anyone with the link can view the itinerary.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TripItineraryView from "@/components/trips/TripItineraryView";
import { capitalizeDestination } from "@/utils/formatTrip";

export default async function TripPage({ params }) {
  const { id } = await params;

  // Fetch the trip by id — public read via RLS
  const supabase = await createClient();
  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, destination, days, budget, vibe, itinerary, created_at")
    .eq("id", id)
    .single();

  // Friendly not-found state
  if (error || !trip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-5 text-center">
        <span className="material-symbols-outlined text-6xl text-primary">
          travel_explore
        </span>
        <h1 className="text-2xl font-bold text-primary">Trip not found</h1>
        <p className="max-w-md text-on-surface-variant">
          This trip may have been deleted or the link is incorrect.
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

  // Reconstruct tripData shape expected by TripItineraryView
  const tripData = {
    ...trip.itinerary,
    destination: capitalizeDestination(trip.destination),
    tripMeta: {
      days: trip.days,
      budget: trip.budget,
      vibe: trip.vibe,
    },
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans">
      <TripItineraryView
          tripData={tripData}
          heroBadge="Shared Itinerary"
          footerExtra={
            <div className="text-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary-container px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-secondary"
              >
                <span className="material-symbols-outlined">auto_awesome</span>
                Plan Your Own Trip
              </Link>
            </div>
          }
        />
    </div>
  );
}
