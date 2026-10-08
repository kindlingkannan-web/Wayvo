"use client";
import React, { useState } from "react";
import type { Plan, Activity, Day } from "@/lib/types";
import { total, hm, toMin, fmt } from "@/lib/engine";

const inr = (n: number | null) => (n == null ? "Free / Unknown" : "₹" + Math.round(n).toLocaleString("en-IN"));

interface ExploreAlternativesProps {
  plan: Plan;
  activeDayIdx: number;
  onAddToDay: (activity: Activity) => void;
  onSwapActivity: (targetId: string, replacement: Activity) => void;
}

export function ExploreAlternatives({
  plan,
  activeDayIdx,
  onAddToDay,
  onSwapActivity,
}: ExploreAlternativesProps) {
  const [filterType, setFilterType] = useState<"all" | "indoor" | "outdoor" | "meal">("all");
  const [maxTime, setMaxTime] = useState<number>(180); // max 3 hours
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");

  const currentDay = plan.days[activeDayIdx] || plan.days[0];
  const alternatives = plan.alternatives || [];

  const filtered = alternatives.filter((a) => {
    if (filterType === "indoor" && !a.indoor) return false;
    if (filterType === "outdoor" && a.indoor) return false;
    if (filterType === "meal" && a.kind !== "meal") return false;
    if (total(a) > maxTime) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header and Filter Controls */}
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-lagoon">
              Destination Directory
            </span>
            <h2 className="text-xl font-extrabold text-ink">Explore &amp; Alternative Spots</h2>
            <p className="text-xs text-ink/60 mt-0.5">
              Curated locations for {plan.destination} that fit into your available time windows.
            </p>
          </div>

          {/* Quick Swap Target Dropdown */}
          {currentDay && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-ink/60 font-medium">Replace an activity on Day {activeDayIdx + 1}:</span>
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                className="rounded-xl border border-ink/20 bg-paper px-3 py-1.5 font-bold text-ink"
              >
                <option value="">(None - Browse / Add)</option>
                {currentDay.activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.start} - {hm(total(a))})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Filter Pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-ink/10">
          <span className="text-xs font-semibold text-ink/50 uppercase">Filter:</span>
          {(["all", "indoor", "outdoor", "meal"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`rounded-xl px-3 py-1 text-xs font-semibold capitalize transition ${
                filterType === t
                  ? "bg-ink text-white"
                  : "bg-paper text-ink/70 hover:bg-ink/10"
              }`}
            >
              {t === "all" ? "All Venues" : t}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2 text-xs text-ink/70">
            <span>Max Time: <b>{hm(maxTime)}</b></span>
            <input
              type="range"
              min="45"
              max="240"
              step="15"
              value={maxTime}
              onChange={(e) => setMaxTime(Number(e.target.value))}
              className="accent-lagoon cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Alternatives Cards Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center text-ink/60 ring-1 ring-ink/10">
          No alternatives match your current filter parameters. Try increasing the time slider.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((alt) => {
            const tot = total(alt);
            return (
              <div
                key={alt.id}
                className="flex flex-col justify-between rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/10 hover:shadow-md transition"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-semibold text-ink/70">
                      {alt.indoor ? "🏛️ Indoor" : "☀️ Outdoor"} · {alt.kind === "meal" ? "Dining" : "Attraction"}
                    </span>
                    <span className="text-xs font-extrabold text-lagoon">
                      {inr(alt.ticket)}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-ink">{alt.name}</h3>
                  {alt.description && (
                    <p className="text-xs text-ink/70 line-clamp-2">{alt.description}</p>
                  )}

                  {/* Fit reason */}
                  <div className="rounded-2xl bg-paper p-2.5 text-xs text-ink/80">
                    <div className="font-semibold text-ink flex items-center gap-1">
                      <span>✓</span>
                      <span>
                        Fits your window: {hm(tot)} (Wait: {alt.waitMin || 0}m + Visit: {hm(alt.visitMin)})
                      </span>
                    </div>
                    <div className="text-[11px] text-ink/60 mt-0.5">
                      Open {alt.open} – {alt.close} · {alt.reason || "Convenient location for group."}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-ink/5">
                  {selectedTargetId ? (
                    <button
                      onClick={() => {
                        onSwapActivity(selectedTargetId, alt);
                        setSelectedTargetId("");
                      }}
                      className="btn !bg-amber !text-ink !rounded-xl !py-1.5 text-xs font-bold"
                    >
                      Swap with selected
                    </button>
                  ) : (
                    <button
                      onClick={() => onAddToDay(alt)}
                      className="btn !bg-lagoon text-white !rounded-xl !py-1.5 text-xs font-bold"
                    >
                      + Add to Day {activeDayIdx + 1}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
