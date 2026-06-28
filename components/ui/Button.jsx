/**
 * Reusable orange CTA button matching the Travora Stitch design.
 * Used for primary actions like "Generate My Itinerary" in the trip form.
 */

export default function Button({
  children,
  type = "button",
  disabled = false,
  loading = false,
  icon = null,
  className = "",
  onClick,
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-secondary-container py-4 text-lg font-semibold text-white shadow-lg transition-all hover:bg-secondary hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
      {!loading && icon}
    </button>
  );
}
