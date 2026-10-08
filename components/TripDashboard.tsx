"use client";
import React, { useState } from "react";
import type { Plan, Activity, Day } from "@/lib/types";
import { RunningLateModal } from "./RunningLateModal";
import { TripCopilotModal } from "./TripCopilotModal";
import { HotelSelector } from "./HotelSelector";
import { total, hm, toMin, fmt, budget } from "@/lib/engine";
import {
  ClockIcon,
  SparklesIcon,
  ShieldAlertIcon,
  MicIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from "./Icons";

interface TripDashboardProps {
  plan: Plan;
  activeDayIdx: number;
  setActiveDayIdx: (idx: number) => void;
  onUpdatePlan: (updatedPlan: Plan) => void;
  onNavigateTab: (tabName: string) => void;
  severeWarnings?: string[];
}

const inr = (n: number | null) => (n == null ? "—" : "₹" + Math.round(n).toLocaleString("en-IN"));

export function TripDashboard({
  plan,
  activeDayIdx,
  setActiveDayIdx,
  onUpdatePlan,
  onNavigateTab,
  severeWarnings = [],
}: TripDashboardProps) {
  const [lateModalOpen, setLateModalOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const day = plan.days[activeDayIdx] || plan.days[0];
  const allActivities = plan.days.flatMap((d) => d.activities);
  const totalActs = allActivities.length;
  const completedActs = allActivities.filter((a) => a.done).length;
  const progressPct = totalActs > 0 ? Math.round((completedActs / totalActs) * 100) : 0;

  const currentDayUnfinished = day ? day.activities.findIndex((a) => !a.done) : -1;
  const currentActivity = currentDayUnfinished >= 0 ? day.activities[currentDayUnfinished] : null;
  const nextActivity = currentDayUnfinished >= 0 && currentDayUnfinished + 1 < day.activities.length
    ? day.activities[currentDayUnfinished + 1]
    : null;

  const b = budget(plan);

  const handleToggleVisited = (actId: string, currentVal: boolean) => {
    if (!day) return;
    const newActs = day.activities.map((a) => (a.id === actId ? { ...a, done: !currentVal } : a));
    onUpdatePlan({
      ...plan,
      days: plan.days.map((d, i) => (i === activeDayIdx ? { ...d, activities: newActs } : d)),
    });
  };

  return (
    <div className="space-y-5">
      {/* SEVERE WEATHER EMERGENCY WARNING BANNER */}
      {severeWarnings.length > 0 && (
        <div className="rounded-3xl border-2 border-alert bg-red-50 p-5 text-alert shadow-sm animate-pulse">
          <div className="flex items-center gap-2.5 font-extrabold text-base">
            <ShieldAlertIcon className="w-6 h-6" />
            <span>CRITICAL SEVERE WEATHER WARNING</span>
          </div>
          <p className="mt-1 text-xs text-alert/90 font-medium">
            Dangerous meteorological conditions detected for {plan.destination}: {severeWarnings.join("; ")}.
            Prioritize shelter. Outdoor locations may be unsafe.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onNavigateTab("Weather & Alerts")}
              className="rounded-xl bg-alert px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-alert/90"
            >
              View Weather Radar ➔
            </button>
            <button
              onClick={() => setCopilotOpen(true)}
              className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-alert ring-1 ring-alert hover:bg-red-100"
            >
              Auto-Move Activities Indoors
            </button>
          </div>
        </div>
      )}

      {/* Hero Trip Overview Card */}
      <div className="rounded-3xl bg-gradient-to-br from-ink to-ink/95 p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-lagoon px-3 py-0.5 text-xs font-bold tracking-wide">
                Live Active Trip
              </span>
              <span className="text-xs text-white/60">
                {plan.travelers} Traveler{plan.travelers > 1 ? "s" : ""} · {plan.group} · {plan.diet}
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">{plan.destination}</h1>
            <p className="text-xs text-white/70">
              {plan.durationDays} Days · {day?.date} (Day {activeDayIdx + 1} of {plan.days.length})
            </p>
          </div>

          {/* Quick Action Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setLateModalOpen(true)}
              className="rounded-2xl bg-amber px-3.5 py-2 text-xs font-black text-ink shadow-sm hover:bg-amber/90 transition flex items-center gap-1.5"
            >
              <ClockIcon className="w-4 h-4" />
              <span>I'm Running Late</span>
            </button>

            <button
              onClick={() => setCopilotOpen(true)}
              className="rounded-2xl bg-lagoon px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-lagoon/90 transition flex items-center gap-1.5"
            >
              <SparklesIcon className="w-4 h-4" />
              <span>Copilot</span>
            </button>

            <button
              onClick={() => onNavigateTab("Voice Translator")}
              className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 transition flex items-center gap-1"
            >
              <MicIcon className="w-4 h-4" />
              <span>Translate</span>
            </button>

            <button
              onClick={() => onNavigateTab("Emergency")}
              className="rounded-2xl bg-alert/80 px-3 py-2 text-xs font-bold text-white hover:bg-alert transition flex items-center gap-1"
            >
              <ShieldAlertIcon className="w-4 h-4" />
              <span>Emergency</span>
            </button>
          </div>
        </div>

        {/* Live Trip Progress Bar */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between text-xs font-medium text-white/80">
            <span>Overall Trip Completion</span>
            <span>
              <b>{completedActs}</b> of <b>{totalActs}</b> stops visited ({progressPct}%)
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-lagoon transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Day switch pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          {plan.days.map((d, i) => (
            <button
              key={d.date}
              onClick={() => setActiveDayIdx(i)}
              className={`rounded-xl px-3 py-1 text-xs font-bold transition ${
                i === activeDayIdx
                  ? "bg-white text-ink shadow-sm"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              Day {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Current and Next Activity Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Current Activity */}
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-2 ring-lagoon">
          <div className="flex items-center justify-between pb-2 border-b border-ink/5">
            <span className="rounded-full bg-lagoon px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white animate-pulse">
              Current Stop
            </span>
            <span className="text-xs text-ink/50 font-medium">Scheduled at {currentActivity?.start || "09:30"}</span>
          </div>

          {currentActivity ? (
            <div className="mt-3 space-y-2">
              <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                <span>{currentActivity.kind === "meal" ? "🍽️" : "📍"}</span>
                <span>{currentActivity.name}</span>
              </h3>
              <p className="text-xs text-ink/70">{currentActivity.description || currentActivity.reason}</p>

              <div className="rounded-2xl bg-paper p-3 text-xs flex justify-between">
                <span>Wait: <b>{currentActivity.waitMin || 0}m</b></span>
                <span>Visit: <b>{hm(currentActivity.visitMin)}</b></span>
                <span className="text-lagoon font-bold">Total: {hm(total(currentActivity))}</span>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => handleToggleVisited(currentActivity.id, currentActivity.done)}
                  className="btn !bg-lagoon text-white !rounded-xl !py-2 text-xs font-bold flex-1"
                >
                  ✓ Mark Completed
                </button>
                <button
                  onClick={() => setLateModalOpen(true)}
                  className="btn2 !rounded-xl !py-2 text-xs font-bold text-amber"
                >
                  Running Late
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-center text-xs text-ink/50 py-4">
              🎉 All planned stops for today are completed! Enjoy your evening.
            </div>
          )}
        </div>

        {/* Next Activity */}
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
          <div className="flex items-center justify-between pb-2 border-b border-ink/5">
            <span className="rounded-full bg-paper px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink/60">
              Next Up
            </span>
            <span className="text-xs text-ink/50 font-medium">Starts ~{nextActivity?.start || "—"}</span>
          </div>

          {nextActivity ? (
            <div className="mt-3 space-y-2">
              <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                <span>{nextActivity.kind === "meal" ? "🍽️" : "📍"}</span>
                <span>{nextActivity.name}</span>
              </h3>
              <p className="text-xs text-ink/70">{nextActivity.reason}</p>

              <div className="rounded-2xl bg-paper p-3 text-xs space-y-1">
                <div className="flex justify-between text-ink/70">
                  <span>Getting there:</span>
                  <span className="font-semibold text-ink">
                    {typeof nextActivity.transport === "object"
                      ? `${nextActivity.transport.method} (${nextActivity.transport.durationMin}m)`
                      : String(nextActivity.transport)}
                  </span>
                </div>
                <div className="flex justify-between text-ink/70">
                  <span>Ticket:</span>
                  <span className="font-semibold text-ink">{inr(nextActivity.ticket)}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => onNavigateTab("Itinerary")}
                  className="btn2 !rounded-xl !py-2 text-xs font-bold w-full"
                >
                  View in Timeline ➔
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-center text-xs text-ink/50 py-4">
              No further activities scheduled after this.
            </div>
          )}
        </div>
      </div>

      {/* Day Checklist & Hotel Card */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Today's Checklist */}
        <div className="lg:col-span-2 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
          <div className="flex items-center justify-between pb-3 border-b border-ink/10">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-lagoon">Day {activeDayIdx + 1} Checklist</span>
              <h3 className="text-base font-bold text-ink">Planned Stops</h3>
            </div>
            <button
              onClick={() => onNavigateTab("Itinerary")}
              className="text-xs text-lagoon font-bold hover:underline"
            >
              Full Timeline ➔
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {day?.activities.map((a, i) => (
              <div
                key={a.id}
                className={`flex items-center justify-between p-3 rounded-2xl transition ${
                  a.done ? "bg-paper/50 line-through text-ink/40" : "bg-paper text-ink"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={a.done}
                    onChange={() => handleToggleVisited(a.id, a.done)}
                    className="rounded text-lagoon focus:ring-lagoon"
                  />
                  <div>
                    <div className="font-bold text-xs">{a.name}</div>
                    <div className="text-[11px] text-ink/50">{a.start} · {hm(total(a))} total</div>
                  </div>
                </div>

                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-ink/60 ring-1 ring-ink/10">
                  {a.indoor ? "Indoor" : "Outdoor"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Accommodation and Budget Summary */}
        <div className="space-y-4">
          <HotelSelector plan={plan} onUpdate={onUpdatePlan} />

          {/* Quick Budget Pill */}
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/50">Budget Status</span>
              <button
                onClick={() => onNavigateTab("Budget")}
                className="text-xs font-bold text-lagoon hover:underline"
              >
                Details ➔
              </button>
            </div>
            <div className="mt-2 text-xl font-black text-ink">{inr(b.planned)} / {inr(plan.budget)}</div>
            <div className="mt-1 text-xs text-ink/70">
              Remaining: <b className={b.over ? "text-alert" : "text-lagoon"}>{inr(b.remaining)}</b>
            </div>
            {b.over && (
              <p className="mt-2 rounded-xl bg-alert/10 p-2 text-[11px] font-bold text-alert">
                ⚠ Over budget by {inr(b.overAmount)}.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {lateModalOpen && day && (
        <RunningLateModal
          day={day}
          onApply={(updatedDay) => {
            onUpdatePlan({
              ...plan,
              days: plan.days.map((d, i) => (i === activeDayIdx ? updatedDay : d)),
            });
          }}
          onClose={() => setLateModalOpen(false)}
        />
      )}

      {copilotOpen && (
        <TripCopilotModal
          plan={plan}
          dayIdx={activeDayIdx}
          onApplyPlan={(updatedPlan) => onUpdatePlan(updatedPlan)}
          onClose={() => setCopilotOpen(false)}
        />
      )}
    </div>
  );
}
