/**
 * Orange tonal chip used for packing essentials and similar tag-style labels.
 * Matches the Stitch "packing chips" design on the results page.
 */

export default function Badge({ children }) {
  return (
    <span className="rounded-full bg-secondary-container/10 px-4 py-1.5 text-sm font-medium text-secondary">
      {children}
    </span>
  );
}
