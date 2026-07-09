"use client";

/**
 * Travora Expense Tracker — Pro-only premium dashboard for a saved trip.
 * Intentionally dark themed (navy/black + orange) regardless of the app theme.
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
import ProBadge from "@/components/ui/ProBadge";

// Expense categories — colors aligned with the Stitch donut chart
const CATEGORIES = [
  { value: "Food & Drinks", emoji: "🍽️", color: "#60A5FA", Icon: UtensilsCrossed },
  { value: "Hotel", emoji: "🏨", color: "#38BDF8", Icon: Bed },
  { value: "Transport", emoji: "🚗", color: "#D97706", Icon: Car },
  { value: "Activities", emoji: "🎟️", color: "#F97316", Icon: Ship },
  { value: "Shopping", emoji: "🛍️", color: "#F472B6", Icon: ShoppingBag },
  { value: "Wellness", emoji: "💆", color: "#FBBF24", Icon: Sparkles },
  { value: "Other", emoji: "📦", color: "#94A3B8", Icon: Package },
];

/** Look up a category config, falling back to "Other" */
function categoryMeta(name) {
  return CATEGORIES.find((c) => c.value === name) ?? CATEGORIES[CATEGORIES.length - 1];
}

/** Extract the first numeric amount from a budget string ("₹40,000 – ₹55,000") */
function parseAmount(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/,/g, "");
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

/** Lower bound of the trip's budget estimate, ignoring notes in parentheses */
function parseTripBudget(trip) {
  const source = trip?.itinerary?.totalBudgetEstimate || trip?.budget;
  const core = String(source || "").replace(/\([^)]*\)/g, "");
  return parseAmount(core.split(/[-–—]/)[0]) ?? parseAmount(core);
}

/** "₹12,400" — full rupee format */
function money(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

/** "₹32k" — compact format for the donut center */
function moneyCompact(n) {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${Math.round(v / 1000)}k`;
  return `₹${v}`;
}

/** "Oct 12, 2024" from a YYYY-MM-DD date string */
function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "2:00 PM" from an ISO timestamp */
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Today's date as YYYY-MM-DD for the date input default */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenseTrackerPage() {
  const { id: tripId } = useParams();
  const router = useRouter();

  // Page load state: "loading" | "ready" | "not_found" | "error"
  const [pageState, setPageState] = useState("loading");
  const [trip, setTrip] = useState(null);
  const [expenses, setExpenses] = useState([]);

  // Add-expense form fields
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // AI insight state
  const [insight, setInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);

  // ── Load user (Pro gate), trip, and expenses ──
  useEffect(() => {
    if (!tripId) return;
    const supabase = createClient();

    async function load() {
      // Resolve the logged-in user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Not signed in → send to login
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      // Pro-only page — free users go to pricing
      const { isPro, profile } = await fetchUserProStatus(supabase, user.id);
      if (!isPro && !isProUser(user, profile)) {
        router.replace("/pricing");
        return;
      }

      // Fetch the trip (RLS restricts to the owner)
      const { data: tripRow, error: tripError } = await supabase
        .from("trips")
        .select("id, user_id, destination, budget, itinerary")
        .eq("id", tripId)
        .maybeSingle();

      if (tripError) {
        setPageState("error");
        return;
      }
      if (!tripRow || tripRow.user_id !== user.id) {
        setPageState("not_found");
        return;
      }
      setTrip(tripRow);

      // Fetch this trip's expenses, oldest date first
      const { data: rows, error: expError } = await supabase
        .from("expenses")
        .select("*")
        .eq("trip_id", tripId)
        .order("expense_date", { ascending: true })
        .order("created_at", { ascending: true });

      if (expError) {
        setPageState("error");
        return;
      }
      setExpenses(rows ?? []);
      setPageState("ready");
    }

    load();
  }, [tripId, router]);

  // ── Derived totals ──
  const totalSpent = useMemo(
    () => expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [expenses]
  );
  const budget = useMemo(() => parseTripBudget(trip), [trip]);
  const pctUsed = budget ? Math.min(100, Math.round((totalSpent / budget) * 100)) : null;
  const left = budget ? Math.max(0, budget - totalSpent) : null;

  // Per-category totals (only categories with spend), largest first
  const breakdown = useMemo(() => {
    const map = new Map();
    expenses.forEach((e) => {
      map.set(e.category, (map.get(e.category) || 0) + Number(e.amount || 0));
    });
    return [...map.entries()]
      .map(([name, total]) => ({ ...categoryMeta(name), name, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  // CSS conic-gradient string for the donut chart
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

  // Expenses grouped by date → [{ label, dateLabel, total, items }]
  const dayGroups = useMemo(() => {
    const map = new Map();
    expenses.forEach((e) => {
      if (!map.has(e.expense_date)) map.set(e.expense_date, []);
      map.get(e.expense_date).push(e);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items], i) => ({
        label: `Day ${i + 1}`,
        date,
        dateLabel: formatDate(date),
        total: items.reduce((s, e) => s + Number(e.amount || 0), 0),
        items,
      }));
  }, [expenses]);

  // ── AI insight: cached per trip + total so it isn't regenerated every render ──
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
        budget,
        destination: trip?.destination,
        breakdown: breakdown.map((c) => `${c.name} ₹${c.total}`).join(", "),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.insight) return;
        setInsight(data.insight);
        sessionStorage.setItem(cacheKey, data.insight);
      })
      .catch(() => {
        /* insight is a nice-to-have — fail silently */
      })
      .finally(() => {
        if (!cancelled) setInsightLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState, totalSpent, tripId]);

  // ── Save a new expense to Supabase ──
  async function handleAddExpense(e) {
    e.preventDefault();
    setFormError("");

    // Validate the amount before hitting the database
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

    // Insert and get the saved row back (id, created_at)
    const { data: row, error } = await supabase
      .from("expenses")
      .insert({
        trip_id: tripId,
        user_id: user.id,
        category,
        amount: value,
        note: note.trim() || null,
        expense_date: expenseDate || todayStr(),
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      setFormError(error.message || "Failed to save expense. Try again.");
      return;
    }

    // Append and keep the list sorted by date then time
    setExpenses((prev) =>
      [...prev, row].sort(
        (a, b) =>
          a.expense_date.localeCompare(b.expense_date) ||
          a.created_at.localeCompare(b.created_at)
      )
    );
    // Reset the quick-entry fields (keep category and date for fast repeat entry)
    setAmount("");
    setNote("");
  }

  // ── Delete an expense (optimistic, restore on failure) ──
  async function handleDelete(expenseId) {
    const previous = expenses;
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));

    const supabase = createClient();
    const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
    if (error) {
      setExpenses(previous);
    }
  }

  // ── Export the current expense list as a PDF ──
  function handleExportPdf() {
    downloadExpensesPdf({
      destination: capitalizeDestination(trip?.destination || "Trip"),
      dayGroups,
      totalSpent,
      budget,
    });
  }

  // ── Loading state ──
  if (pageState === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0A0F1E] text-[#8B95AB]">
        <Loader2 className="h-8 w-8 animate-spin text-[#F97316]" />
        Loading expense tracker...
      </div>
    );
  }

  // ── Error / not found states ──
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
        {/* ─── Header ─── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {/* Breadcrumb */}
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
          </div>

          {/* Header actions */}
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

        {/* ─── Content grid: sidebar (1/3) + main (2/3) ─── */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* ══ LEFT SIDEBAR ══ */}
          <div className="space-y-6 lg:col-span-1">
            {/* Total Spent card */}
            <div className="rounded-2xl border border-[#26314B] bg-[#111A2E] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] text-[#F97316] uppercase">
                    Total Spent
                  </p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-white">
                    {money(totalSpent)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold tracking-[0.12em] text-[#F97316] uppercase">
                    Budget
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {budget ? money(budget) : "—"}
                  </p>
                </div>
              </div>

              {/* Spend progress against budget */}
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#1E2A44]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#F97316] to-[#FDBA74] transition-all duration-500"
                  style={{ width: `${pctUsed ?? 0}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-[#8B95AB]">
                  {pctUsed != null ? `${pctUsed}% used` : "No budget estimate"}
                </span>
                {left != null && (
                  <span className="font-semibold text-[#F97316]">{money(left)} left</span>
                )}
              </div>
            </div>

            {/* Breakdown donut chart (pure CSS conic-gradient) */}
            <div className="rounded-2xl border border-[#26314B] bg-[#111A2E] p-5">
              <h3 className="text-lg font-bold text-white">Breakdown</h3>

              <div className="mt-5 flex justify-center">
                <div
                  className="relative h-44 w-44 rounded-full"
                  style={{ background: donutGradient }}
                  role="img"
                  aria-label="Spending breakdown by category"
                >
                  {/* Center hole with total */}
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

              {/* Category legend */}
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

            {/* Travora AI Insight card */}
            <div className="rounded-2xl bg-[#F97316] p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg">
                  ✨
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

          {/* ══ RIGHT MAIN ══ */}
          <div className="space-y-6 lg:col-span-2">
            {/* Add New Expense form */}
            <form
              id="add-expense"
              onSubmit={handleAddExpense}
              className="scroll-mt-24 rounded-2xl border border-[#26314B] bg-[#111A2E] p-5 md:p-6"
            >
              <h2 className="text-xl font-bold text-white">Add New Expense</h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {/* Category dropdown */}
                <div>
                  <label htmlFor="exp-category" className="text-xs font-semibold text-[#8B95AB]">
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

                {/* Amount input */}
                <div>
                  <label htmlFor="exp-amount" className="text-xs font-semibold text-[#8B95AB]">
                    Amount (₹)
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
                    className="mt-1.5 w-full rounded-xl border border-[#26314B] bg-[#0D1526] px-3 py-2.5 text-sm text-white placeholder-[#4B5570] outline-none focus:border-[#F97316]"
                  />
                </div>

                {/* Note input */}
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

              {/* Date row */}
              <div className="mt-4 max-w-xs">
                <label htmlFor="exp-date" className="text-xs font-semibold text-[#8B95AB]">
                  Date
                </label>
                <input
                  id="exp-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="mt-1.5 w-full cursor-pointer rounded-xl border border-[#26314B] bg-[#0D1526] px-3 py-2.5 text-sm text-white outline-none [color-scheme:dark] focus:border-[#F97316]"
                />
              </div>

              {/* Validation / save errors */}
              {formError && <p className="mt-3 text-sm text-red-400">{formError}</p>}

              {/* Full-width save button — matches Stitch peach CTA */}
              <button
                type="submit"
                disabled={saving}
                className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#FDBA74] py-3 text-sm font-bold text-[#431407] transition-colors hover:bg-[#F97316] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Saving..." : "Save Expense"}
              </button>
            </form>

            {/* Expenses list grouped by day */}
            {dayGroups.length === 0 ? (
              // Empty state
              <div className="rounded-2xl border border-dashed border-[#26314B] bg-[#111A2E]/50 px-6 py-14 text-center">
                <p className="text-3xl">💸</p>
                <p className="mt-3 text-sm font-semibold text-white">No expenses yet</p>
                <p className="mt-1 text-xs text-[#8B95AB]">
                  Log your first expense above to start tracking your {destination} spend.
                </p>
              </div>
            ) : (
              dayGroups.map((group) => (
                <section key={group.date}>
                  {/* Day section header */}
                  <div className="flex items-center gap-3 px-1">
                    <h3 className="text-lg font-bold text-white">{group.label}</h3>
                    <span className="text-xs text-[#8B95AB]">{group.dateLabel}</span>
                    <div className="h-px flex-1 bg-[#26314B]" />
                    <span className="text-sm font-bold text-[#F97316]">
                      {money(group.total)}
                    </span>
                  </div>

                  {/* Expense rows */}
                  <div className="mt-3 space-y-2.5">
                    {group.items.map((exp) => {
                      const meta = categoryMeta(exp.category);
                      const CatIcon = meta.Icon;
                      return (
                        <div
                          key={exp.id}
                          className="group flex items-center gap-4 rounded-2xl border border-[#26314B] bg-[#111A2E] px-4 py-3.5 transition-colors hover:border-[#3A4763]"
                        >
                          {/* Category icon circle */}
                          <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
                            aria-hidden="true"
                          >
                            <CatIcon className="h-5 w-5" strokeWidth={1.75} />
                          </span>

                          {/* Name + category/time */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white">
                              {exp.note || exp.category}
                            </p>
                            <p className="mt-0.5 text-xs text-[#8B95AB]">
                              {exp.category} • {formatTime(exp.created_at)}
                            </p>
                          </div>

                          {/* Amount */}
                          <p className="shrink-0 text-base font-bold text-white">
                            {money(exp.amount)}
                          </p>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(exp.id)}
                            aria-label="Delete expense"
                            className="shrink-0 cursor-pointer rounded-lg p-2 text-[#4B5570] transition-colors hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
