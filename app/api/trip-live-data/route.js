import { NextResponse } from "next/server";
import {
  COUNTRY_CURRENCY,
  extractCountryHint,
  formatExchangeLine,
  inferCurrencyFromText,
  weatherLabel,
} from "@/lib/destinationLive";

/**
 * GET /api/trip-live-data?destination=...&currency=INR
 * Live weather (Open-Meteo) + FX rate for an interactive converter.
 */

async function geocodeGeoapify(destination, apiKey) {
  const geoUrl = new URL("https://api.geoapify.com/v1/geocode/search");
  geoUrl.searchParams.set("text", destination);
  geoUrl.searchParams.set("limit", "1");
  geoUrl.searchParams.set("apiKey", apiKey);

  const geoRes = await fetch(geoUrl.toString(), {
    next: { revalidate: 86400 },
  });
  if (!geoRes.ok) return null;

  const geoData = await geoRes.json();
  const feature = geoData.features?.[0];
  if (!feature) return null;

  return {
    lat: feature.properties?.lat,
    lon: feature.properties?.lon,
    countryCode: feature.properties?.country_code?.toUpperCase() || null,
    placeName:
      feature.properties?.city ||
      feature.properties?.state ||
      feature.properties?.country ||
      extractCountryHint(destination),
    timezone: feature.properties?.timezone?.name || null,
  };
}

/** Free, keyless fallback when Geoapify misses */
async function geocodeOpenMeteo(destination) {
  const query = String(destination)
    .replace(/\bAdventure\b/gi, "")
    .split(",")[0]
    .trim();
  if (!query) return null;

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) return null;

  const data = await res.json();
  const hit = data.results?.[0];
  if (!hit) return null;

  return {
    lat: hit.latitude,
    lon: hit.longitude,
    countryCode: hit.country_code?.toUpperCase() || null,
    placeName: hit.name || query,
    timezone: hit.timezone || null,
  };
}

async function fetchFrankfurterRate(from, to) {
  const fxUrl = `https://api.frankfurter.app/latest?from=${from}&to=${to}`;
  const fxRes = await fetch(fxUrl, { next: { revalidate: 3600 } });
  if (!fxRes.ok) return null;
  const fxData = await fxRes.json();
  return fxData.rates?.[to] ?? null;
}

/** Broad coverage fallback (includes many travel currencies) */
async function fetchOpenErRate(from, to) {
  const res = await fetch(`https://open.er-api.com/v6/latest/${from}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.result !== "success") return null;
  return data.rates?.[to] ?? null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const destination = searchParams.get("destination")?.trim();
    const userCurrency = (searchParams.get("currency") || "INR").toUpperCase();

    if (!destination) {
      return NextResponse.json({ error: "Missing destination" }, { status: 400 });
    }

    const geoKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY?.trim();
    let geo = null;

    if (geoKey) {
      try {
        geo = await geocodeGeoapify(destination, geoKey);
      } catch {
        geo = null;
      }
    }
    if (!geo) {
      try {
        geo = await geocodeOpenMeteo(destination);
      } catch {
        geo = null;
      }
    }

    const lat = geo?.lat ?? null;
    const lon = geo?.lon ?? null;
    const countryCode = geo?.countryCode ?? null;
    const placeName = geo?.placeName || extractCountryHint(destination);
    let timezone = geo?.timezone || null;

    let localCurrency =
      (countryCode && COUNTRY_CURRENCY[countryCode]) ||
      inferCurrencyFromText(destination) ||
      "USD";

    // Weather via Open-Meteo — current + today's high/low
    let weather = null;
    if (lat != null && lon != null) {
      const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
      weatherUrl.searchParams.set("latitude", String(lat));
      weatherUrl.searchParams.set("longitude", String(lon));
      weatherUrl.searchParams.set(
        "current",
        "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m"
      );
      weatherUrl.searchParams.set(
        "daily",
        "temperature_2m_max,temperature_2m_min,weather_code"
      );
      weatherUrl.searchParams.set("forecast_days", "1");
      weatherUrl.searchParams.set("timezone", "auto");

      const weatherRes = await fetch(weatherUrl.toString(), {
        next: { revalidate: 1800 },
      });

      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        const current = weatherData.current;
        if (current) {
          timezone = weatherData.timezone || timezone;
          const high = weatherData.daily?.temperature_2m_max?.[0];
          const low = weatherData.daily?.temperature_2m_min?.[0];
          weather = {
            tempC: Math.round(current.temperature_2m),
            feelsLikeC:
              current.apparent_temperature != null
                ? Math.round(current.apparent_temperature)
                : null,
            humidity:
              current.relative_humidity_2m != null
                ? Math.round(current.relative_humidity_2m)
                : null,
            windKmh:
              current.wind_speed_10m != null
                ? Math.round(current.wind_speed_10m)
                : null,
            highC: high != null ? Math.round(high) : null,
            lowC: low != null ? Math.round(low) : null,
            description: weatherLabel(current.weather_code),
            weatherCode: current.weather_code,
            place: placeName,
            timezone,
            live: true,
          };
        }
      }
    }

    let exchangeLine = null;
    let rate = null;

    if (localCurrency === userCurrency) {
      exchangeLine = formatExchangeLine(localCurrency, userCurrency, 1);
      rate = 1;
    } else {
      rate = await fetchFrankfurterRate(localCurrency, userCurrency);
      if (rate == null) {
        rate = await fetchOpenErRate(localCurrency, userCurrency);
      }
      if (rate != null) {
        exchangeLine = formatExchangeLine(localCurrency, userCurrency, rate);
      }
    }

    if (!exchangeLine) {
      exchangeLine = `${localCurrency} → ${userCurrency}`;
    }

    return NextResponse.json({
      weather,
      currency: {
        localCode: localCurrency,
        userCode: userCurrency,
        rate,
        exchangeLine,
        countryCode,
      },
      timezone,
      placeName,
      coords:
        lat != null && lon != null ? { lat, lon } : null,
    });
  } catch (error) {
    console.error("Trip live data error:", error);
    return NextResponse.json(
      { error: "Failed to load live data", details: error.message },
      { status: 500 }
    );
  }
}
