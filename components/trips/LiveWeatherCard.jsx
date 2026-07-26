"use client";

/**
 * Live weather card — Open-Meteo current conditions + today's range.
 */

import { CloudSun } from "lucide-react";

export default function LiveWeatherCard({ weather, loading }) {
  const title = loading
    ? "…"
    : weather
      ? `${weather.tempC}°C`
      : "—";

  const bits = [];
  if (weather?.description) bits.push(weather.description);
  if (weather?.feelsLikeC != null) bits.push(`Feels ${weather.feelsLikeC}°`);
  if (weather?.highC != null && weather?.lowC != null) {
    bits.push(`H ${weather.highC}° / L ${weather.lowC}°`);
  }

  const subtitle = loading
    ? "Loading…"
    : bits.length
      ? bits.join(" · ")
      : "Unavailable";

  const meta = [];
  if (weather?.humidity != null) meta.push(`${weather.humidity}% humidity`);
  if (weather?.windKmh != null) meta.push(`${weather.windKmh} km/h wind`);
  if (weather?.place) meta.push(weather.place);

  return (
    <div className="rounded-xl border border-[#E2E8F0]/50 bg-white px-3 py-3 shadow-soft transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(15,23,42,0.08)] sm:px-4 sm:py-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
          <CloudSun className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="text-xs font-semibold text-[#1E3A8A]">Weather</span>
        {!loading && weather?.live && (
          <span className="ml-auto rounded-md bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-sky-700 uppercase">
            Live
          </span>
        )}
      </div>

      <p
        className={`mt-2 text-sm font-bold leading-tight text-[#0F172A] ${
          loading ? "animate-pulse text-[#94A3B8]" : ""
        }`}
      >
        {title}
      </p>
      <p
        className={`mt-1 text-xs leading-snug text-[#64748B] ${
          loading ? "animate-pulse" : ""
        }`}
      >
        {subtitle}
      </p>
      {!loading && meta.length > 0 && (
        <p className="mt-2 text-[10px] leading-snug text-[#94A3B8]">
          {meta.join(" · ")}
        </p>
      )}
    </div>
  );
}
