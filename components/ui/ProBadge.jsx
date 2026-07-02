/**
 * Small orange PRO badge for navbar and Pro-gated UI panels.
 */
export default function ProBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-[#F97316] px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase ${className}`}
    >
      Pro
    </span>
  );
}
