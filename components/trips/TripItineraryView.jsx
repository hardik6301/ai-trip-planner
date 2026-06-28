"use client";

/**
 * Shared trip itinerary layout used on the results page and public trip view.
 * Renders hero, jump-to sidebar, packing chips, and day-by-day activity cards.
 */

import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { capitalizeDestination } from "@/utils/formatTrip";

// Unsplash images rotated per activity slot for visual variety
const ACTIVITY_IMAGES = [
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&q=80",
  "https://images.unsplash.com/photo-1476514867437-421993506ec7?w=600&q=80",
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600&q=80",
  "https://images.unsplash.com/photo-1528127269322-539fb6033eab?w=600&q=80",
  "https://images.unsplash.com/photo-1539037116277-4db208989f2e?w=600&q=80",
  "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600&q=80",
  "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80",
  "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80",
];

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=80";

const PERIODS = [
  { key: "morning", label: "Morning", icon: "wb_sunny" },
  { key: "afternoon", label: "Afternoon", icon: "light_mode" },
  { key: "evening", label: "Evening", icon: "dark_mode" },
];

export default function TripItineraryView({
  tripData,
  saveButton = null,
  footerExtra = null,
  heroBadge = "AI Generated Itinerary",
}) {
  const { tripMeta } = tripData;
  const destination = capitalizeDestination(tripData.destination);

  // Smooth-scroll to a day section when a Jump To link is clicked
  function scrollToDay(dayNumber) {
    document.getElementById(`day-${dayNumber}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function getActivityImage(dayIndex, periodIndex) {
    return ACTIVITY_IMAGES[(dayIndex * 3 + periodIndex) % ACTIVITY_IMAGES.length];
  }

  return (
    <>
      {/* Destination hero — full-width image with gradient overlay */}
      <section className="relative h-[420px] w-full overflow-hidden md:h-[480px]">
        <img
          src={DEFAULT_HERO}
          alt={destination}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/40 to-transparent" />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-[1280px] px-5 pb-10 md:px-12">
            <span className="mb-3 inline-block rounded-full bg-secondary-container/90 px-3 py-1 text-xs font-semibold text-white">
              {heroBadge}
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
              {destination}
            </h1>
            <div className="mt-4 flex flex-wrap gap-4 text-white/90">
              {tripMeta?.days && (
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="material-symbols-outlined text-[18px]">
                    calendar_month
                  </span>
                  {tripMeta.days} days
                </span>
              )}
              {tripMeta?.vibe && (
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="material-symbols-outlined text-[18px]">
                    auto_awesome
                  </span>
                  {tripMeta.vibe}
                </span>
              )}
              {tripData.totalBudgetEstimate && (
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="material-symbols-outlined text-[18px]">
                    payments
                  </span>
                  Est. {tripData.totalBudgetEstimate}
                </span>
              )}
            </div>
            {tripData.bestTimeToVisit && (
              <p className="mt-3 text-sm text-white/75">
                Best time to visit: {tripData.bestTimeToVisit}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Main content — sidebar Jump To + day cards */}
      <section className="mx-auto max-w-[1280px] px-5 py-12 md:px-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
          {/* Sticky Jump To sidebar */}
          <aside className="lg:w-56 lg:shrink-0">
            <div className="itinerary-card-shadow sticky top-24 rounded-xl border border-outline-variant/30 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">
                Jump To
              </h2>
              <nav className="flex flex-row flex-wrap gap-2 lg:flex-col lg:gap-1">
                {tripData.days?.map((day) => (
                  <button
                    key={day.day}
                    type="button"
                    onClick={() => scrollToDay(day.day)}
                    className="rounded-lg px-3 py-2 text-left text-sm font-medium text-on-surface-variant transition-colors hover:bg-primary-fixed hover:text-primary"
                  >
                    Day {day.day}
                    <span className="ml-1 hidden text-xs text-on-surface-variant/70 lg:inline">
                      — {day.theme}
                    </span>
                  </button>
                ))}
              </nav>
              {saveButton}
            </div>
          </aside>

          {/* Itinerary column */}
          <div className="min-w-0 flex-1 space-y-10">
            {tripData.packingEssentials?.length > 0 && (
              <div className="itinerary-card-shadow rounded-xl border border-outline-variant/30 bg-white p-6 md:p-8">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-primary">
                  <span className="material-symbols-outlined">luggage</span>
                  Packing Essentials
                </h2>
                <div className="flex flex-wrap gap-2">
                  {tripData.packingEssentials.map((item) => (
                    <Badge key={item}>{item}</Badge>
                  ))}
                </div>
              </div>
            )}

            {tripData.days?.map((day, dayIndex) => (
              <article
                key={day.day}
                id={`day-${day.day}`}
                className="itinerary-card-shadow itinerary-card-hover scroll-mt-24 rounded-xl border border-outline-variant/30 bg-white p-6 md:p-8"
              >
                <div className="mb-6 flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white">
                    {day.day}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                      Day {day.day}
                    </p>
                    <h3 className="text-2xl font-semibold text-primary">
                      {day.theme}
                    </h3>
                  </div>
                </div>

                <div className="space-y-6 border-l-2 border-primary-fixed pl-6 md:pl-8">
                  {PERIODS.map((period, periodIndex) => {
                    const slot = day[period.key];
                    if (!slot) return null;

                    return (
                      <div key={period.key} className="relative">
                        <div className="absolute -left-[calc(1.5rem+5px)] top-4 h-2.5 w-2.5 rounded-full bg-secondary-container md:-left-[calc(2rem+5px)]" />
                        <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-surface-container-low sm:flex-row">
                          <div className="h-40 shrink-0 overflow-hidden sm:h-auto sm:w-44 md:w-52">
                            <img
                              src={getActivityImage(dayIndex, periodIndex)}
                              alt={slot.place}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="flex flex-1 flex-col justify-center p-4 sm:p-5">
                            <div className="mb-2 flex items-center gap-2">
                              <span className="material-symbols-outlined text-[18px] text-secondary">
                                {period.icon}
                              </span>
                              <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                                {period.label}
                              </span>
                            </div>
                            <h4 className="text-lg font-semibold text-on-surface">
                              {slot.activity}
                            </h4>
                            <p className="mt-1 flex items-center gap-1 text-sm text-on-surface-variant">
                              <span className="material-symbols-outlined text-[16px]">
                                location_on
                              </span>
                              {slot.place}
                            </p>
                            {slot.cost && (
                              <p className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-primary-fixed px-3 py-1 text-xs font-semibold text-primary">
                                <span className="material-symbols-outlined text-[14px]">
                                  payments
                                </span>
                                {slot.cost}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {day.tips && (
                  <div className="mt-6 flex items-start gap-3 rounded-lg bg-primary-fixed/50 p-4">
                    <span className="material-symbols-outlined shrink-0 text-primary">
                      tips_and_updates
                    </span>
                    <p className="text-sm text-on-surface-variant">
                      <span className="font-semibold text-primary">Tip: </span>
                      {day.tips}
                    </p>
                  </div>
                )}
              </article>
            ))}

            {footerExtra}
          </div>
        </div>
      </section>
    </>
  );
}
