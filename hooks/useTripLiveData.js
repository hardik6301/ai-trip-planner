"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchUserProStatus } from "@/lib/userPlan";

/**
 * Fetches live weather + currency for a destination vs profile currency.
 */
export function useTripLiveData(destination) {
  const [userCurrency, setUserCurrency] = useState("INR");
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { profile } = await fetchUserProStatus(supabase, user.id);
        setUserCurrency(profile?.currency || "INR");
      } else {
        setUserCurrency("INR");
      }
    });
  }, []);

  useEffect(() => {
    if (!destination) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({
      destination,
      currency: userCurrency,
    });

    fetch(`/api/trip-live-data?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setLiveData(data);
      })
      .catch(() => {
        if (!cancelled) setLiveData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [destination, userCurrency]);

  return { liveData, loading, userCurrency };
}
