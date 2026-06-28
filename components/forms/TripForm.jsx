"use client";

/**
 * Trip planning form with destination, days, budget, and vibe fields.
 * Extracted from the home page so the page component stays focused on layout.
 */

import Button from "@/components/ui/Button";
import { TRAVEL_VIBES, MIN_DAYS, MAX_DAYS } from "@/constants/tripOptions";

export default function TripForm({
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
  onSubmit,
}) {
  return (
    <div className="flex w-full max-w-md flex-col gap-6 rounded-xl border border-outline-variant/30 bg-white p-8 shadow-2xl">
      <form onSubmit={onSubmit} className="space-y-4">
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
              min={MIN_DAYS}
              max={MAX_DAYS}
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
            {TRAVEL_VIBES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Orange CTA button — disabled while generating */}
        <Button
          type="submit"
          disabled={loading}
          loading={loading}
          icon={<span className="material-symbols-outlined">bolt</span>}
        >
          {loading ? "Generating..." : "Generate My Itinerary"}
        </Button>
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
  );
}
