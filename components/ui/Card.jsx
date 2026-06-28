/**
 * Travora Card — base container with Stitch elevation, border, and rounded corners.
 * Used as the foundation for itinerary cards, forms, and dashboard panels.
 */

/**
 * @param {object} props
 * @param {React.ReactNode} props.children - Card content
 * @param {boolean} [props.hover=false] - Enables lift shadow on hover
 * @param {boolean} [props.padding=true] - Applies default inner padding (p-6)
 * @param {string} [props.className=""] - Additional Tailwind classes
 */
export default function Card({
  children,
  hover = false,
  padding = true,
  className = "",
}) {
  return (
    <div
      className={`rounded-xl border border-outline-variant/30 bg-white ${padding ? "p-6" : ""} ${hover ? "itinerary-card-shadow itinerary-card-hover cursor-pointer" : "itinerary-card-shadow"} ${className}`}
    >
      {children}
    </div>
  );
}
