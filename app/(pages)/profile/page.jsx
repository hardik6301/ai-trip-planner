"use client";

/**
 * Travora profile — account overview, travel stats, preferences, subscription.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Camera,
  Check,
  ChevronDown,
  Globe,
  Plane,
  Settings,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchUserProStatus, isProUser } from "@/lib/userPlan";
import {
  CURRENCY_OPTIONS,
  currencyLabel,
  resolveAvatarUrl,
  resolveDisplayName,
} from "@/lib/profile";
import ProBadge from "@/components/ui/ProBadge";
import { useToast } from "@/components/ui/Toast";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function extractCountry(destination) {
  if (!destination) return null;
  const parts = String(destination)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

function topRegionFromTrips(trips) {
  const counts = {};
  trips.forEach((trip) => {
    const region = extractCountry(trip.destination);
    if (region) counts[region] = (counts[region] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || "—";
}

function formatProDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:gap-4 sm:p-4">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${accent}`}
      >
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold tracking-wider text-[#94A3B8] uppercase sm:text-[10px]">
          {label}
        </p>
        <p className="truncate text-lg font-bold text-[#0F172A] sm:text-xl">
          {value}
        </p>
      </div>
    </div>
  );
}

/** Upload avatar to Supabase Storage; returns public URL */
async function uploadAvatar(userId, file) {
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw new Error(error.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  return `${publicUrl}?v=${Date.now()}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [trips, setTrips] = useState([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatarPreview, setEditAvatarPreview] = useState(null);
  const [editAvatarFile, setEditAvatarFile] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [cancelProOpen, setCancelProOpen] = useState(false);
  const [cancellingPro, setCancellingPro] = useState(false);

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

  const displayName = resolveDisplayName(profile, user);
  const email = user?.email || profile?.email || "";
  const avatarUrl = resolveAvatarUrl(profile, user);
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const currency = profile?.currency || "INR";
  const newsletterOn = profile?.newsletter_opt_in !== false;

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
    setEditAvatarPreview(avatarUrl);
    setEditAvatarFile(null);
    setEditOpen(true);
  }

  function closeEditProfile() {
    if (editAvatarFile && editAvatarPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editAvatarPreview);
    }
    setEditOpen(false);
    setEditAvatarFile(null);
  }

  function handleAvatarPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!AVATAR_TYPES.includes(file.type)) {
      showToast("Use JPG, PNG, WebP, or GIF", "error");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      showToast("Image must be under 2 MB", "error");
      return;
    }

    if (editAvatarPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editAvatarPreview);
    }

    setEditAvatarFile(file);
    setEditAvatarPreview(URL.createObjectURL(file));
    e.target.value = "";
  }

  async function patchProfile(body) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.details || data.error || "Update failed");
    }
    return data.profile;
  }

  async function handleSaveProfile() {
    if (!user || !editName.trim()) return;
    setSavingProfile(true);

    try {
      const payload = { full_name: editName.trim() };

      if (editAvatarFile) {
        payload.avatar_url = await uploadAvatar(user.id, editAvatarFile);
      }

      const updated = await patchProfile(payload);
      setProfile((p) => ({ ...p, ...updated }));

      // Refresh session so navbar picks up new name/avatar
      const supabase = createClient();
      const { data: { user: refreshed } } = await supabase.auth.getUser();
      if (refreshed) setUser(refreshed);

      closeEditProfile();
      showToast("Profile updated", "success");
      router.refresh();
    } catch (err) {
      showToast(err.message || "Could not save profile", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleCurrencyChange(code) {
    if (code === currency || savingPrefs) return;
    setSavingPrefs(true);
    setCurrencyOpen(false);

    try {
      const updated = await patchProfile({ currency: code });
      setProfile((p) => ({ ...p, ...updated }));
      showToast("Currency updated", "success");
    } catch (err) {
      showToast(err.message || "Could not update currency", "error");
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleToggleNewsletter() {
    if (savingPrefs) return;
    setSavingPrefs(true);

    try {
      const updated = await patchProfile({ newsletter_opt_in: !newsletterOn });
      setProfile((p) => ({ ...p, ...updated }));
      showToast(
        updated.newsletter_opt_in ? "Newsletter enabled" : "Newsletter disabled",
        "success"
      );
    } catch (err) {
      showToast(err.message || "Could not update preference", "error");
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleCancelPro() {
    setCancellingPro(true);

    try {
      const res = await fetch("/api/profile/cancel-pro", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || "Could not cancel Pro");
      }

      setIsPro(false);
      setProfile((p) => ({ ...p, is_pro: false }));
      setCancelProOpen(false);
      showToast("Pro cancelled — you're on the Free plan", "success");
      router.refresh();
    } catch (err) {
      showToast(err.message || "Could not cancel Pro", "error");
    } finally {
      setCancellingPro(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE") return;
    setDeletingAccount(true);

    try {
      const res = await fetch("/api/profile/delete-account", { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || "Deletion failed");
      }

      showToast("Account deleted", "success");
      router.push("/");
      router.refresh();
    } catch (err) {
      showToast(err.message || "Could not delete account", "error");
    } finally {
      setDeletingAccount(false);
      setDeleteOpen(false);
      setDeleteConfirm("");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center bg-[#F8FAFC] sm:min-h-[calc(100dvh-72px)]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E2E8F0] border-t-[#F97316]" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-64px)] overflow-x-hidden bg-[#F8FAFC] pb-12 pt-6 sm:min-h-[calc(100dvh-72px)] sm:pb-16 sm:pt-8">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-5 px-4 sm:gap-6 sm:px-6 lg:grid-cols-12 lg:gap-8">
        <aside className="space-y-4 sm:space-y-5 lg:col-span-4">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 text-center shadow-[0_4px_24px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="relative mx-auto mb-4 h-20 w-20 sm:h-24 sm:w-24">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#F472B6] text-2xl font-bold text-white sm:text-3xl">
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

            <h1 className="truncate text-lg font-bold text-[#0F172A]">
              {displayName}
            </h1>
            <p className="mt-1 truncate text-sm text-[#64748B]">{email}</p>

            <button
              type="button"
              onClick={openEditProfile}
              className="mt-4 min-h-11 w-full cursor-pointer rounded-xl bg-[#EFF6FF] py-2.5 text-sm font-semibold text-[#1E3A8A] transition-colors hover:bg-[#DBEAFE] sm:mt-5"
            >
              Edit Profile
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3 lg:grid-cols-1 lg:gap-5">
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
          </div>
        </aside>

        <div className="space-y-4 sm:space-y-6 lg:col-span-8">
          <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] p-5 text-white shadow-[0_8px_32px_rgba(30,58,138,0.25)] sm:p-8">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl md:text-[28px]">
              Your Travel Stats
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/90 sm:mt-3 md:text-base">
              {stats.totalTrips > 0
                ? `You've saved ${stats.totalTrips} trip${stats.totalTrips !== 1 ? "s" : ""} and planned ${stats.daysPlanned} days across ${stats.countriesPlanned} ${stats.countriesPlanned === 1 ? "country" : "countries"} with Travora AI.`
                : "Start planning your first trip — Travora AI will craft a full itinerary in under 2 minutes."}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/20 pt-5 sm:mt-8 sm:pt-6">
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-wider text-white/70 uppercase">
                  Top Region
                </p>
                <p className="mt-1 truncate text-sm font-semibold">
                  {stats.topRegion}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-wider text-white/70 uppercase">
                  AI Itineraries
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {stats.totalTrips} generated
                </p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)] sm:p-6">
              <div className="mb-4 flex items-center gap-2 sm:mb-5">
                <Settings className="h-5 w-5 text-[#1E3A8A]" />
                <h3 className="text-base font-bold text-[#0F172A]">Preferences</h3>
              </div>

              <div className="space-y-4">
                <div className="relative flex items-center justify-between border-b border-[#F1F5F9] pb-4">
                  <span className="text-sm text-[#64748B]">Currency</span>
                  <button
                    type="button"
                    onClick={() => setCurrencyOpen((o) => !o)}
                    disabled={savingPrefs}
                    className="flex cursor-pointer items-center gap-1 text-sm font-semibold text-[#1E3A8A] disabled:opacity-60"
                  >
                    {currencyLabel(currency)}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {currencyOpen && (
                    <div className="absolute top-full right-0 z-10 mt-1 w-36 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg">
                      {CURRENCY_OPTIONS.map((opt) => (
                        <button
                          key={opt.code}
                          type="button"
                          onClick={() => handleCurrencyChange(opt.code)}
                          className={`block w-full cursor-pointer px-4 py-2 text-left text-sm hover:bg-[#F8FAFC] ${
                            opt.code === currency
                              ? "font-semibold text-[#1E3A8A]"
                              : "text-[#64748B]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
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
                    aria-checked={newsletterOn}
                    disabled={savingPrefs}
                    onClick={handleToggleNewsletter}
                    className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors disabled:opacity-60 ${
                      newsletterOn ? "bg-[#1E3A8A]" : "bg-[#CBD5E1]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        newsletterOn ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#FECACA] bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)] sm:p-6">
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
                onClick={() => {
                  setDeleteConfirm("");
                  setDeleteOpen(true);
                }}
                className="min-h-11 w-full cursor-pointer rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
              >
                Delete Account
              </button>
            </section>
          </div>

          <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#F97316] to-[#FB923C] p-5 text-white shadow-[0_8px_32px_rgba(249,115,22,0.3)] sm:p-8">
            <div className="flex flex-col gap-5 sm:gap-6 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                  {isPro ? "You're on Travora Pro" : "Maximize Your Journeys"}
                </h2>

                {isPro ? (
                  <>
                    <p className="mt-3 text-sm text-white/95">
                      You are currently a <strong>Pro Member</strong>
                      {profile?.pro_since
                        ? ` (since ${formatProDate(profile.pro_since)}).`
                        : "."}{" "}
                      Pro is a one-time unlock — no recurring charges.
                    </p>
                    <p className="mt-2 text-xs text-white/80">
                      Cancel anytime to return to Free limits. Your saved trips
                      stay, but new saves follow the 5-trip cap.
                    </p>
                  </>
                ) : (
                  <ul className="mt-4 space-y-2 text-sm text-white/95">
                    {[
                      "Unlimited saved trips & regenerations",
                      "AI chat editor & expense tracker",
                      "Calendar export & offline travel pack",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {isPro ? (
                <button
                  type="button"
                  onClick={() => setCancelProOpen(true)}
                  className="inline-flex min-h-12 w-full shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20 md:w-auto"
                >
                  Cancel Pro
                </button>
              ) : (
                <Link
                  href="/pricing"
                  className="inline-flex min-h-12 w-full shrink-0 cursor-pointer items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#F97316] shadow-md transition-colors hover:bg-[#FFF7ED] md:w-auto"
                >
                  Upgrade to Pro
                </Link>
              )}
            </div>
          </section>

          {!isPro && (
            <p className="flex items-start justify-center gap-2 px-2 text-center text-xs text-[#64748B] sm:items-center sm:text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#F97316] sm:mt-0" />
              Pro unlocks unlimited trips, AI chat editor, expenses, and offline packs.
            </p>
          )}
        </div>
      </div>

      {/* Edit profile modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[#E2E8F0] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#0F172A]">Edit Profile</h3>
              <button
                type="button"
                onClick={closeEditProfile}
                className="cursor-pointer rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-5 flex flex-col items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative cursor-pointer"
                aria-label="Change profile photo"
              >
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#F472B6] text-2xl font-bold text-white">
                  {editAvatarPreview ? (
                    <img
                      src={editAvatarPreview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    editName.charAt(0).toUpperCase() || "T"
                  )}
                </div>
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-6 w-6 text-white" />
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={AVATAR_TYPES.join(",")}
                className="hidden"
                onChange={handleAvatarPick}
              />
              <p className="mt-2 text-xs text-[#94A3B8]">JPG, PNG or WebP · max 2 MB</p>
            </div>

            <label className="mb-1 block text-sm font-medium text-[#64748B]">
              Display name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={80}
              className="mb-4 w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-base text-[#0F172A] outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/20 sm:py-2.5 sm:text-sm"
            />

            <label className="mb-1 block text-sm font-medium text-[#64748B]">
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="mb-5 w-full cursor-not-allowed rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-base text-[#94A3B8] sm:py-2.5 sm:text-sm"
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
              <button
                type="button"
                onClick={closeEditProfile}
                disabled={savingProfile}
                className="min-h-11 flex-1 cursor-pointer rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={savingProfile || !editName.trim()}
                className="min-h-11 flex-1 cursor-pointer rounded-xl bg-[#1E3A8A] py-2.5 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60"
              >
                {savingProfile ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete account confirmation */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-red-200 bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-red-600">Delete Account</h3>
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="cursor-pointer rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-sm leading-relaxed text-[#64748B]">
              This permanently deletes your account, all saved trips, and Pro
              status. Type <strong className="text-[#0F172A]">DELETE</strong> to
              confirm.
            </p>

            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE"
              className="mb-5 w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-base text-[#0F172A] outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 sm:py-2.5 sm:text-sm"
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={deletingAccount}
                className="min-h-11 flex-1 cursor-pointer rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirm !== "DELETE"}
                className="min-h-11 flex-1 cursor-pointer rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingAccount ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Pro confirmation */}
      {cancelProOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[#E2E8F0] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#0F172A]">Cancel Pro?</h3>
              <button
                type="button"
                onClick={() => setCancelProOpen(false)}
                className="cursor-pointer rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-5 text-sm leading-relaxed text-[#64748B]">
              You&apos;ll return to the Free plan: 5 saved trips and 3 day
              regenerations per trip. Your existing trips stay saved. This is a
              one-time payment — no refund is issued.
            </p>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
              <button
                type="button"
                onClick={() => setCancelProOpen(false)}
                disabled={cancellingPro}
                className="min-h-11 flex-1 cursor-pointer rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-60"
              >
                Keep Pro
              </button>
              <button
                type="button"
                onClick={handleCancelPro}
                disabled={cancellingPro}
                className="min-h-11 flex-1 cursor-pointer rounded-xl bg-[#1E3A8A] py-2.5 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60"
              >
                {cancellingPro ? "Cancelling…" : "Cancel Pro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
