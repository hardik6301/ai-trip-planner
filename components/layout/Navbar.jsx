/**
 * Fixed glass navbar shared across pages with home and default variants.
 * Home variant highlights the Home link; default variant links the logo to "/".
 */

import Link from "next/link";

export default function Navbar({ variant = "default" }) {
  const isHome = variant === "home";

  return (
    <header className="glass-panel fixed top-0 left-0 z-50 w-full border-b border-outline-variant/30 shadow-sm">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-5 py-4 md:px-12">
        {isHome ? (
          <span className="text-2xl font-semibold tracking-tight text-primary">
            Travora
          </span>
        ) : (
          <Link
            href="/"
            className="text-2xl font-semibold tracking-tight text-primary"
          >
            Travora
          </Link>
        )}

        {isHome && (
          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="/"
              className="border-b-2 border-primary text-base font-bold text-primary transition-colors"
            >
              Home
            </Link>
            <Link
              href="/my-trips"
              className="text-base text-on-surface-variant transition-colors hover:text-secondary"
            >
              My Trips
            </Link>
          </nav>
        )}

        <div className="flex items-center gap-4">
          {isHome ? (
            <Link
              href="/my-trips"
              className="hidden text-base text-primary transition-colors hover:text-secondary md:block"
            >
              My Trips
            </Link>
          ) : (
            <Link
              href="/my-trips"
              className="text-base text-on-surface-variant transition-colors hover:text-secondary"
            >
              My Trips
            </Link>
          )}
          <Link
            href="/auth/login"
            className="px-4 py-2 text-base text-primary transition-colors hover:text-secondary active:scale-95"
          >
            Sign In
          </Link>
        </div>
      </div>
    </header>
  );
}
