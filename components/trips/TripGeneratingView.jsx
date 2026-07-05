"use client";

/**
 * Stitch "Crafting your perfect trip" loading screen.
 * Shimmer skeleton bento grid shown while Gemini generates the itinerary.
 */

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const STATUS_STAGES = [
  { max: 22, label: "Optimizing Itinerary" },
  { max: 48, label: "Finding local gems" },
  { max: 72, label: "Checking flight prices" },
  { max: 100, label: "Curating activities" },
];

function getStatusLabel(progress) {
  for (const stage of STATUS_STAGES) {
    if (progress < stage.max) return stage.label;
  }
  return STATUS_STAGES[STATUS_STAGES.length - 1].label;
}

/**
 * Realistic loading curve — fast start, steady middle, crawls near 92%.
 * Elapsed time in seconds → target percentage.
 */
function targetProgress(elapsedSec) {
  if (elapsedSec < 2) return 4 + elapsedSec * 4;
  if (elapsedSec < 6) return 12 + (elapsedSec - 2) * 3.5;
  if (elapsedSec < 14) return 26 + (elapsedSec - 6) * 2.8;
  if (elapsedSec < 28) return 48 + (elapsedSec - 14) * 1.6;
  if (elapsedSec < 45) return 70 + (elapsedSec - 28) * 0.9;
  return Math.min(92, 85 + (elapsedSec - 45) * 0.15);
}

/** Reusable shimmer placeholder block with optional staggered entrance */
function Shimmer({ className = "", style }) {
  return (
    <div
      className={`shimmer-wrapper ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export default function TripGeneratingView({
  destination = "",
  isComplete = false,
}) {
  const [progress, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  // Single source of truth for bar width + percentage label
  useEffect(() => {
    if (isComplete) {
      setProgress(100);
      return;
    }

    const start = Date.now();

    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const target = targetProgress(elapsed);

      setProgress((prev) => {
        const jitter = Math.random() * 0.6;
        const next = Math.max(prev, Math.min(92, target + jitter));
        return next;
      });
    }, 350);

    return () => clearInterval(id);
  }, [isComplete]);

  // Smooth the displayed number so it ticks up naturally (never jumps ahead of bar)
  useEffect(() => {
    const id = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev >= progress) return progress;
        const step = Math.max(1, Math.ceil((progress - prev) * 0.35));
        return Math.min(progress, prev + step);
      });
    }, 120);
    return () => clearInterval(id);
  }, [progress]);

  // Subtle mouse-follow warm gradient on page background
  useEffect(() => {
    function onMove(e) {
      document.documentElement.style.setProperty(
        "--gen-glow-x",
        `${e.clientX}px`
      );
      document.documentElement.style.setProperty(
        "--gen-glow-y",
        `${e.clientY}px`
      );
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const barWidth = isComplete ? 100 : Math.min(progress, 92);
  const statusLabel = isComplete
    ? "Trip ready!"
    : getStatusLabel(displayProgress);

  const subtitle = destination
    ? `Our AI is analyzing thousands of routes, local gems, and prices for ${destination}.`
    : "Our AI is analyzing thousands of routes, local gems, and flight prices for your dream vacation.";

  const stagger = (ms) => ({ animationDelay: `${ms}ms` });

  return (
    <div
      className="generating-page-bg relative min-h-[calc(100vh-72px)] pb-32"
      style={{
        backgroundImage:
          "radial-gradient(circle at var(--gen-glow-x, 50%) var(--gen-glow-y, 30%), rgba(253, 118, 26, 0.04) 0%, #f8f9ff 42%)",
      }}
      aria-busy={!isComplete}
      aria-live="polite"
    >
      <div className="mx-auto max-w-[1280px] px-6 pb-10 pt-8">
        {/* ─── Hero loading header ─── */}
        <div className="generating-fade-in mx-auto mb-10 max-w-2xl text-center">
          {destination && (
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#FFF7ED] px-4 py-1.5 text-sm font-semibold text-[#9d4300]">
              <Sparkles className="h-4 w-4 text-[#fd761a]" />
              {destination}
            </p>
          )}
          <h1
            className="mb-4 text-[32px] font-semibold tracking-tight text-[#001356] md:text-[36px]"
            style={{
              fontFamily:
                "var(--font-plus-jakarta, 'Plus Jakarta Sans'), sans-serif",
            }}
          >
            Crafting your perfect trip...
          </h1>
          <p className="stitch-pulse-text mb-6 text-base text-[#454650]">
            {subtitle}
          </p>

          {/* Progress bar — width driven only by progress state */}
          <div className="mb-1 h-2 overflow-hidden rounded-full bg-[#dce9ff]">
            <div
              className="h-full rounded-full bg-[#fd761a] shadow-[0_0_8px_rgba(253,118,26,0.45)] transition-[width] duration-500 ease-out"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-[#767681]">{statusLabel}</span>
            <span className="text-[#9d4300]">{Math.floor(displayProgress)}%</span>
          </div>
        </div>

        {/* ─── Bento grid skeleton ─── */}
        <div
          className="generating-fade-in mb-10 grid grid-cols-1 gap-6 md:grid-cols-12"
          style={stagger(80)}
        >
          {/* Main featured card */}
          <div className="overflow-hidden rounded-xl border border-[#0b1c30]/5 bg-white p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] md:col-span-8">
            <Shimmer className="mb-4 h-64 w-full rounded-lg" />
            <Shimmer className="mb-2 h-8 w-3/4 rounded-md" />
            <Shimmer className="h-4 w-1/2 rounded-md" />
            <div className="mt-4 flex gap-4">
              <Shimmer className="h-10 w-24 rounded-full" />
              <Shimmer className="h-10 w-24 rounded-full" />
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-6 md:col-span-4">
            <div className="rounded-xl border border-[#0b1c30]/5 bg-white p-6 shadow-sm">
              <Shimmer className="mb-6 h-6 w-1/3 rounded-md" />
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Shimmer className="h-10 w-10 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Shimmer className="h-4 w-full rounded-md" />
                      <Shimmer className="h-3 w-2/3 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Shimmer className="h-48 w-full rounded-xl opacity-50" />
          </div>
        </div>

        {/* ─── Day header skeleton ─── */}
        <div
          className="generating-fade-in mb-6 flex items-center gap-4"
          style={stagger(160)}
        >
          <Shimmer className="h-10 w-32 rounded-full border-2 border-[#001356]/10" />
          <div className="h-px flex-1 bg-[#c6c5d2]/30" />
          <Shimmer className="h-8 w-8 rounded-full" />
        </div>

        {/* ─── Activity slot skeletons — Day 1 ─── */}
        <div
          className="generating-fade-in mb-10 grid grid-cols-1 gap-4 md:grid-cols-3"
          style={stagger(240)}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col rounded-xl border border-[#0b1c30]/5 bg-white p-4 shadow-sm"
              style={stagger(280 + i * 60)}
            >
              <Shimmer className="mb-4 h-40 w-full rounded-lg" />
              <Shimmer className="mb-2 h-5 w-3/4 rounded-md" />
              <Shimmer className="mb-4 h-3 w-1/4 rounded-md" />
              <div className="mt-auto flex items-center justify-between">
                <Shimmer className="h-8 w-20 rounded-md" />
                <Shimmer className="h-6 w-6 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        {/* ─── Activity slot skeletons — Day 2 (scroll hint) ─── */}
        <div
          className="generating-fade-in mb-6 flex items-center gap-4 opacity-60"
          style={stagger(420)}
        >
          <Shimmer className="h-10 w-32 rounded-full border-2 border-[#001356]/10" />
          <div className="h-px flex-1 bg-[#c6c5d2]/30" />
        </div>
        <div
          className="generating-fade-in grid grid-cols-1 gap-4 opacity-60 md:grid-cols-3"
          style={stagger(480)}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={`d2-${i}`}
              className="flex flex-col rounded-xl border border-[#0b1c30]/5 bg-white p-4 shadow-sm"
            >
              <Shimmer className="mb-4 h-32 w-full rounded-lg" />
              <Shimmer className="mb-2 h-5 w-2/3 rounded-md" />
              <Shimmer className="h-3 w-1/3 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* ─── Floating AI interaction pill ─── */}
      <div className="pointer-events-none fixed bottom-8 left-1/2 z-40 w-full max-w-xl -translate-x-1/2 px-4 md:bottom-10">
        <div className="flex items-center gap-4 rounded-full border border-[#001356]/10 bg-white/80 p-2 shadow-2xl backdrop-blur-xl">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#001356]">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <Shimmer className="mb-1 h-4 w-1/2 rounded-md opacity-40" />
          </div>
          <Shimmer className="h-10 w-10 shrink-0 rounded-full opacity-50" />
        </div>
      </div>
    </div>
  );
}
