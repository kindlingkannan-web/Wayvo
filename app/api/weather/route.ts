import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") || "";
  if (!q.trim()) {
    return NextResponse.json({ error: "Location query is required" }, { status: 400 });
  }

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.split(",")[0].trim())}&count=1`
    );
    const geoData = await geoRes.json();
    const place = geoData.results?.[0];

    if (!place) {
      return NextResponse.json({ error: "Location not found in weather directory" }, { status: 404 });
    }

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max&timezone=auto&forecast_days=7`;
    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json();

    const d = weatherData.daily;
    if (!d || !d.time) {
      return NextResponse.json({ error: "Forecast data format unexpected" }, { status: 502 });
    }

    const days = d.time.map((t: string, i: number) => {
      const code = d.weather_code[i];
      const rain = d.precipitation_sum[i] || 0;
      const gust = d.wind_gusts_10m_max[i] || 0;
      const severe: string[] = [];

      // Categorize severe / extreme climatic threats
      if (gust >= 90) {
        severe.push(`Cyclone / Gale-Force Wind Warning (Gusts ${gust} km/h)`);
      } else if (gust >= 70) {
        severe.push(`Damaging wind gusts (${gust} km/h)`);
      }

      if (rain >= 50) {
        severe.push(`Extreme Rainfall & Flash Flooding Risk (${rain} mm)`);
      } else if (rain >= 30) {
        severe.push(`Heavy continuous rainfall (${rain} mm)`);
      }

      if (code === 99) {
        severe.push("Severe Thunderstorm with Heavy Hail / Tornado Warning");
      } else if (code === 95 || code === 96) {
        severe.push("Severe Thunderstorm & Lightning Hazard");
      }

      const isBad = code >= 61 || rain >= 8 || gust >= 45;

      return {
        date: t,
        max: Math.round(d.temperature_2m_max[i]),
        min: Math.round(d.temperature_2m_min[i]),
        rain,
        gust,
        code,
        bad: isBad,
        severe,
      };
    });

    return NextResponse.json({
      place: `${place.name}, ${place.country || ""}`,
      days,
      note: "Live meteorological data via Open-Meteo. Severe weather detection alerts prioritize traveler safety.",
    });
  } catch (err: any) {
    console.error("Weather error:", err);
    return NextResponse.json({ error: "Weather forecast service temporarily unavailable" }, { status: 502 });
  }
}
