import { NextResponse } from "next/server";
import { evaluateOpeningHours } from "@/lib/openingHours";

/**
 * GET /api/place-open-status?place=...&destination=...&timezone=...
 * Uses Geoapify geocode + place details when opening hours exist.
 * Returns { status: "open"|"closed"|"unknown", label, hours } — unknown = hide badge.
 */

async function resolvePlaceId(place, destination, apiKey) {
  const text = [place, destination].filter(Boolean).join(", ");
  if (!text.trim()) return null;

  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", text);
  url.searchParams.set("limit", "1");
  url.searchParams.set("type", "amenity");
  url.searchParams.set("apiKey", apiKey);

  let res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (res.ok) {
    const data = await res.json();
    const feature = data.features?.[0];
    if (feature?.properties?.place_id) {
      return {
        placeId: feature.properties.place_id,
        openingHours: feature.properties.opening_hours || null,
        name: feature.properties.name || place,
      };
    }
  }

  // Retry without amenity filter (landmarks / tourist spots)
  const url2 = new URL("https://api.geoapify.com/v1/geocode/search");
  url2.searchParams.set("text", text);
  url2.searchParams.set("limit", "1");
  url2.searchParams.set("apiKey", apiKey);
  res = await fetch(url2.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature?.properties?.place_id) return null;
  return {
    placeId: feature.properties.place_id,
    openingHours: feature.properties.opening_hours || null,
    name: feature.properties.name || place,
  };
}

async function fetchPlaceDetails(placeId, apiKey) {
  const url = new URL("https://api.geoapify.com/v2/place-details");
  url.searchParams.set("id", placeId);
  url.searchParams.set("features", "details");
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const data = await res.json();
  const props = data.features?.[0]?.properties || data.properties || {};
  return (
    props.opening_hours ||
    props.datasource?.raw?.opening_hours ||
    props.details?.opening_hours ||
    null
  );
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const place = searchParams.get("place")?.trim();
    const destination = searchParams.get("destination")?.trim() || "";
    const timezone = searchParams.get("timezone")?.trim() || "UTC";

    if (!place) {
      return NextResponse.json({ status: "unknown" });
    }

    const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ status: "unknown" });
    }

    const resolved = await resolvePlaceId(place, destination, apiKey);
    if (!resolved) {
      return NextResponse.json({ status: "unknown" });
    }

    let hoursRaw = resolved.openingHours;
    if (!hoursRaw && resolved.placeId) {
      hoursRaw = await fetchPlaceDetails(resolved.placeId, apiKey);
    }

    const evaluated = evaluateOpeningHours(hoursRaw, timezone);
    if (!evaluated) {
      return NextResponse.json({
        status: "unknown",
        hours:
          typeof hoursRaw === "string"
            ? hoursRaw
            : hoursRaw
              ? JSON.stringify(hoursRaw)
              : null,
      });
    }

    return NextResponse.json({
      status: evaluated.open ? "open" : "closed",
      label: evaluated.label,
      hours: typeof hoursRaw === "string" ? hoursRaw : null,
      name: resolved.name,
    });
  } catch (error) {
    console.error("Place open status error:", error);
    return NextResponse.json({ status: "unknown" });
  }
}
