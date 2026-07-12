/**
 * Debounce a value — only updates after the user stops changing it for `delay` ms.
 * Use with useEffect to avoid firing API calls on every keystroke.
 *
 * @example
 * const debouncedQuery = useDebounce(searchQuery, 300)
 * useEffect(() => {
 *   if (debouncedQuery.length >= 2) fetchSuggestions(debouncedQuery)
 * }, [debouncedQuery])
 */
import { useEffect, useState } from "react";

export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
