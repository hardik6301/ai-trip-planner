/**
 * Instant skeleton while Next.js loads /generating — avoids a blank freeze
 * between home submit and the generating page hydrating.
 */

import TripGeneratingView from "@/components/trips/TripGeneratingView";

export default function GeneratingLoading() {
  return <TripGeneratingView destination="" isComplete={false} />;
}
