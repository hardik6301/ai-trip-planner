/**
 * JSDoc type definitions for trip planning data structures.
 * Provides shared documentation and IDE autocomplete for a JavaScript codebase
 * without requiring TypeScript migration.
 */

/**
 * @typedef {Object} TripInput
 * @property {string} destination - City or region the user wants to visit
 * @property {number} days - Number of days for the trip (1–14)
 * @property {string} budget - Budget as free text (e.g. "₹15000", "$500")
 * @property {string} vibe - Selected travel vibe from TRAVEL_VIBES
 */

/**
 * @typedef {Object} ActivitySlot
 * @property {string} activity - Name or description of the activity
 * @property {string} place - Location or venue for the activity
 * @property {string} [cost] - Estimated cost with currency symbol
 */

/**
 * @typedef {Object} DayItinerary
 * @property {number} day - Day number (1-based)
 * @property {string} theme - Theme or title for the day
 * @property {ActivitySlot} morning - Morning activity block
 * @property {ActivitySlot} afternoon - Afternoon activity block
 * @property {ActivitySlot} evening - Evening activity block
 * @property {string} [tips] - Local tip for the day
 */

/**
 * @typedef {Object} TripMeta
 * @property {number} days - Original form days value
 * @property {string} budget - Original form budget value
 * @property {string} vibe - Original form vibe value
 */

/**
 * @typedef {Object} TripData
 * @property {string} destination - Trip destination name
 * @property {DayItinerary[]} days - Day-by-day itinerary array
 * @property {string} totalBudgetEstimate - Overall budget estimate string
 * @property {string} bestTimeToVisit - Recommended season or months to visit
 * @property {string[]} packingEssentials - List of items to pack
 * @property {TripMeta} [tripMeta] - Original form values attached after generation
 */

export {};
