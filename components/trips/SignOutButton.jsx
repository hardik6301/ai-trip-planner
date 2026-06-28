"use client";

/**
 * Sign out button for the My Trips dashboard.
 * Extracted as a client component since signOut requires browser APIs.
 */

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded-lg border border-outline-variant/50 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary-fixed"
    >
      Sign Out
    </button>
  );
}
