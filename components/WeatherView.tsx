"use client";
import React, { useState, useEffect } from "react";
import type { Plan } from "@/lib/types";
import { CloudRainIcon, AlertTriangleIcon, ShieldAlertIcon } from "./Icons";
import { applyCopilot } from "@/lib/engine";

interface WeatherViewProps {
  destination: string;
  plan: Plan | null;
  onUpdatePlan?: (updatedPlan: Plan) => void;
  onSevereAlertsFound?: (alerts: string[]) => void;
}

export function WeatherView({
  destination,
  plan,
  onUpdatePlan,
  onSevereAlertsFound,
}: WeatherViewProps) {
  const [query, setQuery] = useState(destination || "Jaipur, India");
  const [forecast, setForecast] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adjustedMessage, setAdjustedMessage] = useState("");

  const fetchWeather = async (targetCity: string) => {
    if (!targetCity.trim()) return;
    setBusy(true);
    setError("");
    setAdjustedMessage("");

    try {
      const res = await fetch(`/api/weather?q=${encodeURIComponent(targetCity)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load weather forecast");

      setForecast(data);

      const severeAlerts: string[] = [];
      data.days?.forEach((d: any) => {
        if (d.severe && d.severe.length > 0) {
          severeAlerts.push(`${d.date}: ${d.severe.join(", ")}`);
        }
      });

      if (onSevereAlertsFound) {
        onSevereAlertsFound(severeAlerts);
      }
    } catch (err: any) {
      setError(err.message || "Failed to query weather service");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (destination) {
      setQuery(destination);
      fetchWeather(destination);
    }
  }, [destination]);

  const handleAdjustForWeather = () => {
    if (!plan || !onUpdatePlan) return;
    const res = applyCopilot(plan, 0, "It is raining and bad weather. Move outdoor activities indoors.");
    onUpdatePlan(res.plan);
    setAdjustedMessage("Itinerary successfully optimized: Outdoor activities swapped with indoor venues.");
  };

  return (
    <div className="space-y-5">
      {/* Header and City Lookup */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-ink/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-lagoon">
              Meteorological Intelligence
            </span>
            <h2 className="text-xl font-black text-ink">Weather &amp; Safety Advisories</h2>
            <p className="text-xs text-ink/60 mt-0.5">
              Live meteorological tracking powered by Open-Meteo. Automatically signals extreme climatic hazards.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchWeather(query);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="City or destination..."
              className="inp text-xs !w-44"
            />
            <button
              type="submit"
              disabled={busy}
              className="btn !bg-lagoon text-white !rounded-xl !py-1 text-xs"
            >
              {busy ? "Checking…" : "Check Radar"}
            </button>
          </form>
        </div>

        {error && <p className="mt-3 text-xs text-alert font-bold">⚠ {error}</p>}
      </div>

      {/* Extreme Weather Threat Alert Banner */}
      {forecast && forecast.days?.some((d: any) => d.severe?.length > 0) && (
        <div className="rounded-3xl border-2 border-alert bg-red-50 p-6 text-alert shadow-md">
          <div className="flex items-center gap-2.5 font-black text-lg">
            <ShieldAlertIcon className="w-6 h-6" />
            <span>SEVERE WEATHER &amp; DISASTER ADVISORY</span>
          </div>

          <p className="mt-2 text-xs font-medium leading-relaxed">
            Severe meteorological warnings are active for <b>{forecast.place}</b>. Outdoor activities and
            hillside excursions may pose life-safety hazards. Itinerary recommendations must be adjusted
            immediately.
          </p>

          <div className="mt-3 space-y-1 text-xs font-bold">
            {forecast.days
              .filter((d: any) => d.severe?.length > 0)
              .map((d: any) => (
                <div key={d.date} className="flex items-start gap-2">
                  <span>🚨</span>
                  <span>
                    <b>{d.date}:</b> {d.severe.join("; ")}
                  </span>
                </div>
              ))}
          </div>

          {plan && onUpdatePlan && (
            <div className="mt-4 pt-3 border-t border-alert/20">
              <button
                type="button"
                onClick={handleAdjustForWeather}
                className="btn !bg-alert text-white !rounded-2xl !py-2 text-xs font-extrabold shadow-sm hover:bg-alert/90"
              >
                Auto-Adjust Itinerary for Severe Weather ➔
              </button>
            </div>
          )}
        </div>
      )}

      {adjustedMessage && (
        <div className="rounded-2xl bg-lagoon/15 p-3.5 text-xs text-lagoon font-bold border border-lagoon/30">
          ✓ {adjustedMessage}
        </div>
      )}

      {/* 7-Day Forecast Cards */}
      {forecast && forecast.days && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-ink/60">
            <span>7-Day Forecast for {forecast.place}</span>
            <span>{forecast.note}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {forecast.days.map((d: any) => (
              <div
                key={d.date}
                className={`rounded-3xl p-5 shadow-sm ring-1 transition ${
                  d.severe.length > 0
                    ? "bg-red-50/80 ring-2 ring-alert"
                    : d.bad
                    ? "bg-amber/10 ring-amber/40"
                    : "bg-white ring-ink/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-ink">{d.date}</span>
                  <span className="text-2xl">{d.severe.length ? "⛈️" : d.bad ? "🌧️" : "☀️"}</span>
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-ink">{d.max}°C</span>
                  <span className="text-sm font-semibold text-ink/50">/ {d.min}°C min</span>
                </div>

                <div className="mt-3 space-y-1 text-xs text-ink/70">
                  <div className="flex justify-between">
                    <span>Precipitation:</span>
                    <span className="font-bold text-ink">{d.rain} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Wind Gusts:</span>
                    <span className="font-bold text-ink">{d.gust} km/h</span>
                  </div>
                </div>

                {d.severe.length > 0 ? (
                  <div className="mt-3 rounded-xl bg-alert p-2 text-[11px] font-bold text-white">
                    ⚠ Severe: {d.severe.join(", ")}
                  </div>
                ) : d.bad ? (
                  <div className="mt-3 rounded-xl bg-amber/20 p-2 text-[11px] font-bold text-ink">
                    🌧 Rain likely. Indoor attractions recommended.
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl bg-lagoon/10 p-2 text-[11px] font-semibold text-lagoon">
                    ☀️ Favorable weather for outdoor exploring.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
