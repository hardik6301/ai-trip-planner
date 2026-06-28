/**
 * OAuth callback route — Google (and other providers) redirect here after sign-in.
 * Exchanges the authorization code for a Supabase session, then redirects the user.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  // Authorization code returned by the OAuth provider
  const code = searchParams.get("code");
  // OAuth error params (Supabase sends these when signup/login fails)
  const oauthError =
    searchParams.get("error_description") || searchParams.get("error");
  // Default destination after a successful OAuth login
  const next = searchParams.get("next") ?? "/my-trips";

  // OAuth failed before a code was issued (e.g. database error saving user)
  if (oauthError && !code) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(oauthError.replace(/\+/g, " "))}`
    );
  }

  if (code) {
    const supabase = await createClient();

    // Exchange the one-time code for a persistent auth session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // No code and no explicit error — generic fallback
  return NextResponse.redirect(
    `${origin}/auth/login?error=${encodeURIComponent("Sign in was cancelled or failed. Please try again.")}`
  );
}
