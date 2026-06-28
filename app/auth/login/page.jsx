"use client";

/**
 * Login page — Google OAuth and email/password sign-in for Travora.
 * Redirects to /my-trips after a successful login.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { parseAuthErrorFromHash } from "@/utils/parseAuthError";

// Shared input styling matching the Travora trip form
const inputClassName =
  "w-full rounded-lg border-2 border-transparent bg-surface-container-low p-3 text-on-surface outline-none transition-all focus:border-primary focus:bg-white";

export default function LoginPage() {
  const router = useRouter();

  // Email/password form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // True while an auth request is in progress
  const [loading, setLoading] = useState(false);
  // Error message shown below the form on auth failure
  const [error, setError] = useState("");

  // Show errors — prefer hash (specific OAuth errors) over generic query message
  useEffect(() => {
    const hashError = parseAuthErrorFromHash(window.location.hash);
    if (hashError) {
      setError(hashError);
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const queryError = params.get("error");
    if (queryError) {
      setError(queryError);
    }
  }, []);

  // Redirect the user to Google OAuth via Supabase
  async function handleGoogleSignIn() {
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  // Sign in with email and password, then redirect to saved trips
  async function handleEmailSignIn(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/my-trips");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-5 py-12 font-sans">
      {/* Auth card — centered login form */}
      <div className="w-full max-w-md rounded-xl border border-outline-variant/30 bg-white p-8 shadow-2xl">
        {/* Page heading */}
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-2xl font-semibold tracking-tight text-primary"
          >
            Travora
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-on-surface">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Sign in to access your saved trips
          </p>
        </div>

        {/* Google OAuth button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-outline-variant/50 bg-white py-3 text-sm font-semibold text-on-surface shadow-sm transition-all hover:bg-surface-container-low active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </button>

        {/* Divider between OAuth and email login */}
        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-outline-variant/40" />
          <span className="text-xs font-medium text-on-surface-variant">
            or continue with email
          </span>
          <div className="h-px flex-1 bg-outline-variant/40" />
        </div>

        {/* Email/password sign-in form */}
        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="text-sm font-semibold text-on-surface-variant"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="text-sm font-semibold text-on-surface-variant"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClassName}
            />
          </div>

          {/* Orange Travora CTA — email sign-in */}
          <Button
            type="submit"
            disabled={loading}
            loading={loading}
            fullWidth
            className="mt-0"
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        {/* Auth error message */}
        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Link to signup page */}
        <p className="mt-6 text-center text-sm text-on-surface-variant">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/signup"
            className="font-semibold text-primary hover:text-secondary"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
