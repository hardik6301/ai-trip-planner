"use client";

/**
 * My Trips dashboard — protected page shown after successful login.
 * Displays the signed-in user and links to plan new trips.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function MyTripsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load the current authenticated user on mount
  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        router.replace("/auth/login");
        return;
      }

      setUser(currentUser);
      setLoading(false);
    }

    loadUser();
  }, [router]);

  // Sign out and return to home
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface text-on-surface-variant">
        <LoadingSpinner />
        Loading your dashboard...
      </div>
    );
  }

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0];

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans">
      <Navbar />

      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-28 md:px-12">
        {/* Dashboard header */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">
              My Trips
            </h1>
            <p className="mt-2 text-on-surface-variant">
              Welcome back, {displayName}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border border-outline-variant/50 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary-fixed"
          >
            Sign Out
          </button>
        </div>

        {/* Empty state — no saved trips yet */}
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
      </main>

      <Footer />
    </div>
  );
}
