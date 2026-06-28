/**
 * Travora LoadingSpinner — animated circular spinner for loading states.
 * Used inside buttons, pages, and async data fetches across the app.
 */

/**
 * @param {object} props
 * @param {string} [props.className=""] - Size and color overrides (Tailwind classes)
 */
export default function LoadingSpinner({ className = "" }) {
  return (
    <div
      className={`h-8 w-8 animate-spin rounded-full border-4 border-navy-light border-t-navy ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
