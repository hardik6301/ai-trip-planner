"use client";

/**
 * Travora Navbar — sticky top navigation with auth-aware actions.
 * Matches Stitch design: logo, Explore/My Trips links, sign-in or user menu.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

/** Nav link with orange underline when active (Stitch active state) */
function NavLink({ href, label, isActive, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`text-sm font-medium transition-colors duration-200 ${
        isActive
          ? "border-b-2 border-orange pb-0.5 font-bold text-navy"
          : "text-on-surface-variant hover:text-navy"
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

  // Supabase user session — null until client hydrates
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);
  // Mobile hamburger menu open state
  const [mobileOpen, setMobileOpen] = useState(false);
  // Avatar dropdown open state (logged-in users)
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Load session and subscribe to auth changes (avoids hydration mismatch)
  useEffect(() => {
    setMounted(true);
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  // Sign out — clear Supabase session and redirect home
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setDropdownOpen(false);
    router.push("/");
    router.refresh();
  }

  const isExploreActive = pathname === "/";
  const isMyTripsActive = pathname.startsWith("/my-trips");

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "";

  const avatarLetter = (displayName || user?.email || "U")
    .charAt(0)
    .toUpperCase();

  const isPro =
    user?.user_metadata?.plan === "pro" ||
    user?.app_metadata?.is_pro === true;

  // Render logged-out auth buttons until session is loaded (prevents flash)
  const showLoggedOut = mounted && !user;
  const showLoggedIn = mounted && user;

  return (
    <header className="fixed top-0 z-50 w-full border-b border-outline-variant/40 bg-white shadow-sm">
      <nav className="mx-auto grid h-16 max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center px-5 md:px-6">
        {/* Left — Travora logo */}
        <Link
          href="/"
          className="justify-self-start text-xl font-bold tracking-tight text-navy transition-opacity hover:opacity-80"
        >
          Travora
        </Link>

        {/* Center — desktop nav links */}
        <div className="hidden items-center gap-6 md:flex">
          <NavLink href="/" label="Explore" isActive={isExploreActive} />
          <NavLink
            href="/my-trips"
            label="My Trips"
            isActive={isMyTripsActive}
          />
        </div>

        {/* Right — auth actions (desktop) */}
        <div className="hidden items-center justify-self-end gap-3 md:flex">
          {!mounted && (
            <div className="h-9 w-24 animate-pulse rounded-full bg-navy-light" />
          )}

          {showLoggedOut && (
            <>
              <Button
                variant="ghost"
                size="md"
                onClick={() => router.push("/auth/login")}
              >
                Sign In
              </Button>
              <Button
                variant="primary"
                size="md"
                className="rounded-full shadow-md shadow-orange/20"
                onClick={() => router.push("/auth/signup")}
              >
                Start Free
              </Button>
            </>
          )}

          {showLoggedIn && (
            <div className="relative flex items-center gap-3" ref={menuRef}>
              {/* User name + Pro badge */}
              <div className="hidden items-center gap-2 lg:flex">
                <span className="max-w-[140px] truncate text-sm font-medium text-navy">
                  {displayName}
                </span>
                {isPro && <Badge variant="orange">Pro</Badge>}
              </div>

              {/* Avatar button — opens dropdown */}
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-navy text-sm font-bold text-white transition-transform active:scale-95"
                aria-label="User menu"
                aria-expanded={dropdownOpen}
              >
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={displayName}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  avatarLetter
                )}
              </button>

              {/* Dropdown menu */}
              {dropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-52 overflow-hidden rounded-xl border border-outline-variant/30 bg-white py-1 shadow-[var(--shadow-modal)]">
                  <div className="border-b border-outline-variant/30 px-4 py-3 lg:hidden">
                    <p className="truncate text-sm font-semibold text-navy">
                      {displayName}
                    </p>
                    {isPro && (
                      <Badge variant="orange" className="mt-1">
                        Pro
                      </Badge>
                    )}
                  </div>
                  <Link
                    href="/my-trips"
                    className="block px-4 py-2.5 text-sm text-on-surface-variant transition-colors hover:bg-navy-light hover:text-navy"
                    onClick={() => setDropdownOpen(false)}
                  >
                    My Trips
                  </Link>
                  <Link
                    href="/profile"
                    className="block px-4 py-2.5 text-sm text-on-surface-variant transition-colors hover:bg-navy-light hover:text-navy"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Profile
                  </Link>
                  {!isPro && (
                    <Link
                      href="/pricing"
                      className="block px-4 py-2.5 text-sm font-medium text-orange transition-colors hover:bg-orange-light"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Upgrade to Pro
                    </Link>
                  )}
                  <div className="my-1 border-t border-outline-variant/30" />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full cursor-pointer px-4 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile — hamburger toggle (right column on small screens) */}
        <button
          type="button"
          className="col-start-3 flex cursor-pointer items-center justify-end rounded-lg p-2 text-navy transition-colors hover:bg-navy-light md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          <span className="material-symbols-outlined text-[26px]">
            {mobileOpen ? "close" : "menu"}
          </span>
        </button>
      </nav>

      {/* Mobile — slide-down navigation panel */}
      {mobileOpen && (
        <div className="border-t border-outline-variant/40 bg-white px-5 py-4 md:hidden">
          <div className="flex flex-col gap-1">
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
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-outline-variant/30 pt-4">
            {showLoggedOut && (
              <>
                <Button
                  variant="ghost"
                  size="md"
                  fullWidth
                  onClick={() => {
                    setMobileOpen(false);
                    router.push("/auth/login");
                  }}
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={() => {
                    setMobileOpen(false);
                    router.push("/auth/signup");
                  }}
                >
                  Start Free
                </Button>
              </>
            )}

            {showLoggedIn && (
              <>
                <div className="mb-2 flex items-center gap-3 px-1">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                    {avatarLetter}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy">
                      {displayName}
                    </p>
                    {isPro && <Badge variant="orange">Pro</Badge>}
                  </div>
                </div>
                <Link
                  href="/profile"
                  className="rounded-lg px-3 py-2 text-sm text-on-surface-variant hover:bg-navy-light"
                  onClick={() => setMobileOpen(false)}
                >
                  Profile
                </Link>
                {!isPro && (
                  <Link
                    href="/pricing"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-orange hover:bg-orange-light"
                    onClick={() => setMobileOpen(false)}
                  >
                    Upgrade to Pro
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
