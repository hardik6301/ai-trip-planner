"use client";

/**
 * AI Chat Editor — floating chat popup on the results page (Pro feature).
 * Sends natural language edit requests to /api/chat-editor and applies the
 * returned itinerary to state so day cards re-render instantly.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Loader2, Lock, MessageCircle, SendHorizonal, User, X } from "lucide-react";
import ProBadge from "@/components/ui/ProBadge";

// Opening AI message shown when the chat is first opened
const WELCOME_MESSAGE = {
  role: "ai",
  content:
    "Hi! I can help you customize your itinerary. Try saying 'Make Day 2 more relaxing' or 'Add a food tour on Day 3'.",
};

// Quick suggestion chips shown above the input
const SUGGESTIONS = [
  "Make it more relaxing 🧘",
  "Add local food experiences 🍜",
  "Make it budget friendly 💰",
  "Adjust for kids 👶",
];

/** JSON.stringify with sorted keys so key order differences don't count as changes */
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

/** Compare old vs new days and return the day numbers that actually changed */
function diffChangedDays(oldDays = [], newDays = []) {
  const oldByDay = new Map(oldDays.map((d) => [d.day, stableStringify(d)]));
  return newDays
    .filter((d) => oldByDay.get(d.day) !== stableStringify(d))
    .map((d) => d.day);
}

/** Format day numbers as "Day 1", "Day 1 and Day 3", "Day 1, Day 2 and Day 4" */
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
}) {
  // Whether the chat popup is open
  const [open, setOpen] = useState(false);
  // Conversation history: { role: 'user' | 'ai', content }
  const [chatMessages, setChatMessages] = useState([WELCOME_MESSAGE]);
  // Controlled input value
  const [chatInput, setChatInput] = useState("");
  // True while waiting for the AI response
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Ref to the invisible end-of-messages marker for auto-scroll
  const messagesEndRef = useRef(null);
  // Ref to the text input so suggestion chips can refocus it
  const inputRef = useRef(null);

  // Auto-scroll to the newest message whenever the list or loading state changes
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isChatLoading, open]);

  /** Send the current input to the chat editor API and apply the result */
  async function sendChatMessage(text) {
    const message = (text ?? chatInput).trim();
    // Ignore empty sends and double-submits
    if (!message || isChatLoading || !isPro) return;

    // Push the user's message into the conversation and clear the input
    setChatMessages((prev) => [...prev, { role: "user", content: message }]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      // Call the server route with the message and the full current itinerary
      const res = await fetch("/api/chat-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          currentItinerary: tripData,
          destination,
        }),
      });

      const data = await res.json();

      // Surface API errors as an AI chat bubble
      if (!res.ok) {
        throw new Error(data.error || data.details || "Something went wrong");
      }

      // Work out which days actually changed so we can highlight them
      const changedDays = diffChangedDays(tripData?.days, data.itinerary?.days);

      // Apply the updated itinerary — day cards re-render from this state
      onTripDataChange?.(data.itinerary);

      // Tell the page which day cards to flash / badge / scroll to
      if (changedDays.length > 0) {
        onDaysUpdated?.(changedDays);
      }

      // Persist the edit to the saved trip when one exists
      if (tripId) {
        fetch("/api/update-trip", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: tripId, itinerary: data.itinerary }),
        }).catch(() => {
          /* local state already updated; DB sync is best-effort */
        });
      }

      // Confirm the change, naming the exact days that were modified
      const confirmation =
        changedDays.length > 0
          ? `Done! I updated ${formatDayList(changedDays)} — check the highlighted card${changedDays.length > 1 ? "s" : ""} on the left. ${data.changeSummary}`
          : `Done! ${data.changeSummary}`;
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", content: confirmation },
      ]);
    } catch (err) {
      // Show the error as an AI message so the user can retry
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

  /** Submit on Enter (without Shift) */
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  }

  /** Fill the input with a suggestion chip's text */
  function handleSuggestion(text) {
    setChatInput(text);
    inputRef.current?.focus();
  }

  return (
    <>
      {/* Floating chat button — bottom right, above everything */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close AI chat" : "Open AI chat editor"}
        className="fixed right-5 bottom-5 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-[#F97316] to-[#ea580c] text-white shadow-[0_8px_24px_rgba(249,115,22,0.4)] transition-transform hover:scale-105"
      >
        {/* Expanding ripple rings behind the button (only while closed) */}
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
        {/* Small PRO/lock indicator on the button */}
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

      {/* Chat popup panel */}
      {open && (
        <div className="fixed right-5 bottom-24 z-50 flex max-h-[min(600px,calc(100vh-130px))] w-[min(380px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.25)]">
          {/* Navy header with bot icon + PRO badge */}
          <div className="flex items-center justify-between bg-[#0F1B4D] px-4 py-3.5">
            <h3 className="flex items-center gap-2 text-base font-bold text-white">
              <Bot className="h-5 w-5" />
              Chat with AI
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

          {/* Body — locked overlay for free users */}
          {!isPro ? (
            <div className="relative">
              {/* Blurred preview of the chat behind the lock */}
              <div className="pointer-events-none space-y-3 p-4 blur-[6px] select-none" aria-hidden="true">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[#EFF6FF] px-4 py-3 text-sm text-[#0F172A]">
                  I've added Franco's Bar for your first night since you love sunsets!
                </div>
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#F97316] px-4 py-3 text-sm text-white">
                  Yes, please! For 2 people at 7:30 PM.
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[#EFF6FF] px-4 py-3 text-sm text-[#0F172A]">
                  Working on that... Should I lock in the boat tour too?
                </div>
              </div>

              {/* Lock message + upgrade CTA on top of the blur */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60 p-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF7ED]">
                  <Lock className="h-5 w-5 text-[#F97316]" />
                </span>
                <p className="text-sm font-bold text-[#0F172A]">Pro Feature</p>
                <p className="text-xs leading-relaxed text-[#64748B]">
                  Edit your itinerary by chatting with AI — add stops, change
                  days, adjust budgets.
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
              {/* Scrollable message list */}
              <div className="day-scroller flex-1 space-y-3 overflow-y-auto bg-[#F8FAFC] p-4">
                {chatMessages.map((msg, i) =>
                  msg.role === "ai" ? (
                    // AI bubble — left aligned with avatar
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF]">
                        <Bot className="h-4 w-4 text-[#1E3A8A]" />
                      </span>
                      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm leading-relaxed text-[#0F172A] shadow-soft">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    // User bubble — right aligned, orange, with avatar
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

                {/* Typing indicator while the AI is thinking */}
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

                {/* Auto-scroll anchor */}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick suggestion chips */}
              <div className="flex gap-2 overflow-x-auto border-t border-[#F1F5F9] bg-white px-3 pt-2.5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestion(s)}
                    className="shrink-0 cursor-pointer rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs text-[#64748B] transition-colors hover:bg-[#EFF6FF] hover:text-[#1E3A8A]"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Input row with send button */}
              <div className="flex items-center gap-2 bg-white p-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your trip..."
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
