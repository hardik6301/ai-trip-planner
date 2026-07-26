"use client";

/**
 * Live currency card with a small converter (local ↔ profile currency).
 */

import { useEffect, useState } from "react";
import { ArrowLeftRight, Banknote } from "lucide-react";
import { currencySymbol } from "@/lib/destinationLive";

export default function LiveCurrencyCard({ currency, loading }) {
  const localCode = currency?.localCode || "—";
  const userCode = currency?.userCode || "INR";
  const rate = currency?.rate;
  const canConvert = rate != null && Number(rate) > 0 && localCode !== "—";

  const [amount, setAmount] = useState("100");
  const [direction, setDirection] = useState("local-to-user"); // or user-to-local

  useEffect(() => {
    setAmount("100");
    setDirection("local-to-user");
  }, [localCode, userCode]);

  const numeric = parseFloat(String(amount).replace(/,/g, ""));
  const valid = Number.isFinite(numeric) && numeric >= 0;

  let converted = null;
  if (canConvert && valid) {
    converted =
      direction === "local-to-user" ? numeric * rate : numeric / rate;
  }

  const fromCode = direction === "local-to-user" ? localCode : userCode;
  const toCode = direction === "local-to-user" ? userCode : localCode;
  const fromSym = currencySymbol(fromCode);
  const toSym = currencySymbol(toCode);

  return (
    <div className="rounded-xl border border-[#E2E8F0]/50 bg-white px-4 py-4 shadow-soft transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(15,23,42,0.08)]">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Banknote className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="text-xs font-semibold text-[#1E3A8A]">Currency</span>
        {!loading && canConvert && (
          <span className="ml-auto rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-emerald-700 uppercase">
            Live
          </span>
        )}
      </div>

      <p
        className={`mt-2 text-sm font-bold leading-tight text-[#0F172A] ${
          loading ? "animate-pulse text-[#94A3B8]" : ""
        }`}
      >
        {loading
          ? "…"
          : `${localCode} (${currencySymbol(localCode)})`}
      </p>
      <p
        className={`mt-1 text-xs leading-snug text-[#64748B] ${
          loading ? "animate-pulse" : ""
        }`}
      >
        {loading ? "Loading…" : currency?.exchangeLine || "Rate unavailable"}
      </p>

      {!loading && canConvert && (
        <div className="mt-3 space-y-2 border-t border-[#F1F5F9] pt-3">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[10px] font-semibold text-[#94A3B8]">
                {fromSym}
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label={`Amount in ${fromCode}`}
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-1.5 pr-2 pl-7 text-xs font-semibold text-[#0F172A] outline-none focus:border-[#F97316]"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                setDirection((d) =>
                  d === "local-to-user" ? "user-to-local" : "local-to-user"
                )
              }
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#E2E8F0] text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
              title="Flip conversion direction"
              aria-label="Flip conversion direction"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[11px] leading-snug text-[#0F172A]">
            <span className="font-semibold text-[#64748B]">{toCode}</span>{" "}
            <span className="font-bold">
              {converted == null
                ? "—"
                : `${toSym}${converted.toLocaleString(
                    toCode === "INR" ? "en-IN" : "en-US",
                    {
                      maximumFractionDigits: converted >= 100 ? 0 : 2,
                    }
                  )}`}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
