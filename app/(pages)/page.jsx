"use client";

/**
 * Travora home page — hero, trip planning form, and feature bento grid.
 * Form logic lives in useTrip; UI sections use shared layout and form components.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTrip } from "@/hooks/useTrip";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import TripForm from "@/components/forms/TripForm";
import { parseAuthErrorFromHash } from "@/utils/parseAuthError";

// Unsplash mountain hero background from the Stitch cinematic reference
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80";

export default function Home() {
  const router = useRouter();

  // Redirect OAuth failures (hash errors from Supabase) to login with a readable message
  useEffect(() => {
    const authError = parseAuthErrorFromHash(window.location.hash);
    if (authError) {
      router.replace(
        `/auth/login?error=${encodeURIComponent(authError)}`
      );
    }
  }, [router]);

  const {
    destination,
    setDestination,
    days,
    setDays,
    budget,
    setBudget,
    vibe,
    setVibe,
    loading,
    error,
    generateTrip,
  } = useTrip();

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans">
      <Navbar variant="home" />

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

            {/* Right column — trip planning form */}
            <TripForm
              destination={destination}
              setDestination={setDestination}
              days={days}
              setDays={setDays}
              budget={budget}
              setBudget={setBudget}
              vibe={vibe}
              setVibe={setVibe}
              loading={loading}
              error={error}
              onSubmit={generateTrip}
            />
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

      <Footer />
    </div>
  );
}
