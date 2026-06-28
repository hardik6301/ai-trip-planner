/**
 * Next.js middleware — refreshes Supabase auth sessions on every request
 * and protects /my-trips by redirecting unauthenticated users to login.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function middleware(request) {
  // Start with a pass-through response we can attach cookies to
  let supabaseResponse = NextResponse.next({ request });

  // Create a Supabase client that reads/writes cookies on this request
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
  });

  // Refresh the session — must run immediately after createServerClient
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Block unauthenticated access to the saved trips page
  if (!user && request.nextUrl.pathname.startsWith("/my-trips")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

// Run middleware on all routes except static assets and images
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
