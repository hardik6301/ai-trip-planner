"use client";

// React hooks for form state, loading, errors, and navigation
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Travel vibe options matching the Stitch form dropdown
const VIBE_OPTIONS = [
  "Adventure",
  "Relaxation",
  "Cultural",
  "Romantic",
  "Family",
  "Budget Backpacking",
];

// Unsplash mountain hero background from the Stitch cinematic reference
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80";

export default function Home() {
  const router = useRouter();

  // Form field — destination city or region
  const [destination, setDestination] = useState("");
  // Form field — trip length in days
  const [days, setDays] = useState(7);
  // Form field — budget as free text
  const [budget, setBudget] = useState("");
  // Form field — selected travel vibe
  const [vibe, setVibe] = useState(VIBE_OPTIONS[0]);
  // True while the generate-trip API call is in progress
  const [loading, setLoading] = useState(false);
  // Error message shown below the form on API failure
  const [error, setError] = useState("");

  // Submit handler — calls API then navigates to /results with trip data
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/generate-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, days, budget, vibe }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Something went wrong");
      }

      // Persist trip data for the results page (includes form meta for display)
      sessionStorage.setItem(
        "wanderaiTrip",
        JSON.stringify({ ...data, tripMeta: { days, budget, vibe } })
      );

      router.push("/results");
    } catch (err) {
      setError(err.message || "Failed to generate itinerary. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans">
      {/* Fixed glass navbar — WanderAI logo left, nav links right */}
      <header className="glass-panel fixed top-0 left-0 z-50 w-full border-b border-outline-variant/30 shadow-sm">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-5 py-4 md:px-12">
          <span className="text-2xl font-semibold tracking-tight text-primary">
            WanderAI
          </span>

          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="/"
              className="border-b-2 border-primary text-base font-bold text-primary transition-colors"
            >
              Home
            </Link>
            <Link
              href="#"
              className="text-base text-on-surface-variant transition-colors hover:text-secondary"
            >
              My Trips
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="#"
              className="hidden text-base text-primary transition-colors hover:text-secondary md:block"
            >
              My Trips
            </Link>
            <button
              type="button"
              className="px-4 py-2 text-base text-primary transition-colors hover:text-secondary active:scale-95"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-screen pt-16">
        {/* Hero — full-width mountain background with form card on the right */}
        <section className="relative flex min-h-[700px] h-[921px] w-full items-center justify-center overflow-hidden px-5 md:px-12">
          {/* Background mountain image with dark overlay and bottom fade */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div
              className="h-full w-full bg-cover bg-center transition-transform duration-1000 hover:scale-105"
              style={{ backgroundImage: `url('${HERO_IMAGE}')` }}
            />
            <div className="absolute inset-0 bg-black/30" />
            <div className="hero-gradient absolute inset-0" />
          </div>

          {/* Hero content — headline left, planning form card right */}
          <div className="relative z-10 flex w-full max-w-[1280px] flex-col items-center justify-between gap-12 lg:flex-row">
            {/* Left column — headline and subheading over the hero image */}
            <div className="flex-1 text-center text-white drop-shadow-xl lg:text-left">
              <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight md:text-[56px]">
                Plan Your Perfect <br />
                Trip with{" "}
                <span className="text-secondary-container">AI</span>
              </h1>
              <p className="mx-auto max-w-xl text-lg text-white/90 lg:mx-0">
                Tell us where you want to go, we&apos;ll handle the rest.
                Personal itineraries crafted by intelligence, inspired by your
                unique travel soul.
              </p>
            </div>

            {/* Right column — white planning form card */}
            <div className="flex w-full max-w-md flex-col gap-6 rounded-xl border border-outline-variant/30 bg-white p-8 shadow-2xl">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Destination input with map icon label */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="destination"
                    className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      map
                    </span>
                    Destination
                  </label>
                  <input
                    id="destination"
                    type="text"
                    required
                    placeholder="Where to?"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full rounded-lg border-2 border-transparent bg-surface-container-low p-3 text-on-surface outline-none transition-all focus:border-primary focus:bg-white"
                  />
                </div>

                {/* Days and budget in a two-column grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="days"
                      className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant"
                    >
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        calendar_month
                      </span>
                      Number of Days
                    </label>
                    <input
                      id="days"
                      type="number"
                      required
                      min={1}
                      max={14}
                      value={days}
                      onChange={(e) => setDays(Number(e.target.value))}
                      className="w-full rounded-lg border-2 border-transparent bg-surface-container-low p-3 text-on-surface outline-none transition-all focus:border-primary focus:bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="budget"
                      className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant"
                    >
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        payments
                      </span>
                      Budget
                    </label>
                    <input
                      id="budget"
                      type="text"
                      required
                      placeholder="e.g. $2000"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="w-full rounded-lg border-2 border-transparent bg-surface-container-low p-3 text-on-surface outline-none transition-all focus:border-primary focus:bg-white"
                    />
                  </div>
                </div>

                {/* Travel vibe dropdown with sparkle icon label */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="vibe"
                    className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      auto_awesome
                    </span>
                    Travel Vibe
                  </label>
                  <select
                    id="vibe"
                    required
                    value={vibe}
                    onChange={(e) => setVibe(e.target.value)}
                    className="w-full appearance-none rounded-lg border-2 border-transparent bg-surface-container-low p-3 text-on-surface outline-none transition-all focus:border-primary focus:bg-white"
                  >
                    {VIBE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Orange CTA button — disabled while generating */}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-secondary-container py-4 text-lg font-semibold text-white shadow-lg transition-all hover:bg-secondary hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Generating..." : "Generate My Itinerary"}
                  {!loading && (
                    <span className="material-symbols-outlined">bolt</span>
                  )}
                </button>
              </form>

              {/* API error message */}
              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </p>
              )}

              <p className="text-center text-xs font-medium text-on-surface-variant">
                Our AI analyzes 10,000+ destinations in seconds.
              </p>
            </div>
          </div>
        </section>

        {/* Features bento grid — "Beyond Just a Schedule" */}
        <section className="mx-auto max-w-[1280px] px-5 py-24 md:px-12">
          <div className="mb-16 flex flex-col items-center text-center">
            <span className="mb-4 inline-block rounded-full bg-primary-fixed px-3 py-1 text-xs font-medium text-on-primary-fixed">
              SMART FEATURES
            </span>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-primary">
              Beyond Just a Schedule
            </h2>
            <p className="max-w-2xl text-lg text-on-surface-variant">
              We don&apos;t just list places; we curate experiences that match
              your rhythm.
            </p>
          </div>

          {/* Bento layout — 3 feature cards matching Stitch grid */}
          <div className="grid h-auto grid-cols-1 gap-6 md:h-[600px] md:grid-cols-12 md:grid-rows-2">
            {/* Wide card — Adaptive Timelines */}
            <div className="itinerary-card-shadow flex items-center justify-between rounded-xl border border-outline-variant/30 bg-white p-8 md:col-span-8 md:row-span-1">
              <div className="max-w-md">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                  <span className="material-symbols-outlined">schedule</span>
                </div>
                <h3 className="mb-2 text-2xl font-semibold">
                  Adaptive Timelines
                </h3>
                <p className="text-on-surface-variant">
                  Itineraries that adjust based on weather forecasts, opening
                  hours, and your energy levels.
                </p>
              </div>
              <div className="hidden h-48 w-48 overflow-hidden rounded-full bg-surface-container lg:block">
                <img
                  src="https://images.unsplash.com/photo-1501139086766-44e3ef9638c7?w=400&q=80"
                  alt="Smart scheduling"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {/* Tall card — Deep AI Personalization */}
            <div className="relative flex flex-col justify-end overflow-hidden rounded-xl bg-primary-container p-8 shadow-xl md:col-span-4 md:row-span-2">
              <div className="absolute top-0 right-0 p-8">
                <span className="material-symbols-outlined text-[64px] text-on-primary-container/20">
                  psychology_alt
                </span>
              </div>
              <div className="relative z-10">
                <h3 className="mb-4 text-2xl font-semibold text-white">
                  Deep AI Personalization
                </h3>
                <p className="mb-6 text-on-primary-container/80">
                  Our neural networks understand nuance—from &apos;hidden
                  gem&apos; cafes to &apos;quietest&apos; hiking trails.
                </p>
                <div className="flex gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                    Neural Engine 2.0
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                    Real-time Data
                  </span>
                </div>
              </div>
            </div>

            {/* Local Flavors card */}
            <div className="itinerary-card-shadow rounded-xl border border-outline-variant/30 bg-white p-8 md:col-span-4 md:row-span-1">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-fixed text-secondary">
                <span className="material-symbols-outlined">restaurant</span>
              </div>
              <h3 className="mb-2 text-2xl font-semibold">Local Flavors</h3>
              <p className="text-on-surface-variant">
                Discover authentic dining spots that locals keep to themselves.
              </p>
            </div>

            {/* Smart Navigation card */}
            <div className="itinerary-card-shadow rounded-xl border border-outline-variant/30 bg-white p-8 md:col-span-4 md:row-span-1">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-tertiary-fixed text-tertiary">
                <span className="material-symbols-outlined">explore</span>
              </div>
              <h3 className="mb-2 text-2xl font-semibold">Smart Navigation</h3>
              <p className="text-on-surface-variant">
                Optimized routes that minimize travel time and maximize
                discovery.
              </p>
            </div>
          </div>
        </section>

        {/* Mobile-only FAB for quick trip planning */}
        <button
          type="button"
          className="fixed bottom-8 right-8 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container text-white shadow-2xl transition-transform active:scale-90 md:hidden"
          aria-label="Plan new trip"
        >
          <span className="material-symbols-outlined text-[32px]">add</span>
        </button>
      </main>

      {/* Footer — brand, copyright, and legal links */}
      <footer className="flex w-full flex-col items-center justify-between gap-4 bg-surface-container px-5 py-12 md:flex-row md:px-12">
        <div className="flex flex-col items-center gap-4 md:items-start">
          <span className="text-sm font-semibold text-primary">WanderAI</span>
          <p className="text-xs text-on-surface-variant">
            © 2024 WanderAI. All rights reserved.
          </p>
        </div>
        <div className="flex gap-8">
          {["Privacy Policy", "Terms of Service", "Contact", "About Us"].map(
            (link) => (
              <a
                key={link}
                href="#"
                className="text-xs text-on-surface-variant transition-colors hover:text-secondary"
              >
                {link}
              </a>
            )
          )}
        </div>
      </footer>
    </div>
  );
}
