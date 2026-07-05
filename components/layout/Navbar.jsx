"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Moon, Mountain, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchUserProStatus, isProUser } from "@/lib/userPlan";
import { resolveAvatarUrl, resolveDisplayName } from "@/lib/profile";
import { useTheme } from "@/hooks/useTheme";
import ProBadge from "@/components/ui/ProBadge";

function NavLink({ href, label, isActive, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`text-sm font-medium transition-colors ${
        isActive
          ? "border-b-2 border-[#F97316] pb-0.5 font-semibold text-[#F97316]"
          : "text-[#64748B] hover:text-[#0F172A]"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef(null);
  const { theme, toggleTheme } = useTheme();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  /** Load user session and Pro status from profiles.is_pro */
  async function loadAuthState(currentUser) {
    setUser(currentUser);

    if (currentUser) {
      const supabase = createClient();
      const { isPro: proStatus, profile: profileRow } = await fetchUserProStatus(
        supabase,
        currentUser.id
      );
      setProfile(profileRow);
      setIsPro(proStatus || isProUser(currentUser, profileRow));
    } else {
      setProfile(null);
      setIsPro(false);
    }
  }

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      loadAuthState(currentUser);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadAuthState(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setDropdownOpen(false);
    setIsPro(false);
    router.push("/");
    router.refresh();
  }

  const isExploreActive = pathname === "/";
  const isMyTripsActive =
    pathname.startsWith("/my-trips") ||
    pathname.startsWith("/results") ||
    pathname.startsWith("/trip/");

  const displayName = resolveDisplayName(profile, user);
  const avatarUrl = resolveAvatarUrl(profile, user);
  const avatarLetter = (displayName || "T").charAt(0).toUpperCase();
  const showLoggedOut = mounted && !user;
  const showLoggedIn = mounted && user;

  return (
    <header className="fixed top-0 z-50 w-full border-b border-[#E2E8F0] bg-white">
      <nav className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-[#1E3A8A] transition-opacity hover:opacity-80"
        >
          <Mountain className="h-6 w-6 stroke-[2.5]" aria-hidden="true" />
          <span className="text-xl font-bold tracking-tight text-[#0F172A]">
            Travora
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <NavLink href="/" label="Explore" isActive={isExploreActive} />
          <NavLink
            href="/my-trips"
            label="My Trips"
            isActive={isMyTripsActive}
          />
          <NavLink
            href="/pricing"
            label="Pricing"
            isActive={pathname === "/pricing"}
          />
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </button>

          {!mounted && (
            <div className="h-9 w-32 animate-pulse rounded-full bg-[#F1F5F9]" />
          )}

          {showLoggedOut && (
            <>
              <button
                type="button"
                onClick={() => router.push("/auth/login")}
                className="cursor-pointer text-sm font-medium text-[#0F172A] hover:text-[#1E3A8A]"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => router.push("/auth/signup")}
                className="cursor-pointer rounded-lg bg-[#1E3A8A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1e40af]"
              >
                Start Free
              </button>
            </>
          )}

          {showLoggedIn && (
            <div className="relative flex items-center gap-3" ref={menuRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex cursor-pointer items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-[#F8FAFC]"
                aria-label="User menu"
                aria-expanded={dropdownOpen}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F472B6] text-sm font-bold text-white">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    avatarLetter
                  )}
                </div>
                <span className="max-w-[100px] truncate text-sm font-medium text-[#0F172A]">
                  {displayName}
                </span>
                {isPro && <ProBadge />}
                <ChevronDown className="h-4 w-4 text-[#64748B]" />
              </button>

              {dropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-52 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-[var(--shadow-modal)]">
                  <Link
                    href="/profile"
                    className="block px-4 py-2.5 text-sm text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Profile & Settings
                  </Link>
                  <div className="my-1 border-t border-[#E2E8F0]" />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full cursor-pointer px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Sign Out
                  </button>
                </div>
              )}

              {!isPro && (
                <button
                  type="button"
                  onClick={() => router.push("/pricing")}
                  className="cursor-pointer rounded-lg bg-[#F97316] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c]"
                >
                  Upgrade to Pro
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="flex cursor-pointer items-center rounded-lg p-2 text-[#0F172A] md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          <span className="material-symbols-outlined text-[26px]">
            {mobileOpen ? "close" : "menu"}
          </span>
        </button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-[#E2E8F0] bg-white px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            <NavLink
              href="/"
              label="Explore"
              isActive={isExploreActive}
              onClick={() => setMobileOpen(false)}
            />
            <NavLink
              href="/my-trips"
              label="My Trips"
              isActive={isMyTripsActive}
              onClick={() => setMobileOpen(false)}
            />
            <NavLink
              href="/pricing"
              label="Pricing"
              isActive={pathname === "/pricing"}
              onClick={() => setMobileOpen(false)}
            />
            {showLoggedIn && (
              <>
                <NavLink
                  href="/profile"
                  label="Profile"
                  isActive={pathname === "/profile"}
                  onClick={() => setMobileOpen(false)}
                />
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    handleSignOut();
                  }}
                  className="cursor-pointer text-left text-sm font-medium text-red-600"
                >
                  Sign Out
                </button>
              </>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex cursor-pointer items-center gap-2 text-left text-sm font-medium text-[#64748B]"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-4 w-4" /> Light Mode
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" /> Dark Mode
                </>
              )}
            </button>
            {showLoggedIn && !isPro && (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  router.push("/pricing");
                }}
                className="mt-2 cursor-pointer rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
