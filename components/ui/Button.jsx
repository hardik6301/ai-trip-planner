/**
 * Travora Button — reusable CTA with primary, secondary, ghost, and danger variants.
 * Supports loading state with inline spinner; matches Stitch navy/orange design.
 */

import LoadingSpinner from "@/components/ui/LoadingSpinner";

/** Tailwind classes for each button variant */
const VARIANTS = {
  primary:
    "bg-orange text-white shadow-md shadow-orange/20 hover:bg-orange/90 active:scale-[0.98]",
  secondary:
    "border-2 border-navy bg-transparent text-navy hover:bg-navy-light active:scale-[0.98]",
  ghost:
    "bg-transparent text-navy hover:bg-navy-light active:scale-[0.98]",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]",
};

/** Size presets for padding and font scale */
const SIZES = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
  xl: "px-6 py-4 text-lg",
};

/**
 * @param {object} props
 * @param {React.ReactNode} props.children - Button label or content
 * @param {"primary"|"secondary"|"ghost"|"danger"} [props.variant="primary"] - Visual style variant
 * @param {"sm"|"md"|"lg"|"xl"} [props.size="lg"] - Padding and text size
 * @param {"button"|"submit"|"reset"} [props.type="button"] - Native button type
 * @param {boolean} [props.disabled=false] - Disables interaction
 * @param {boolean} [props.loading=false] - Shows spinner and disables button
 * @param {boolean} [props.fullWidth=false] - Stretches to full container width
 * @param {React.ReactNode} [props.icon=null] - Optional trailing icon (hidden while loading)
 * @param {string} [props.className=""] - Additional Tailwind classes
 * @param {() => void} [props.onClick] - Click handler
 */
export default function Button({
  children,
  variant = "primary",
  size = "lg",
  type = "button",
  disabled = false,
  loading = false,
  fullWidth = false,
  icon = null,
  className = "",
  onClick,
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {loading && (
        <LoadingSpinner
          className={`h-4 w-4 border-2 ${variant === "primary" || variant === "danger" ? "border-white/30 border-t-white" : "border-navy-light border-t-navy"}`}
        />
      )}
      {children}
      {!loading && icon}
    </button>
  );
}
