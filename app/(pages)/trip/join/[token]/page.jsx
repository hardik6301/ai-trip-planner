"use client";

/**
 * Redeem a revocable edit invite token → trip_members.editor, then open the trip.
 * View-only sharing stays on /trip/[id] (trip UUID). This path is edit-only.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function JoinTripEditPage() {
  const { token } = useParams();
  const router = useRouter();
  const [status, setStatus] = useState("checking"); // checking | need_login | joining | error | done
  const [message, setMessage] = useState("");
  const [tripId, setTripId] = useState(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing edit invite token.");
      return;
    }

    let cancelled = false;

    async function run() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setStatus("need_login");
        return;
      }

      if (!cancelled) setStatus("joining");

      const res = await fetch("/api/trip-edit-link/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (cancelled) return;

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Could not join this trip.");
        return;
      }

      setTripId(data.tripId);
      setStatus("done");
      router.replace(`/trip/${data.tripId}`);
    }

    run().catch((err) => {
      if (!cancelled) {
        setStatus("error");
        setMessage(err.message || "Something went wrong.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const loginHref = `/auth/login?next=${encodeURIComponent(`/trip/join/${token}`)}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8FAFC] px-5 text-center">
      {status === "checking" || status === "joining" || status === "done" ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-[#F97316]" />
          <p className="text-sm text-[#64748B]">
            {status === "done"
              ? "Opening trip…"
              : status === "joining"
                ? "Joining as editor…"
                : "Checking invite…"}
          </p>
        </>
      ) : null}

      {status === "need_login" && (
        <>
          <h1 className="text-2xl font-bold text-[#0F172A]">Edit invite</h1>
          <p className="max-w-md text-sm text-[#64748B]">
            Sign in to accept this edit link. You&apos;ll be able to update the
            itinerary (and use AI chat if you&apos;re Pro). View-only links do
            not need this step.
          </p>
          <Link
            href={loginHref}
            className="rounded-xl bg-[#F97316] px-6 py-3 text-sm font-semibold text-white hover:bg-[#ea580c]"
          >
            Sign in to join
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <h1 className="text-2xl font-bold text-[#0F172A]">Invite unavailable</h1>
          <p className="max-w-md text-sm text-[#64748B]">{message}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {tripId && (
              <Link
                href={`/trip/${tripId}`}
                className="rounded-xl border border-[#E2E8F0] bg-white px-5 py-2.5 text-sm font-semibold text-[#0F172A]"
              >
                View trip
              </Link>
            )}
            <Link
              href="/my-trips"
              className="rounded-xl bg-[#F97316] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#ea580c]"
            >
              My Trips
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
