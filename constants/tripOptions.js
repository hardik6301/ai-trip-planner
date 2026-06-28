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

/** sessionStorage key used to pass generated trip data to the results page */
export const TRIP_STORAGE_KEY = "wanderaiTrip";
