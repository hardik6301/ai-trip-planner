"use client";

/**
 * Travora pricing — Free vs Pro with Razorpay checkout.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchUserProStatus, isProUser } from "@/lib/userPlan";
import { loadRazorpayScript } from "@/utils/loadRazorpay";
import { useToast } from "@/components/ui/Toast";

/** Free tier feature list — only features that actually ship */
const FREE_FEATURES = [
  "AI itinerary generation (Gemini)",
  "Save up to 5 trips",
  "3 day regenerations per trip",
  "PDF itinerary export",
  "Shareable trip links + WhatsApp",
  "Google Maps links on activities",
  "Live weather & currency",
  "Real destination photos",
];

/** Pro tier extras (shown as "Everything in Free PLUS") */
const PRO_FEATURES = [
  "Unlimited saved trips",
  "Unlimited day regenerations",
  "AI chat editor (edit days by chat)",
  "Expense tracker + budget analytics",
  "Custom activity builder",
  "Google Calendar export (.ics)",
  "Offline travel pack (PDF + QR + maps)",
];

/** FAQ accordion content */
const FAQ_ITEMS = [
  {
    question: "Can I cancel Pro anytime?",
    answer:
      "Yes — cancel from your Profile page. You keep saved trips but return to Free limits (5 trips, 3 regenerations per trip). Pro is a one-time payment with no refund.",
  },
  {
    question: "Is Pro a subscription?",
    answer:
      "No. Pro is a one-time ₹199 unlock. There are no recurring charges or auto-renewals.",
  },
  {
    question: "What is an unlimited trip?",
    answer: "Save as many trips as you want while you have Pro active.",
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [user, setUser] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [upgradeState, setUpgradeState] = useState("idle");

  /** Load auth user + Pro status from profiles.is_pro */
  const loadUserAndPlan = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    setUser(currentUser);

    if (currentUser) {
      const { isPro: proStatus } = await fetchUserProStatus(
        supabase,
        currentUser.id
      );
      setIsPro(proStatus || isProUser(currentUser));
    } else {
      setIsPro(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    loadUserAndPlan();
  }, [loadUserAndPlan]);

  /** Full Razorpay checkout flow */
  async function handleUpgrade() {
    // Require sign-in before payment
    if (!user) {
      router.push("/auth/login?redirect=/pricing");
      return;
    }

    if (isPro || upgradeState !== "idle") return;

    setUpgradeState("loading");

    try {
      // 1. Create Razorpay order on the server
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
      });
      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        throw new Error(
          orderData.details
            ? `${orderData.error} — ${orderData.details}`
            : orderData.error || "Could not start checkout"
        );
      }

      // 2. Load Razorpay checkout script
      await loadRazorpayScript();

      const displayName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "";

      // 3. Open Razorpay modal
      const rzp = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Travora",
        description: "Travora Pro (one-time unlock)",
        order_id: orderData.orderId,
        prefill: {
          name: displayName,
          email: user.email || "",
        },
        theme: { color: "#F97316" },
        handler: async (response) => {
          setUpgradeState("verifying");

          try {
            // 4. Verify payment signature on the server
            const verifyRes = await fetch("/api/razorpay/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                userId: user.id,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(
                verifyData.details
                  ? `${verifyData.error} — ${verifyData.details}`
                  : verifyData.error || "Payment verification failed"
              );
            }

            // 5. Success — refresh Pro status
            showToast("Welcome to Pro! 🎉", "success");
            setIsPro(true);
            await loadUserAndPlan();
            router.refresh();
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : "Verification failed",
              "error"
            );
          } finally {
            setUpgradeState("idle");
          }
        },
        modal: {
          ondismiss: () => {
            setUpgradeState("idle");
          },
        },
      });

      rzp.on("payment.failed", (response) => {
        setUpgradeState("idle");
        showToast(
          response.error?.description || "Payment failed. Please try again.",
          "error"
        );
      });

      rzp.open();
    } catch (err) {
      setUpgradeState("idle");
      showToast(
        err instanceof Error ? err.message : "Could not open checkout",
        "error"
      );
    }
  }

  const upgradeLabel =
    upgradeState === "loading"
      ? "Opening checkout..."
      : upgradeState === "verifying"
        ? "Processing..."
        : "Upgrade to Pro →";

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#FAFAF9] pb-20 pt-12">
      <div className="mx-auto max-w-[960px] px-6">
        {/* ─── Header ─── */}
        <header className="mb-12 text-center">
          <h1 className="text-[32px] font-bold tracking-tight text-[#1E3A8A] md:text-[36px]">
            Simple, transparent pricing
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#64748B]">
            Plan your dream adventures with precision. Choose the plan that best
            fits your travel frequency and planning style.
          </p>
        </header>

        {/* ─── Plan cards ─── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          {/* FREE card */}
          <article className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-bold tracking-wide text-[#1E3A8A] uppercase">
              Free
            </p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-[40px] font-bold leading-none text-[#0F172A]">
                ₹0
              </span>
              <span className="text-sm text-[#64748B]">forever</span>
            </div>

            <ul className="mt-8 flex-1 space-y-3.5">
              {FREE_FEATURES.map((label) => (
                <li
                  key={label}
                  className="flex items-center gap-3 text-sm text-[#0F172A]"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#1E3A8A]" />
                  {label}
                </li>
              ))}
            </ul>

            {/* Free CTA — depends on auth + plan */}
            {!mounted ? (
              <div className="mt-8 h-[50px] animate-pulse rounded-xl bg-[#F1F5F9]" />
            ) : !user ? (
              <Link
                href="/auth/signup"
                className="mt-8 flex w-full items-center justify-center rounded-xl border-2 border-[#1E3A8A] py-3.5 text-sm font-semibold text-[#1E3A8A] transition-colors hover:bg-[#EFF6FF]"
              >
                Get Started Free
              </Link>
            ) : !isPro ? (
              <button
                type="button"
                disabled
                className="mt-8 w-full cursor-default rounded-xl border-2 border-[#E2E8F0] bg-[#F8FAFC] py-3.5 text-sm font-semibold text-[#64748B]"
              >
                Current Plan
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="mt-8 w-full cursor-default rounded-xl border-2 border-[#E2E8F0] py-3.5 text-sm font-semibold text-[#64748B]"
              >
                Included with Pro
              </button>
            )}
          </article>

          {/* PRO card */}
          <article className="relative flex flex-col rounded-2xl border-2 border-[#F97316] bg-white p-8 shadow-[0_8px_32px_rgba(249,115,22,0.15)]">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#F97316] px-4 py-1 text-xs font-semibold text-white">
              Most Popular
            </span>

            <p className="text-sm font-bold tracking-wide text-[#C2410C] uppercase">
              Pro
            </p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-[40px] font-bold leading-none text-[#0F172A]">
                ₹199
              </span>
              <span className="text-sm text-[#64748B]">one-time</span>
            </div>
            <p className="mt-2 text-xs text-[#94A3B8]">
              Pay once, unlock Pro features. Cancel anytime from Profile.
            </p>

            <p className="mt-6 text-sm font-medium text-[#64748B]">
              Everything in free, plus:
            </p>
            <ul className="mt-4 flex-1 space-y-3.5">
              {PRO_FEATURES.map((label) => (
                <li
                  key={label}
                  className="flex items-center gap-3 text-sm text-[#0F172A]"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#F97316]" />
                  {label}
                </li>
              ))}
            </ul>

            {/* Pro CTA — current plan or upgrade */}
            {!mounted ? (
              <div className="mt-8 h-[50px] animate-pulse rounded-xl bg-[#F1F5F9]" />
            ) : isPro ? (
              <div className="mt-8 space-y-2">
                <button
                  type="button"
                  disabled
                  className="w-full cursor-default rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white"
                >
                  Current Plan ✓
                </button>
                <p className="text-center text-xs text-[#64748B]">
                  Manage or cancel in{" "}
                  <Link
                    href="/profile"
                    className="font-semibold text-[#1E3A8A] hover:underline"
                  >
                    Profile
                  </Link>
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={upgradeState !== "idle"}
                className="mt-8 w-full cursor-pointer rounded-xl bg-[#F97316] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {upgradeLabel}
              </button>
            )}
          </article>
        </div>

        {/* ─── FAQ accordion ─── */}
        <section className="mt-20">
          <h2 className="mb-8 text-center text-xl font-bold text-[#1E3A8A]">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-[#E2E8F0] border-y border-[#E2E8F0]">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={item.question}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-medium text-[#0F172A] md:text-base">
                      {item.question}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-[#64748B] transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="pb-5 text-sm leading-relaxed text-[#64748B]">
                      {item.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
