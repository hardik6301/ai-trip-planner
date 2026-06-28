/**
 * Simple loading spinner for async states (e.g. hydrating trip data on results page).
 * Uses the brand primary color to stay consistent with the Travora design system.
 */

export default function LoadingSpinner({ className = "" }) {
  return (
    <div
      className={`h-8 w-8 animate-spin rounded-full border-4 border-primary-fixed border-t-primary ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
