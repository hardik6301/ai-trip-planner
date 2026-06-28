/**
 * Travora Badge — small chip/tag for labels like vibe, days, and traveler type.
 * Tonal backgrounds with high-contrast text per Stitch chip guidelines.
 */

/** Variant styles: low-saturation background + saturated label text */
const VARIANTS = {
  orange: "bg-orange-light text-orange",
  navy: "bg-navy-light text-navy",
  gray: "bg-surface-container text-on-surface-variant",
  green: "bg-emerald-50 text-emerald-700",
};

/**
 * @param {object} props
 * @param {React.ReactNode} props.children - Badge label text
 * @param {"orange"|"navy"|"gray"|"green"} [props.variant="orange"] - Color variant
 * @param {string} [props.className=""] - Additional Tailwind classes
 */
export default function Badge({
  children,
  variant = "orange",
  className = "",
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
