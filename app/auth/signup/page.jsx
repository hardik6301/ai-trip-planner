"use client";

/**
 * Signup page — email/password registration with full name for Travora.
 * Shows a success message after signup; user must confirm email before signing in.
 */

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

// Shared input styling matching the Travora trip form
const inputClassName =
  "w-full rounded-lg border-2 border-transparent bg-surface-container-low p-3 text-on-surface outline-none transition-all focus:border-primary focus:bg-white";

export default function SignupPage() {
  // Registration form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // True while the signup request is in progress
  const [loading, setLoading] = useState(false);
  // Error message shown below the form on signup failure
  const [error, setError] = useState("");
  // True after a successful signup — shows the check-email message
  const [success, setSuccess] = useState(false);

  // Create a new account with email, password, and display name metadata
  async function handleSignUp(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Show success message — user should confirm email before logging in
    setSuccess(true);
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-5 py-12 font-sans">
      {/* Auth card — centered signup form */}
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
            Create your account
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Start planning your next adventure with AI
          </p>
        </div>

        {/* Success message after signup */}
        {success ? (
          <div className="rounded-lg bg-primary-fixed/50 px-4 py-6 text-center">
            <span className="material-symbols-outlined mb-2 text-4xl text-primary">
              mark_email_read
            </span>
            <h2 className="text-lg font-semibold text-primary">
              Check your email
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              We sent a confirmation link to{" "}
              <span className="font-semibold text-on-surface">{email}</span>.
              Click the link to activate your account.
            </p>
            <Link
              href="/auth/login"
              className="mt-4 inline-block text-sm font-semibold text-primary hover:text-secondary"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {/* Registration form */}
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="fullName"
                  className="text-sm font-semibold text-on-surface-variant"
                >
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClassName}
                />
              </div>

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
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClassName}
                />
              </div>

              {/* Orange Travora CTA — create account */}
              <Button
                type="submit"
                disabled={loading}
                loading={loading}
                className="mt-0"
              >
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            {/* Signup error message */}
            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}
          </>
        )}

        {/* Link to login page */}
        {!success && (
          <p className="mt-6 text-center text-sm text-on-surface-variant">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-semibold text-primary hover:text-secondary"
            >
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
