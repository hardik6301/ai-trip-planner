"use client";

/**
 * /generating — runs the Gemini API call and shows the Stitch loading UI
 * while the itinerary is being crafted.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TripGeneratingView from "@/components/trips/TripGeneratingView";
import {
  PENDING_TRIP_REQUEST_KEY,
  TRIP_GENERATION_ERROR_KEY,
  TRIP_STORAGE_KEY,
} from "@/constants/tripOptions";

/** Read pending destination synchronously so the skeleton shows the city name immediately */
function readPendingDestination() {
  if (typeof window === "undefined") return "";
  try {
    const raw = sessionStorage.getItem(PENDING_TRIP_REQUEST_KEY);
    if (raw) return JSON.parse(raw).destination || "";
  } catch {
    /* ignore malformed sessionStorage */
  }
  return "";
}

export default function GeneratingPage() {
  const router = useRouter();
  const started = useRef(false);

  const [destination, setDestination] = useState(readPendingDestination);
  const [error, setError] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function generate() {
      const raw = sessionStorage.getItem(PENDING_TRIP_REQUEST_KEY);

      if (!raw) {
        router.replace("/");
        return;
      }

      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        router.replace("/");
        return;
      }

      sessionStorage.removeItem(PENDING_TRIP_REQUEST_KEY);
      setDestination(payload.destination || "");

      try {
        const response = await fetch("/api/generate-trip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.details || "Something went wrong");
        }

        const storedTrip = {
          ...data,
          tripMeta: {
            days: payload.days,
            budget: payload.budget,
            vibe: payload.vibe,
            travelMonth: payload.travelMonth,
          },
        };

        sessionStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(storedTrip));

        // Brief finish animation before redirect
        setIsComplete(true);
        await new Promise((r) => setTimeout(r, 700));
        router.push("/results");
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to generate itinerary. Please try again.";
        sessionStorage.setItem(TRIP_GENERATION_ERROR_KEY, message);
        setError(message);
      }
    }

    generate();
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-72px)] flex-col items-center justify-center bg-[#f8f9ff] px-6 text-center">
        <p className="mb-2 text-lg font-semibold text-[#001356]">
          Couldn&apos;t craft your trip
        </p>
        <p className="mb-8 max-w-md text-sm text-[#454650]">{error}</p>
        <Link
          href="/"
          className="rounded-lg bg-[#fd761a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#ea580c]"
        >
          Back to planner
        </Link>
      </div>
    );
  }

  return <TripGeneratingView destination={destination} isComplete={isComplete} />;
}
