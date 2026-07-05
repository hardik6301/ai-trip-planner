/**
 * Centralized trip planning constants used across forms, hooks, and validation.
 * Keeps hardcoded values in one place so limits and options stay consistent app-wide.
 */

/** Travel vibe options shown in the trip planning form dropdown */
export const TRAVEL_VIBES = [
  "Adventure",
  "Relaxation",
  "Cultural",
  "Romantic",
  "Family",
  "Budget Backpacking",
];

/** Minimum allowed trip length in days */
export const MIN_DAYS = 1;

/** Maximum allowed trip length in days */
export const MAX_DAYS = 14;

/** Default number of days pre-filled in the trip form */
export const DEFAULT_DAYS = 7;

/** sessionStorage key for generated trip data on /results */
export const TRIP_STORAGE_KEY = "travoraTrip";

/** Pending API payload while the generating page runs the Gemini request */
export const PENDING_TRIP_REQUEST_KEY = "travoraPendingTripRequest";

/** Error message passed back to home if generation fails on /generating */
export const TRIP_GENERATION_ERROR_KEY = "travoraTripGenerationError";

/** Free tier: max day regenerations allowed per trip */
export const FREE_REGENERATIONS_PER_TRIP = 3;

/** Free tier: max saved trips per account */
export const FREE_TRIP_LIMIT = 5;
