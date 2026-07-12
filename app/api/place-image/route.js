/**
 * GET /api/place-image?place=Wat+Pho&destination=Bangkok
 * Returns a real place photo URL (Wikipedia / Wikimedia Commons),
 * falling back to keyword Unsplash only when no place match exists.
 */

import { NextResponse } from "next/server";
import {
  buildPlaceImageQueries,
  getPlaceImage,
} from "@/utils/placeImages";

export const runtime = "nodejs";

const WIKI_UA =
  "TravoraTripPlanner/1.0 (https://travora-ai-app.vercel.app; travel itinerary app)";

/** Short-lived in-memory cache so long itineraries don't re-hit Wikipedia */
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.url;
}

function cacheSet(key, url) {
  cache.set(key, { url, expires: Date.now() + CACHE_TTL_MS });
}

/** Wikipedia REST summary → original thumbnail for that page */
async function fetchWikipediaThumb(title) {
  const encoded = encodeURIComponent(title.replace(/ /g, "_"));
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": WIKI_UA,
      Accept: "application/json",
    },
    next: { revalidate: 86400 },
  });

  if (!res.ok) return null;

  const data = await res.json();
  // Skip disambiguation / missing pages
  if (data.type === "disambiguation" || data.type === "no-extract") return null;

  const thumb =
    data.originalimage?.source ||
    data.thumbnail?.source ||
    null;

  return thumb || null;
}

/** Wikimedia Commons search → first page thumbnail */
async function fetchCommonsThumb(query) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "1",
    gsrnamespace: "0|6",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "600",
  });

  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": WIKI_UA, Accept: "application/json" },
    next: { revalidate: 86400 },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const pages = data.query?.pages;
  if (!pages) return null;

  const first = Object.values(pages)[0];
  return first?.thumbnail?.source || null;
}

/** Openverse (Creative Commons) image search — place-specific when Wikipedia misses */
async function fetchOpenverseThumb(query) {
  const params = new URLSearchParams({
    q: query,
    page_size: "1",
    license: "cc0,pdm,by,by-sa",
    category: "photograph",
  });

  const res = await fetch(`https://api.openverse.org/v1/images/?${params}`, {
    headers: {
      "User-Agent": WIKI_UA,
      Accept: "application/json",
    },
    next: { revalidate: 86400 },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const result = data.results?.[0];
  return result?.url || result?.thumbnail || null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const place = searchParams.get("place") || "";
    const activity = searchParams.get("activity") || "";
    const destination = searchParams.get("destination") || "";

    if (!place && !destination) {
      return NextResponse.json(
        { error: "Missing place or destination" },
        { status: 400 }
      );
    }

    const cacheKey = `${place}|${destination}`.toLowerCase();
    const cached = cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json({ url: cached, source: "cache" });
    }

    const queries = buildPlaceImageQueries(place, destination);
    let foundUrl = null;
    let source = null;

    // 1) Wikipedia — best for famous landmarks (Wat Pho, Eiffel Tower, etc.)
    for (const q of queries) {
      try {
        foundUrl = await fetchWikipediaThumb(q);
        if (foundUrl) {
          source = "wikipedia";
          break;
        }
      } catch {
        /* try next query */
      }
    }

    // 2) Wikimedia Commons search
    if (!foundUrl) {
      for (const q of queries.slice(0, 2)) {
        try {
          foundUrl = await fetchCommonsThumb(q);
          if (foundUrl) {
            source = "commons";
            break;
          }
        } catch {
          /* try next */
        }
      }
    }

    // 3) Openverse Creative Commons photos
    if (!foundUrl && queries[0]) {
      try {
        foundUrl = await fetchOpenverseThumb(
          `${queries[0]} ${destination}`.trim()
        );
        if (foundUrl) source = "openverse";
      } catch {
        /* fall through */
      }
    }

    // 4) Keyword Unsplash fallback (last resort — not place-specific)
    if (!foundUrl) {
      foundUrl = getPlaceImage(place, activity, destination);
      source = "fallback";
    }

    cacheSet(cacheKey, foundUrl);

    return NextResponse.json({ url: foundUrl, source });
  } catch (error) {
    console.error("place-image error:", error);
    return NextResponse.json(
      {
        url: getPlaceImage(
          new URL(request.url).searchParams.get("place") || "",
          "",
          new URL(request.url).searchParams.get("destination") || ""
        ),
        source: "fallback",
      },
      { status: 200 }
    );
  }
}
