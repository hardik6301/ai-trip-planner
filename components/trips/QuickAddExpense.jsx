"use client";

/**
 * Compact add-expense form under Trip Spend — updates the live progress bar.
 */

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

const CATEGORIES = [
  "Food & Drinks",
  "Hotel",
  "Transport",
  "Activities",
  "Shopping",
  "Wellness",
  "Other",
];

export default function QuickAddExpense({ tripId, onAdded }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!tripId || saving) return;

    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          amount,
          category,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      setAmount("");
      setNote("");
      setOpen(false);
      showToast("Expense logged", "success");
      onAdded?.(Number(data.expense?.amount || amount));
    } catch (err) {
      showToast(err.message || "Could not save expense", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!tripId) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#F97316]/40 bg-[#FFF7ED]/60 px-2 py-1.5 text-[11px] font-semibold text-[#F97316] transition-colors hover:bg-[#FFF7ED]"
      >
        <Plus className="h-3.5 w-3.5" />
        Log expense
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 space-y-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5"
    >
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs outline-none focus:border-[#F97316]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full cursor-pointer rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs outline-none focus:border-[#F97316]"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        maxLength={120}
        className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs outline-none focus:border-[#F97316]"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 cursor-pointer rounded-lg border border-[#E2E8F0] bg-white py-1.5 text-[11px] font-semibold text-[#64748B]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-[#F97316] py-1.5 text-[11px] font-semibold text-white hover:bg-[#ea580c] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Save
        </button>
      </div>
    </form>
  );
}
