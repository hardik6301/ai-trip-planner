/**
 * Pure helper functions for formatting trip-related display strings.
 * Keeps presentation logic out of components and hooks for easier testing and reuse.
 */

/**
 * Capitalizes each word in a destination string for display headings.
 * @param {string} str - Raw destination input
 * @returns {string} Title-cased destination
 */
export function capitalizeDestination(str) {
  if (!str) return "";
  return str
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Normalizes a budget string by trimming whitespace.
 * @param {string} str - Raw budget input or estimate
 * @returns {string} Trimmed budget string
 */
export function formatBudget(str) {
  if (!str) return "";
  return str.trim();
}

/**
 * Returns a human-readable day label for a zero-based index.
 * @param {number} index - Zero-based day index
 * @returns {string} Label like "Day 1"
 */
export function getDayLabel(index) {
  return `Day ${index + 1}`;
}
