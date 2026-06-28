/**
 * My Trips dashboard — server component that lists all saved trips for the
 * logged-in user fetched directly from Supabase.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TripCard from "@/components/trips/TripCard";

export default async function MyTripsPage() {
  // Create a server Supabase client with the user's session cookies
  const supabase = await createClient();

  // Verify the user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect to login if no session (middleware also protects this route)
  if (!user) {
    redirect("/auth/login");
  }

  // Fetch all trips belonging to this user, newest first
  const { data: trips, error } = await supabase
    .from("trips")
    .select("id, destination, days, budget, vibe, itinerary, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching trips:", error);
  }

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0];

  const hasTrips = trips && trips.length > 0;

  return (
    <div className="mx-auto max-w-[1280px] px-5 pb-16 pt-8 md:px-12">
      {/* Dashboard header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          My Trips
        </h1>
        <p className="mt-2 text-on-surface-variant">
          Welcome back, {displayName}
        </p>
      </div>

        {hasTrips ? (
          /* Saved trip cards grid */
          <div className="grid gap-6">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        ) : (
          /* Empty state — no saved trips yet */
          <div className="itinerary-card-shadow rounded-xl border border-outline-variant/30 bg-white p-10 text-center">
            <span className="material-symbols-outlined mb-4 text-5xl text-primary">
              luggage
            </span>
            <h2 className="text-xl font-semibold text-on-surface">
              No saved trips yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-on-surface-variant">
              Generate an AI itinerary on the home page, then save it here to
              access it anytime.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-secondary-container px-6 py-3 font-semibold text-white transition-colors hover:bg-secondary"
            >
              Plan a New Trip
            </Link>
          </div>
        )}
    </div>
  );
}
