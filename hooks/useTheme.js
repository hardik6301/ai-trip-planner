"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "travoraTheme";

/** Apply theme class to <html> and persist choice */
function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_KEY, theme);
}

/**
 * Light/dark theme state synced with localStorage and the <html> class.
 * Initial class is set by the inline script in app/layout.tsx (no flash).
 */
export function useTheme() {
  const [theme, setTheme] = useState("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Midnight (dark) is the default theme unless the user picked light
    const stored = localStorage.getItem(THEME_KEY);
    setTheme(stored === "light" ? "light" : "dark");
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }

  return { theme, toggleTheme, mounted };
}
