"use client";

/**
 * Travora Expense Tracker — Pro-only dashboard for a saved trip.
 * Log amount / category / note against a day or activity; live totals vs budget.
 * Route: /trip/[id]/expenses
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bed,
  Car,
  ChevronRight,
  Download,
  Loader2,
  Package,
  Plus,
  Ship,
  ShoppingBag,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchUserProStatus, isProUser } from "@/lib/userPlan";
import { capitalizeDestination } from "@/utils/formatTrip";
import { downloadExpensesPdf } from "@/utils/downloadExpensesPdf";
import {
  formatMoney,
  formatMoneyCompact,
  getDayActivityOptions,
  parseBudgetRange,
} from "@/utils/expenseBudget";
import ProBadge from "@/components/ui/ProBadge";

const CATEGORIES = [
  { value: "Food & Drinks", emoji: "🍽️", color: "#60A5FA", Icon: UtensilsCrossed },
  { value: "Hotel", emoji: "🏨", color: "#38BDF8", Icon: Bed },
  { value: "Transport", emoji: "🚗", color: "#D97706", Icon: Car },
  { value: "Activities", emoji: "🎟️", color: "#F97316", Icon: Ship },
  { value: "Shopping", emoji: "🛍️", color: "#F472B6", Icon: ShoppingBag },
  { value: "Wellness", emoji: "💆", color: "#FBBF24", Icon: Sparkles },
  { value: "Other", emoji: "📦", color: "#94A3B8", Icon: Package },
];

function categoryMeta(name) {
  return CATEGORIES.find((c) => c.value === name) ?? CATEGORIES[CATEGORIES.length - 1];
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenseTrackerPage() {
  const { id: tripId } = useParams();
  const router = useRouter();

  const [pageState, setPageState] = useState("loading");
  const [trip, setTrip] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isTripOwner, setIsTripOwner] = useState(false);

  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayStr());
  const [dayNumber, setDayNumber] = useState("");
  const [activityKey, setActivityKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [insight, setInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const accessRes = await fetch(`/api/trip/${tripId}`);
      const accessData = await accessRes.json().catch(() => ({}));
      if (!accessRes.ok || !accessData.canEdit) {
        setPageState("not_found");
        return;
      }

      const role = accessData.role || "viewer";
      setIsTripOwner(role === "owner");
      setCurrentUserId(user.id);

      const { isPro, profile } = await fetchUserProStatus(supabase, user.id);
      // Same gate as AI Assistant: caller's own Pro + trip edit access
      if (!isPro && !isProUser(user, profile)) {
        router.replace("/pricing");
        return;
      }

      const tripRow = accessData.trip;
      if (!tripRow) {
        setPageState("not_found");
        return;
      }
      setTrip(tripRow);

      const { data: rows, error: expError } = await supabase
        .from("expenses")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });

      if (expError) {
        setPageState("error");
        return;
      }
      setExpenses(rows ?? []);

      const days = tripRow.itinerary?.days;
      if (Array.isArray(days) && days.length > 0) {
        setDayNumber(String(days[0].day ?? 1));
      }

      setPageState("ready");
    }

    load();
  }, [tripId, router]);

  const itineraryDays = useMemo(() => {
    const days = trip?.itinerary?.days;
    return Array.isArray(days) ? days : [];
  }, [trip]);

  const selectedDay = useMemo(() => {
    if (!dayNumber) return null;
    return (
      itineraryDays.find((d) => String(d.day) === String(dayNumber)) || null
    );
  }, [dayNumber, itineraryDays]);

  const activityOptions = useMemo(
    () => getDayActivityOptions(selectedDay),
    [selectedDay]
  );

  useEffect(() => {
    setActivityKey("");
  }, [dayNumber]);

  const budgetRange = useMemo(
    () => parseBudgetRange(trip, trip?.budget),
    [trip]
  );
  const symbol = budgetRange.symbol;
  const money = (n) => formatMoney(n, symbol);
  const moneyCompact = (n) => formatMoneyCompact(n, symbol);

  const totalSpent = useMemo(
    () => expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [expenses]
  );
  const budgetLow = budgetRange.low;
  const pctUsed = budgetLow
    ? Math.min(100, Math.round((totalSpent / budgetLow) * 100))
    : null;
  const left = budgetLow != null ? Math.max(0, budgetLow - totalSpent) : null;

  const breakdown = useMemo(() => {
    const map = new Map();
    expenses.forEach((e) => {
      map.set(e.category, (map.get(e.category) || 0) + Number(e.amount || 0));
    });
    return [...map.entries()]
      .map(([name, total]) => ({ ...categoryMeta(name), name, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  const donutGradient = useMemo(() => {
    if (!totalSpent) return "conic-gradient(#1E2A44 0deg 360deg)";
    let angle = 0;
    const stops = breakdown.map((c) => {
      const start = angle;
      angle += (c.total / totalSpent) * 360;
      return `${c.color} ${start}deg ${angle}deg`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [breakdown, totalSpent]);

  /** Group by itinerary day when linked; otherwise by calendar date */
  const dayGroups = useMemo(() => {
    const byDay = new Map();
    const unassigned = [];

    expenses.forEach((e) => {
      if (e.day_number != null) {
        const key = Number(e.day_number);
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key).push(e);
      } else {
        unassigned.push(e);
      }
    });

    const groups = [...byDay.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, items]) => {
        const itineraryDay = itineraryDays.find((d) => Number(d.day) === day);
        return {
          key: `day-${day}`,
          label: `Day ${day}`,
          dateLabel: itineraryDay?.theme || formatDate(items[0]?.expense_date),
          total: items.reduce((s, e) => s + Number(e.amount || 0), 0),
          items,
        };
      });

    if (unassigned.length) {
      const byDate = new Map();
      unassigned.forEach((e) => {
        const d = e.expense_date || "unknown";
        if (!byDate.has(d)) byDate.set(d, []);
        byDate.get(d).push(e);
      });
      [...byDate.entries()]
        .sort(([a], [b]) => String(a).localeCompare(String(b)))
        .forEach(([date, items]) => {
          groups.push({
            key: `date-${date}`,
            label: "Other",
            dateLabel: formatDate(date) || "No date",
            total: items.reduce((s, e) => s + Number(e.amount || 0), 0),
            items,
          });
        });
    }

    return groups;
  }, [expenses, itineraryDays]);

  useEffect(() => {
    if (pageState !== "ready" || totalSpent <= 0) return;

    const cacheKey = `travoraExpenseInsight:${tripId}:${totalSpent}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setInsight(cached);
      return;
    }

    let cancelled = false;
    setInsightLoading(true);
    fetch("/api/expense-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        total: totalSpent,
        budget: budgetLow,
        destination: trip?.destination,
        breakdown: breakdown
          .map((c) => `${c.name} ${money(c.total)}`)
          .join(", "),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.insight) return;
        setInsight(data.insight);
        sessionStorage.setItem(cacheKey, data.insight);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setInsightLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState, totalSpent, tripId]);

  async function handleAddExpense(e) {
    e.preventDefault();
    setFormError("");

    const value = parseFloat(amount);
    if (!value || value <= 0) {
      setFormError("Enter a valid amount greater than 0.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const dayNum = dayNumber ? Number(dayNumber) : null;
    const actOpt = activityOptions.find((o) => o.value === activityKey);
    const payload = {
      trip_id: tripId,
      user_id: user.id,
      created_by: user.id,
      category,
      amount: value,
      note: note.trim() || null,
      expense_date: expenseDate || todayStr(),
      day_number: Number.isFinite(dayNum) ? dayNum : null,
      activity_key: activityKey || null,
      activity_label: actOpt?.activityLabel || null,
    };

    let { data: row, error } = await supabase
      .from("expenses")
      .insert(payload)
      .select()
      .single();

    // Graceful fallback if migrations 013/016 not applied yet
    if (
      error &&
      /day_number|activity_key|activity_label|created_by|column/i.test(
        error.message || ""
      )
    ) {
      const legacy = {
        trip_id: tripId,
        user_id: user.id,
        category,
        amount: value,
        note: [
          dayNum ? `Day ${dayNum}` : null,
          actOpt?.activityLabel || null,
          note.trim() || null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
        expense_date: expenseDate || todayStr(),
      };
      ({ data: row, error } = await supabase
        .from("expenses")
        .insert(legacy)
        .select()
        .single());
    }

    setSaving(false);

    if (error) {
      setFormError(error.message || "Failed to save expense. Try again.");
      return;
    }

    setExpenses((prev) => [...prev, row]);
    setAmount("");
    setNote("");
    setActivityKey("");
  }

  async function handleDelete(expenseId) {
    const previous = expenses;
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));

    const supabase = createClient();
    const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
    if (error) {
      setExpenses(previous);
    }
  }

  function handleExportPdf() {
    downloadExpensesPdf({
      destination: capitalizeDestination(trip?.destination || "Trip"),
      dayGroups,
      totalSpent,
      budget: budgetLow,
      currencySymbol: symbol,
    });
  }

  if (pageState === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0A0F1E] text-[#8B95AB]">
        <Loader2 className="h-8 w-8 animate-spin text-[#F97316]" />
        Loading expense tracker...
      </div>
    );
  }

  if (pageState === "not_found" || pageState === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0A0F1E] px-5 text-center">
        <h1 className="text-2xl font-bold text-white">
          {pageState === "not_found" ? "Trip not found" : "Something went wrong"}
        </h1>
        <p className="max-w-md text-sm text-[#8B95AB]">
          {pageState === "not_found"
            ? "This trip doesn't exist or you don't have access to it."
            : "Couldn't load your expenses. Please try again."}
        </p>
        <Link
          href="/my-trips"
          className="rounded-xl bg-[#F97316] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c]"
        >
          Back to My Trips
        </Link>
      </div>
    );
  }

  const destination = capitalizeDestination(trip.destination);

  return (
    <div className="min-h-screen bg-[#0A0F1E] pb-16 font-sans">
      <div className="mx-auto max-w-[1200px] px-4 pt-8 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <nav className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-[#8B95AB] uppercase">
              <Link href="/my-trips" className="transition-colors hover:text-white">
                My Trips
              </Link>
              <ChevronRight className="h-3 w-3" />
              <Link
                href={`/trip/${tripId}`}
                className="max-w-[160px] truncate transition-colors hover:text-white"
              >
                {destination}
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-[#F97316]">Expense Tracker</span>
            </nav>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold tracking-tight text-white">
              Expense Tracker
              <ProBadge />
            </h1>
            <p className="mt-1.5 max-w-lg text-sm text-[#8B95AB]">
              Log what you actually spend per day or activity. Your trip page
              progress bar updates live against the estimated budget.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={expenses.length === 0}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#26314B] bg-transparent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#141D31] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </button>
            <a
              href="#add-expense"
              className="flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(249,115,22,0.35)] transition-colors hover:bg-[#ea580c]"
            >
              <Plus className="h-4 w-4" />
              Add Expense
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-2xl border border-[#26314B] bg-[#111A2E] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] text-[#F97316] uppercase">
                    Total Spent
                  </p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-white">
                    {money(totalSpent)}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[10px] font-bold tracking-[0.12em] text-[#F97316] uppercase">
                    Est. Budget
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {budgetRange.label}
                  </p>
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#1E2A44]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#F97316] to-[#FDBA74] transition-all duration-500"
                  style={{ width: `${pctUsed ?? 0}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-[#8B95AB]">
                  {pctUsed != null ? `${pctUsed}% of low estimate` : "No budget estimate"}
                </span>
                {left != null && (
                  <span className="font-semibold text-[#F97316]">
                    {money(left)} left
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#26314B] bg-[#111A2E] p-5">
              <h3 className="text-lg font-bold text-white">Breakdown</h3>

              <div className="mt-5 flex justify-center">
                <div
                  className="relative h-44 w-44 rounded-full"
                  style={{ background: donutGradient }}
                  role="img"
                  aria-label="Spending breakdown by category"
                >
                  <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-[#111A2E]">
                    <span className="text-xl font-bold text-white">
                      {moneyCompact(totalSpent)}
                    </span>
                    <span className="text-[10px] font-semibold tracking-[0.15em] text-[#8B95AB] uppercase">
                      Total
                    </span>
                  </div>
                </div>
              </div>

              {breakdown.length > 0 ? (
                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
                  {breakdown.map((c) => (
                    <div key={c.name} className="flex items-start gap-2">
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] text-[#8B95AB]">{c.name}</p>
                        <p className="text-xs font-bold text-white">{money(c.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-center text-xs text-[#8B95AB]">
                  Add expenses to see your category breakdown.
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-[#F97316] p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Sparkles className="h-4 w-4 text-white" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Travora AI Insight</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#431407]">
                    {insightLoading
                      ? "Analyzing your spending pattern..."
                      : insight ||
                        "Add your first expense and I'll analyze your spending against your budget."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-2">
            <form
              id="add-expense"
              onSubmit={handleAddExpense}
              className="scroll-mt-24 rounded-2xl border border-[#26314B] bg-[#111A2E] p-5 md:p-6"
            >
              <h2 className="text-xl font-bold text-white">Add New Expense</h2>
              <p className="mt-1 text-xs text-[#8B95AB]">
                Attach spend to a trip day, or drill into a specific activity.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="exp-day" className="text-xs font-semibold text-[#8B95AB]">
                    Day
                  </label>
                  <select
                    id="exp-day"
                    value={dayNumber}
                    onChange={(e) => setDayNumber(e.target.value)}
                    className="mt-1.5 w-full cursor-pointer rounded-xl border border-[#26314B] bg-[#0D1526] px-3 py-2.5 text-sm text-white outline-none focus:border-[#F97316]"
                  >
                    <option value="">No specific day</option>
                    {itineraryDays.map((d) => (
                      <option key={d.day} value={String(d.day)}>
                        Day {d.day}
                        {d.theme ? ` — ${d.theme}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="exp-activity"
                    className="text-xs font-semibold text-[#8B95AB]"
                  >
                    Activity
                  </label>
                  <select
                    id="exp-activity"
                    value={activityKey}
                    onChange={(e) => setActivityKey(e.target.value)}
                    disabled={!dayNumber}
                    className="mt-1.5 w-full cursor-pointer rounded-xl border border-[#26314B] bg-[#0D1526] px-3 py-2.5 text-sm text-white outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {activityOptions.map((o) => (
                      <option key={o.value || "whole"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="exp-category"
                    className="text-xs font-semibold text-[#8B95AB]"
                  >
                    Category
                  </label>
                  <select
                    id="exp-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1.5 w-full cursor-pointer rounded-xl border border-[#26314B] bg-[#0D1526] px-3 py-2.5 text-sm text-white outline-none focus:border-[#F97316]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.emoji} {c.value}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="exp-amount"
                    className="text-xs font-semibold text-[#8B95AB]"
                  >
                    Amount ({symbol})
                  </label>
                  <input
                    id="exp-amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="mt-1.5 w-full rounded-xl border border-[#26314B] bg-[#0D1526] px-3 py-2.5 text-sm text-white placeholder-[#4B5570] outline-none focus:border-[#F97316]"
                  />
                </div>

                <div>
                  <label htmlFor="exp-note" className="text-xs font-semibold text-[#8B95AB]">
                    Note
                  </label>
                  <input
                    id="exp-note"
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What was this for?"
                    maxLength={120}
                    className="mt-1.5 w-full rounded-xl border border-[#26314B] bg-[#0D1526] px-3 py-2.5 text-sm text-white placeholder-[#4B5570] outline-none focus:border-[#F97316]"
                  />
                </div>
              </div>

              <div className="mt-4 max-w-xs">
                <label htmlFor="exp-date" className="text-xs font-semibold text-[#8B95AB]">
                  Date paid
                </label>
                <input
                  id="exp-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="mt-1.5 w-full cursor-pointer rounded-xl border border-[#26314B] bg-[#0D1526] px-3 py-2.5 text-sm text-white outline-none [color-scheme:dark] focus:border-[#F97316]"
                />
              </div>

              {formError && <p className="mt-3 text-sm text-red-400">{formError}</p>}

              <button
                type="submit"
                disabled={saving}
                className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#FDBA74] py-3 text-sm font-bold text-[#431407] transition-colors hover:bg-[#F97316] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Saving..." : "Save Expense"}
              </button>
            </form>

            {dayGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#26314B] bg-[#111A2E]/50 px-6 py-14 text-center">
                <p className="text-sm font-semibold text-white">No expenses yet</p>
                <p className="mt-1 text-xs text-[#8B95AB]">
                  Log your first expense above to start tracking your {destination}{" "}
                  spend.
                </p>
              </div>
            ) : (
              dayGroups.map((group) => (
                <section key={group.key}>
                  <div className="flex items-center gap-3 px-1">
                    <h3 className="text-lg font-bold text-white">{group.label}</h3>
                    <span className="truncate text-xs text-[#8B95AB]">
                      {group.dateLabel}
                    </span>
                    <div className="h-px flex-1 bg-[#26314B]" />
                    <span className="text-sm font-bold text-[#F97316]">
                      {money(group.total)}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2.5">
                    {group.items.map((exp) => {
                      const meta = categoryMeta(exp.category);
                      const CatIcon = meta.Icon;
                      const subtitle = [
                        exp.activity_label
                          ? exp.activity_label
                          : exp.activity_key
                            ? exp.activity_key
                            : null,
                        exp.category,
                        formatTime(exp.created_at),
                      ]
                        .filter(Boolean)
                        .join(" · ");

                      return (
                        <div
                          key={exp.id}
                          className="group flex items-center gap-4 rounded-2xl border border-[#26314B] bg-[#111A2E] px-4 py-3.5 transition-colors hover:border-[#3A4763]"
                        >
                          <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: `${meta.color}22`,
                              color: meta.color,
                            }}
                            aria-hidden="true"
                          >
                            <CatIcon className="h-5 w-5" strokeWidth={1.75} />
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white">
                              {exp.note || exp.activity_label || exp.category}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-[#8B95AB]">
                              {subtitle}
                            </p>
                          </div>

                          <p className="shrink-0 text-base font-bold text-white">
                            {money(exp.amount)}
                          </p>

                          {(isTripOwner ||
                            exp.user_id === currentUserId ||
                            exp.created_by === currentUserId) && (
                            <button
                              type="button"
                              onClick={() => handleDelete(exp.id)}
                              aria-label="Delete expense"
                              className="shrink-0 cursor-pointer rounded-lg p-2 text-[#4B5570] transition-colors hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
