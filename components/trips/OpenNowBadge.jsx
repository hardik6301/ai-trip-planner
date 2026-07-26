"use client";

/**
 * Shows "Open now" / "Closed now" when Geoapify has opening hours.
 * Renders nothing when status is unknown (no data source).
 */

import { useEffect, useState } from "react";

const cache = new Map();

export default function OpenNowBadge({
  place,
  destination,
  timezone = "UTC",
}) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!place) {
      setInfo(null);
      return;
    }

    const key = `${place}|${destination}|${timezone}`;
    if (cache.has(key)) {
      setInfo(cache.get(key));
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams({
      place,
      destination: destination || "",
      timezone: timezone || "UTC",
    });

    fetch(`/api/place-open-status?${params}`)
      .then((r) => (r.ok ? r.json() : { status: "unknown" }))
      .then((data) => {
        if (cancelled) return;
        cache.set(key, data);
        setInfo(data);
      })
      .catch(() => {
        if (!cancelled) setInfo({ status: "unknown" });
      });

    return () => {
      cancelled = true;
    };
  }, [place, destination, timezone]);

  if (!info || info.status === "unknown") return null;

  const open = info.status === "open";

  return (
    <span
      title={info.hours || info.label}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
        open
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          open ? "bg-emerald-500" : "bg-rose-500"
        }`}
        aria-hidden="true"
      />
      {info.label || (open ? "Open now" : "Closed now")}
    </span>
  );
}
