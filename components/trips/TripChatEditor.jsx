"use client";

/**
 * AI Chat Editor — floating chat on trip pages (Pro).
 * Supports controlled open so the sidebar "AI Assistant" card can launch it.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Bot,
  Loader2,
  Lock,
  MessageCircle,
  RefreshCw,
  Replace,
  SendHorizonal,
  User,
  X,
} from "lucide-react";
import ProBadge from "@/components/ui/ProBadge";

const WELCOME_MESSAGE = {
  role: "ai",
  content:
    "Hi! I can edit your itinerary in place. Use the chips below to Swap an activity, Reorder a day, or Regenerate around a budget/time/weather constraint — or just type freely.",
};

/** Guided edit-type chips — fill the input so users can tweak day numbers */
const EDIT_CHIPS = [
  {
    id: "swap",
    label: "Swap activity",
    Icon: Replace,
    prompt:
      "Swap the afternoon activity on Day 1 for a different option with a similar duration and update its cost.",
  },
  {
    id: "reorder",
    label: "Reorder day",
    Icon: ArrowUpDown,
    prompt:
      "Reorder Day 1 so outdoor / walking activities are in the cooler morning and indoor or food stops are later. Keep the same places if possible.",
  },
  {
    id: "constraint",
    label: "Regenerate around…",
    Icon: RefreshCw,
    prompt:
      "Regenerate Day 2 around a budget constraint — lower the day's total spend while keeping the theme, and update activity costs.",
  },
];

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function diffChangedDays(oldDays = [], newDays = []) {
  const oldByDay = new Map(oldDays.map((d) => [d.day, stableStringify(d)]));
  return newDays
    .filter((d) => oldByDay.get(d.day) !== stableStringify(d))
    .map((d) => d.day);
}

function formatDayList(dayNumbers) {
  const labels = dayNumbers.map((n) => `Day ${n}`);
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export default function TripChatEditor({
  tripData,
  destination,
  isPro,
  onTripDataChange,
  onDaysUpdated = null,
  tripId = null,
  itineraryVersion = null,
  onVersionUpdate = null,
  onVersionConflict = null,
  open: openProp,
  onOpenChange = null,
  draftPrompt = null,
  onDraftPromptConsumed = null,
}) {
  const isControlled = typeof openProp === "boolean";
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isControlled ? openProp : uncontrolledOpen;

  function setOpen(next) {
    const value = typeof next === "function" ? next(open) : next;
    if (!isControlled) setUncontrolledOpen(value);
    onOpenChange?.(value);
  }

  const [chatMessages, setChatMessages] = useState([WELCOME_MESSAGE]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      // Focus input when opened from sidebar
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [chatMessages, isChatLoading, open]);

  // Prefill from sidebar checklist / parent
  useEffect(() => {
    if (!open || !draftPrompt) return;
    setChatInput(draftPrompt);
    onDraftPromptConsumed?.();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, draftPrompt, onDraftPromptConsumed]);

  async function sendChatMessage(text) {
    const message = (text ?? chatInput).trim();
    if (!message || isChatLoading || !isPro) return;

    setChatMessages((prev) => [...prev, { role: "user", content: message }]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/chat-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          currentItinerary: tripData,
          destination,
          tripId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || "Something went wrong");
      }

      const changedDays = diffChangedDays(tripData?.days, data.itinerary?.days);

      onTripDataChange?.(data.itinerary);

      if (changedDays.length > 0) {
        onDaysUpdated?.(changedDays);
      }

      if (tripId) {
        const saveRes = await fetch("/api/update-trip", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: tripId,
            itinerary: data.itinerary,
            expectedVersion: itineraryVersion,
          }),
        });
        const saveData = await saveRes.json().catch(() => ({}));

        if (saveRes.status === 409 || saveData.code === "VERSION_CONFLICT") {
          onVersionConflict?.(saveData);
          setChatMessages((prev) => [
            ...prev,
            {
              role: "ai",
              content:
                "I prepared an edit, but the trip was updated by someone else. I refreshed the latest version — please send your request again.",
            },
          ]);
          return;
        }

        if (saveRes.ok && saveData.itineraryVersion != null) {
          onVersionUpdate?.(saveData.itineraryVersion);
        }
      }

      const confirmation =
        changedDays.length > 0
          ? `Done! I updated ${formatDayList(changedDays)} — check the highlighted card${changedDays.length > 1 ? "s" : ""} on the left. ${data.changeSummary}`
          : `Done! ${data.changeSummary}`;
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", content: confirmation },
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: `Sorry, I couldn't update the itinerary — ${err.message}. Please try again.`,
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  }

  function handleChip(chip) {
    setChatInput(chip.prompt);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close AI chat" : "Open AI chat editor"}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-[#F97316] to-[#ea580c] text-white shadow-[0_8px_24px_rgba(249,115,22,0.4)] transition-transform hover:scale-105 sm:right-5 sm:bottom-5 sm:h-14 sm:w-14"
      >
        {!open && (
          <>
            <span className="chat-fab-ring" aria-hidden="true" />
            <span className="chat-fab-ring chat-fab-ring-delayed" aria-hidden="true" />
          </>
        )}
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
        {!open && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow">
            {isPro ? (
              <span className="text-[9px] font-extrabold text-[#F97316]">AI</span>
            ) : (
              <Lock className="h-3 w-3 text-[#64748B]" />
            )}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] z-50 flex max-h-[min(600px,calc(100dvh-7.5rem))] w-auto flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.25)] sm:inset-x-auto sm:right-5 sm:bottom-24 sm:w-[min(400px,calc(100vw-40px))]">
          <div className="flex items-center justify-between bg-[#0F1B4D] px-4 py-3.5">
            <h3 className="flex items-center gap-2 text-base font-bold text-white">
              <Bot className="h-5 w-5" />
              AI Assistant
            </h3>
            {isPro ? (
              <ProBadge />
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white">
                <Lock className="h-3 w-3" />
                Pro
              </span>
            )}
          </div>

          {!isPro ? (
            <div className="relative">
              <div
                className="pointer-events-none space-y-3 p-4 blur-[6px] select-none"
                aria-hidden="true"
              >
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[#EFF6FF] px-4 py-3 text-sm text-[#0F172A]">
                  Swapped Day 1 afternoon for a local market walk and updated the cost.
                </div>
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#F97316] px-4 py-3 text-sm text-white">
                  Reorder Day 2 for cooler mornings.
                </div>
              </div>

              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60 p-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF7ED]">
                  <Lock className="h-5 w-5 text-[#F97316]" />
                </span>
                <p className="text-sm font-bold text-[#0F172A]">Pro Feature</p>
                <p className="text-xs leading-relaxed text-[#64748B]">
                  Swap activities, reorder days, and regenerate around budget,
                  time, or weather — edits update your itinerary live.
                </p>
                <Link
                  href="/pricing"
                  className="rounded-xl bg-[#F97316] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c]"
                >
                  Upgrade to Pro
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="day-scroller flex-1 space-y-3 overflow-y-auto bg-[#F8FAFC] p-4">
                {chatMessages.map((msg, i) =>
                  msg.role === "ai" ? (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF]">
                        <Bot className="h-4 w-4 text-[#1E3A8A]" />
                      </span>
                      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm leading-relaxed text-[#0F172A] shadow-soft">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex items-start justify-end gap-2">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#F97316] px-4 py-2.5 text-sm leading-relaxed text-white shadow-soft">
                        {msg.content}
                      </div>
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFF7ED]">
                        <User className="h-4 w-4 text-[#F97316]" />
                      </span>
                    </div>
                  )
                )}

                {isChatLoading && (
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF]">
                      <Bot className="h-4 w-4 text-[#1E3A8A]" />
                    </span>
                    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-soft">
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#94A3B8]"
                          style={{ animationDelay: `${d * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-[#F1F5F9] bg-white px-3 pt-2.5 pb-1">
                <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-[#94A3B8] uppercase">
                  Edit types
                </p>
                <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {EDIT_CHIPS.map((chip) => {
                    const Icon = chip.Icon;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => handleChip(chip)}
                        disabled={isChatLoading}
                        className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#0F172A] transition-colors hover:border-[#F97316]/40 hover:bg-[#FFF7ED] hover:text-[#ea580c] disabled:opacity-50"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white p-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Swap Day 1 evening for street food…"
                  disabled={isChatLoading}
                  className="min-w-0 flex-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#0F172A] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => sendChatMessage()}
                  disabled={isChatLoading || !chatInput.trim()}
                  aria-label="Send message"
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#F97316] text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isChatLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SendHorizonal className="h-4 w-4" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
