"use client";

/**
 * Lazy-loaded Google Maps embed for a single activity card.
 * The iframe loads only when the card scrolls into view (saves bandwidth on long trips).
 */

import { useEffect, useRef, useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import {
  getGoogleMapsEmbedUrl,
  getGoogleMapsLink,
} from "@/utils/googleMaps";

export default function ActivityMapEmbed({ place, destination }) {
  const containerRef = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  const embedUrl = getGoogleMapsEmbedUrl(place, destination);
  const mapsLink = getGoogleMapsLink(place, destination);

  // Start loading the iframe when the card is near the viewport
  useEffect(() => {
    const node = containerRef.current;
    if (!node || !embedUrl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "180px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [embedUrl]);

  if (!embedUrl || !mapsLink) return null;

  return (
    <div ref={containerRef} className="mt-4 overflow-hidden rounded-xl border border-[#E2E8F0]">
      <div className="relative h-[140px] w-full bg-[#F8FAFC] sm:h-[160px]">
        {shouldLoad ? (
          <iframe
            title={`Map: ${place}`}
            src={embedUrl}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-[#94A3B8]">
            <MapPin className="h-5 w-5" />
            <span className="text-xs">Map loading…</span>
          </div>
        )}
      </div>

      <a
        href={mapsLink}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 border-t border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#1E3A8A] transition-colors hover:bg-[#F8FAFC]"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open in Google Maps
      </a>
    </div>
  );
}
