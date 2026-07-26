"use client";

/**
 * Owner-only controls: create / copy / rotate / revoke edit invite link.
 * Separate from view-only Share (/trip/[id]).
 */

import { useCallback, useEffect, useState } from "react";
import { Copy, Link2, Loader2, RefreshCw, ShieldOff } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export default function EditInviteControls({ tripId }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editUrl, setEditUrl] = useState(null);

  const load = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/trip-edit-link?tripId=${tripId}`);
      const data = await res.json();
      if (res.ok) {
        setEditUrl(data.editUrl || null);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  async function createOrRotate() {
    setBusy(true);
    try {
      const res = await fetch("/api/trip-edit-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create link");
      setEditUrl(data.editUrl);
      await navigator.clipboard?.writeText(data.editUrl);
      showToast(
        data.rotated
          ? "New edit link created and copied (old link revoked)"
          : "Edit invite link copied",
        "success"
      );
    } catch (err) {
      showToast(err.message || "Could not create edit link", "error");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!editUrl) return;
    try {
      await navigator.clipboard.writeText(editUrl);
      showToast("Edit invite link copied", "success");
    } catch {
      showToast("Could not copy link", "error");
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      const res = await fetch("/api/trip-edit-link", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke");
      setEditUrl(null);
      showToast("Edit invite revoked", "success");
    } catch (err) {
      showToast(err.message || "Could not revoke link", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!tripId) return null;

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
        <Link2 className="h-3.5 w-3.5 text-[#F97316]" />
        Edit invite link
      </div>
      <p className="mt-1 text-[10px] leading-snug text-[#64748B]">
        Separate from Share (view-only). Anyone with this link can join as an
        editor after signing in.
      </p>

      {loading ? (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-[#94A3B8]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {!editUrl ? (
            <button
              type="button"
              onClick={createOrRotate}
              disabled={busy}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0F172A] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1E293B] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
              Create edit link
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={copyLink}
                disabled={busy}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#0F172A] hover:bg-[#F1F5F9]"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
              <button
                type="button"
                onClick={createOrRotate}
                disabled={busy}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#0F172A] hover:bg-[#F1F5F9]"
              >
                <RefreshCw className="h-3 w-3" />
                Rotate
              </button>
              <button
                type="button"
                onClick={revoke}
                disabled={busy}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
              >
                <ShieldOff className="h-3 w-3" />
                Revoke
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
