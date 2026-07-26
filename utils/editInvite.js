/**
 * Edit-invite link helpers (separate from view-only /trip/[id] share).
 */

import { getSiteOrigin, normalizeShareOrigin } from "@/utils/shareTrip";

/** Absolute URL for redeeming an edit token → joins as trip_members.editor */
export function getTripEditInviteUrl(token) {
  if (!token) return "";

  const origin =
    getSiteOrigin() ||
    (typeof window !== "undefined"
      ? normalizeShareOrigin(window.location.origin)
      : "");

  if (!origin) {
    return `https://travora-ai-app.vercel.app/trip/join/${encodeURIComponent(token)}`;
  }
  return `${origin}/trip/join/${encodeURIComponent(token)}`;
}
