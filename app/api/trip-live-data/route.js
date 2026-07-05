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
 * Returns live weather + local currency vs user's profile currency.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const destination = searchParams.get("destination")?.trim();
    const userCurrency = (searchParams.get("currency") || "INR").toUpperCase();

    if (!destination) {
      return NextResponse.json({ error: "Missing destination" }, { status: 400 });
    }

    const geoKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY?.trim();
    let lat = null;
    let lon = null;
    let countryCode = null;
    let placeName = extractCountryHint(destination);

    if (geoKey) {
      const geoUrl = new URL("https://api.geoapify.com/v1/geocode/search");
      geoUrl.searchParams.set("text", destination);
      geoUrl.searchParams.set("limit", "1");
      geoUrl.searchParams.set("apiKey", geoKey);

      const geoRes = await fetch(geoUrl.toString(), {
        next: { revalidate: 86400 },
      });

      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const feature = geoData.features?.[0];
        if (feature) {
          lat = feature.properties?.lat;
          lon = feature.properties?.lon;
          countryCode = feature.properties?.country_code?.toUpperCase();
          placeName =
            feature.properties?.city ||
            feature.properties?.state ||
            feature.properties?.country ||
            placeName;
        }
      }
    }

    let localCurrency =
      (countryCode && COUNTRY_CURRENCY[countryCode]) ||
      inferCurrencyFromText(destination) ||
      "USD";

    // Weather via Open-Meteo (free, no key)
    let weather = null;
    if (lat != null && lon != null) {
      const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
      weatherUrl.searchParams.set("latitude", String(lat));
      weatherUrl.searchParams.set("longitude", String(lon));
      weatherUrl.searchParams.set("current", "temperature_2m,weather_code");
      weatherUrl.searchParams.set("timezone", "auto");

      const weatherRes = await fetch(weatherUrl.toString(), {
        next: { revalidate: 1800 },
      });

      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        const current = weatherData.current;
        if (current) {
          weather = {
            tempC: Math.round(current.temperature_2m),
            description: weatherLabel(current.weather_code),
            place: placeName,
          };
        }
      }
    }

    // Exchange rate via Frankfurter (free)
    let exchangeLine = null;
    let rate = null;

    if (localCurrency === userCurrency) {
      exchangeLine = formatExchangeLine(localCurrency, userCurrency, 1);
      rate = 1;
    } else {
      const fxUrl = `https://api.frankfurter.app/latest?from=${localCurrency}&to=${userCurrency}`;
      const fxRes = await fetch(fxUrl, { next: { revalidate: 3600 } });

      if (fxRes.ok) {
        const fxData = await fxRes.json();
        rate = fxData.rates?.[userCurrency];
        if (rate) {
          exchangeLine = formatExchangeLine(
            localCurrency,
            userCurrency,
            rate
          );
        }
      }

      // Frankfurter may not support exotic pairs — try inverse via EUR
      if (!exchangeLine && localCurrency !== "EUR" && userCurrency !== "EUR") {
        const viaEur = await fetch(
          `https://api.frankfurter.app/latest?from=${localCurrency}&to=EUR,${userCurrency}`,
          { next: { revalidate: 3600 } }
        );
        if (viaEur.ok) {
          const viaData = await viaEur.json();
          const toUser = viaData.rates?.[userCurrency];
          if (toUser) {
            rate = toUser;
            exchangeLine = formatExchangeLine(
              localCurrency,
              userCurrency,
              toUser
            );
          }
        }
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
    });
  } catch (error) {
    console.error("Trip live data error:", error);
    return NextResponse.json(
      { error: "Failed to load live data", details: error.message },
      { status: 500 }
    );
  }
}
