"use client";

/**
 * Travora profile — account overview, travel stats, preferences, subscription.
 * Matches Stitch reference layout; wired to Supabase auth + trips data.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Check,
  Globe,
  Plane,
  Settings,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchUserProStatus, isProUser } from "@/lib/userPlan";
import ProBadge from "@/components/ui/ProBadge";
import { useToast } from "@/components/ui/Toast";

const PREFS_KEY = "travoraProfilePrefs";

/** Extract country/region from destination string */
function extractCountry(destination) {
  if (!destination) return null;
  const parts = String(destination)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

/** Most frequent country across saved trips */
function topRegionFromTrips(trips) {
  const counts = {};
  trips.forEach((trip) => {
    const region = extractCountry(trip.destination);
    if (region) counts[region] = (counts[region] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || "—";
}

/** Read/writes UI preferences from localStorage */
function loadPrefs() {
  if (typeof window === "undefined") {
    return { currency: "INR (₹)", newsletter: true };
  }
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { currency: "INR (₹)", newsletter: true };
}

function savePrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function formatProDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Small stat card in left column */
function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] font-bold tracking-wider text-[#94A3B8] uppercase">
          {label}
        </p>
        <p className="text-xl font-bold text-[#0F172A]">{value}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [trips, setTrips] = useState([]);
  const [prefs, setPrefs] = useState({ currency: "INR (₹)", newsletter: true });

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      router.replace("/auth/login?redirect=/profile");
      return;
    }

    setUser(currentUser);
    setPrefs(loadPrefs());

    const { isPro: proStatus, profile: profileRow } = await fetchUserProStatus(
      supabase,
      currentUser.id
    );
    setIsPro(proStatus || isProUser(currentUser, profileRow));
    setProfile(profileRow);

    const { data: tripRows } = await supabase
      .from("trips")
      .select("id, destination, days, itinerary, created_at")
      .eq("user_id", currentUser.id);

    setTrips(tripRows ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Traveler";

  const email = user?.email || profile?.email || "";
  const avatarUrl = user?.user_metadata?.avatar_url || profile?.avatar_url;
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const stats = useMemo(() => {
    const totalTrips = trips.length;
    const countries = new Set(
      trips.map((t) => extractCountry(t.destination)).filter(Boolean)
    );
    const daysPlanned = trips.reduce(
      (sum, t) => sum + (t.days || t.itinerary?.days?.length || 0),
      0
    );
    const topRegion = topRegionFromTrips(trips);

    return {
      totalTrips,
      countriesPlanned: countries.size,
      daysPlanned,
      topRegion,
    };
  }, [trips]);

  function openEditProfile() {
    setEditName(displayName);
    setEditOpen(true);
  }

  async function handleSaveProfile() {
    if (!user || !editName.trim()) return;
    setSavingProfile(true);

    const supabase = createClient();
    const name = editName.trim();

    await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        full_name: name,
      },
      { onConflict: "id" }
    );

    await supabase.auth.updateUser({
      data: { full_name: name, name },
    });

    setProfile((p) => ({ ...p, full_name: name }));
    setSavingProfile(false);
    setEditOpen(false);
    showToast("Profile updated", "success");
  }

  function toggleNewsletter() {
    const next = { ...prefs, newsletter: !prefs.newsletter };
    setPrefs(next);
    savePrefs(next);
  }

  function handleDeleteAccount() {
    const confirmed = window.confirm(
      "Delete your Travora account? This will sign you out. Contact support to permanently remove all data."
    );
    if (!confirmed) return;

    createClient()
      .auth.signOut()
      .then(() => {
        showToast("Signed out. Email support to complete account deletion.", "info");
        router.push("/");
      });
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-[#F8FAFC]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E2E8F0] border-t-[#F97316]" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#F8FAFC] pb-16 pt-8">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-6 lg:grid-cols-12">
        {/* ─── Left column — identity + quick stats ─── */}
        <aside className="space-y-5 lg:col-span-4">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 text-center shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
            <div className="relative mx-auto mb-4 h-24 w-24">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#F472B6] text-3xl font-bold text-white">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  avatarLetter
                )}
              </div>
              {isPro && (
                <span className="absolute -right-1 bottom-0">
                  <ProBadge className="px-2.5 py-1 text-[11px]" />
                </span>
              )}
            </div>

            <h1 className="text-lg font-bold text-[#0F172A]">{displayName}</h1>
            <p className="mt-1 truncate text-sm text-[#64748B]">{email}</p>

            <button
              type="button"
              onClick={openEditProfile}
              className="mt-5 w-full cursor-pointer rounded-xl bg-[#EFF6FF] py-2.5 text-sm font-semibold text-[#1E3A8A] transition-colors hover:bg-[#DBEAFE]"
            >
              Edit Profile
            </button>
          </div>

          <StatCard
            icon={Plane}
            label="Total Trips"
            value={stats.totalTrips}
            accent="bg-[#FFF7ED] text-[#F97316]"
          />
          <StatCard
            icon={Globe}
            label="Countries Planned"
            value={stats.countriesPlanned}
            accent="bg-[#EFF6FF] text-[#1E3A8A]"
          />
          <StatCard
            icon={Calendar}
            label="Days Planned"
            value={stats.daysPlanned}
            accent="bg-[#F5F3FF] text-[#7C3AED]"
          />
        </aside>

        {/* ─── Right column — stats banner, settings, subscription ─── */}
        <div className="space-y-6 lg:col-span-8">
          {/* Travel stats gradient banner */}
          <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] p-8 text-white shadow-[0_8px_32px_rgba(30,58,138,0.25)]">
            <h2 className="text-2xl font-bold tracking-tight md:text-[28px]">
              Your Travel Stats
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/90 md:text-base">
              {stats.totalTrips > 0
                ? `You've saved ${stats.totalTrips} trip${stats.totalTrips !== 1 ? "s" : ""} and planned ${stats.daysPlanned} days across ${stats.countriesPlanned} ${stats.countriesPlanned === 1 ? "country" : "countries"} with Travora AI.`
                : "Start planning your first trip — Travora AI will craft a full itinerary in under 2 minutes."}
            </p>
            <div className="mt-8 grid grid-cols-1 gap-4 border-t border-white/20 pt-6 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold tracking-wider text-white/70 uppercase">
                  Top Region
                </p>
                <p className="mt-1 text-sm font-semibold">{stats.topRegion}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-white/70 uppercase">
                  AI Itineraries
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {stats.totalTrips} generated
                </p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Preferences */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
              <div className="mb-5 flex items-center gap-2">
                <Settings className="h-5 w-5 text-[#1E3A8A]" />
                <h3 className="text-base font-bold text-[#0F172A]">Preferences</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
                  <span className="text-sm text-[#64748B]">Currency</span>
                  <span className="text-sm font-semibold text-[#1E3A8A]">
                    {prefs.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
                  <span className="text-sm text-[#64748B]">AI Model</span>
                  <span className="text-sm font-semibold text-[#F97316]">
                    Travora AI
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#64748B]">Newsletter</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs.newsletter}
                    onClick={toggleNewsletter}
                    className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${
                      prefs.newsletter ? "bg-[#1E3A8A]" : "bg-[#CBD5E1]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        prefs.newsletter ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>

            {/* Danger zone */}
            <section className="rounded-2xl border border-[#FECACA] bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
              <div className="mb-4 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-500" />
                <h3 className="text-base font-bold text-red-600">Danger Zone</h3>
              </div>
              <p className="mb-5 text-sm leading-relaxed text-[#64748B]">
                Permanently delete your account and all travel history. This
                action is irreversible.
              </p>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="w-full cursor-pointer rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
              >
                Delete Account
              </button>
            </section>
          </div>

          {/* Subscription banner */}
          <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#F97316] to-[#FB923C] p-8 text-white shadow-[0_8px_32px_rgba(249,115,22,0.3)]">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold tracking-tight">
                  {isPro ? "You're on Travora Pro" : "Maximize Your Journeys"}
                </h2>

                {isPro ? (
                  <p className="mt-3 text-sm text-white/95">
                    You are currently a{" "}
                    <strong>Pro Member</strong>
                    {profile?.pro_since
                      ? `. Pro since ${formatProDate(profile.pro_since)}.`
                      : "."}
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2 text-sm text-white/95">
                    {[
                      "Unlimited saved trips",
                      "Unlimited day regenerations",
                      "AI chat editor & budget analytics",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Link
                href="/pricing"
                className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#F97316] shadow-md transition-colors hover:bg-[#FFF7ED]"
              >
                {isPro ? "Manage Subscription" : "Upgrade to Pro"}
              </Link>
            </div>
          </section>

          {!isPro && (
            <p className="flex items-center justify-center gap-2 text-center text-sm text-[#64748B]">
              <Sparkles className="h-4 w-4 text-[#F97316]" />
              Pro unlocks unlimited trips, regenerations, and priority AI.
            </p>
          )}
        </div>
      </div>

      {/* Edit profile modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#0F172A]">Edit Profile</h3>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="cursor-pointer rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mb-1 block text-sm font-medium text-[#64748B]">
              Display name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mb-5 w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-[#0F172A] outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/20"
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="flex-1 cursor-pointer rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={savingProfile || !editName.trim()}
                className="flex-1 cursor-pointer rounded-xl bg-[#1E3A8A] py-2.5 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60"
              >
                {savingProfile ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
