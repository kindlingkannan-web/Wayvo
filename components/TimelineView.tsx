"use client";
import React, { useState } from "react";
import type { Plan, Day, Activity } from "@/lib/types";
import { ActivityCard } from "./ActivityCard";
import { RunningLateModal } from "./RunningLateModal";
import { TripCopilotModal } from "./TripCopilotModal";
import { reflow, total, hm, toMin, fmt } from "@/lib/engine";
import { ClockIcon, SparklesIcon, AlertTriangleIcon } from "./Icons";

interface TimelineViewProps {
  plan: Plan;
  dayIdx: number;
  setDayIdx: (idx: number) => void;
  onUpdatePlan: (newPlan: Plan) => void;
}

export function TimelineView({ plan, dayIdx, setDayIdx, onUpdatePlan }: TimelineViewProps) {
  const [lateModalOpen, setLateModalOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);

  // Custom activity form state
  const [custName, setCustName] = useState("");
  const [custKind, setCustKind] = useState<"attraction" | "meal">("attraction");
  const [custDur, setCustDur] = useState("60");
  const [custWait, setCustWait] = useState("15");
  const [custIndoor, setCustIndoor] = useState(false);

  const day = plan.days[dayIdx] || plan.days[0];
  if (!day) return null;

  const reflowResult = reflow(day);
  const warnings = reflowResult.warnings;
  const conflicts = reflowResult.conflicts;

  const currentActIdx = day.activities.findIndex((a) => !a.done);

  const setDay = (updatedDay: Day) => {
    onUpdatePlan({
      ...plan,
      days: plan.days.map((d, i) => (i === dayIdx ? updatedDay : d)),
    });
  };

  const handleUpdateActivity = (id: string, patch: Partial<Activity>, reflowFrom = true) => {
    const actIdx = day.activities.findIndex((a) => a.id === id);
    if (actIdx < 0) return;

    const updatedActs = day.activities.map((a) => (a.id === id ? { ...a, ...patch } : a));
    const newDay = reflowFrom
      ? reflow({ ...day, activities: updatedActs }, actIdx).day
      : { ...day, activities: updatedActs };

    setDay(newDay);
  };

  const handleRemoveActivity = (id: string) => {
    const target = day.activities.find((a) => a.id === id);
    if (!target) return;

    const remaining = day.activities.filter((a) => a.id !== id);
    const reflowed = reflow({ ...day, activities: remaining }, 0).day;

    onUpdatePlan({
      ...plan,
      alternatives: [...plan.alternatives, target],
      days: plan.days.map((d, i) => (i === dayIdx ? reflowed : d)),
    });
  };

  const handleReplaceActivity = (id: string, alt: Activity) => {
    const old = day.activities.find((a) => a.id === id);
    if (!old) return;

    const actIdx = day.activities.findIndex((a) => a.id === id);
    const replacement: Activity = {
      ...alt,
      start: old.start,
      kind: old.kind,
    };

    const updatedActs = [...day.activities];
    updatedActs[actIdx] = replacement;

    const reflowed = reflow({ ...day, activities: updatedActs }, actIdx).day;

    onUpdatePlan({
      ...plan,
      alternatives: [...plan.alternatives.filter((x) => x.id !== alt.id), old],
      days: plan.days.map((d, i) => (i === dayIdx ? reflowed : d)),
    });
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) return;

    const last = day.activities[day.activities.length - 1];
    const newStart = last ? fmt(toMin(last.start) + total(last) + 20) : "10:00";

    const customAct: Activity = {
      id: "cust_" + Date.now(),
      name: custName.trim(),
      kind: custKind,
      indoor: custIndoor,
      priority: 2,
      ticket: null,
      waitMin: custWait ? Number(custWait) : null,
      waitLabel: custWait ? "Estimated waiting time" : "Waiting time unavailable",
      visitMin: Number(custDur) || 60,
      open: "09:00",
      close: "21:00",
      start: newStart,
      reason: "Custom activity added by traveler.",
      transport: { method: "Taxi/cab", durationMin: 15, cost: 150 },
      extras: [],
      done: false,
    };

    const newActs = [...day.activities, customAct];
    const reflowed = reflow({ ...day, activities: newActs }, day.activities.length).day;
    setDay(reflowed);

    setCustName("");
    setCustomModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Day Selector & Quick Action Bar */}
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-lagoon">
              {plan.destination}
            </span>
            <h2 className="text-xl font-extrabold text-ink">
              Day {dayIdx + 1} Itinerary Timeline
            </h2>
            <p className="text-xs text-ink/60 mt-0.5">{day.date} · Feasible, time-buffered schedule</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setLateModalOpen(true)}
              className="btn !bg-amber !text-ink !rounded-2xl !py-2 text-xs font-bold shadow-sm flex items-center gap-1.5"
            >
              <ClockIcon className="w-4 h-4" />
              <span>I'm Running Late</span>
            </button>

            <button
              onClick={() => setCopilotOpen(true)}
              className="btn !bg-lagoon text-white !rounded-2xl !py-2 text-xs font-bold shadow-sm flex items-center gap-1.5"
            >
              <SparklesIcon className="w-4 h-4" />
              <span>Trip Copilot</span>
            </button>

            <button
              onClick={() => setCustomModalOpen(true)}
              className="btn2 !rounded-2xl !py-2 text-xs font-bold"
            >
              + Add Place
            </button>
          </div>
        </div>

        {/* Day selection tabs */}
        <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-ink/10">
          {plan.days.map((d, i) => {
            const dayDone = d.activities.filter((a) => a.done).length;
            const dayTot = d.activities.length;
            return (
              <button
                key={d.date}
                onClick={() => setDayIdx(i)}
                className={`rounded-2xl px-4 py-2 text-xs font-bold transition flex items-center gap-2 ${
                  i === dayIdx
                    ? "bg-ink text-white shadow-sm"
                    : "bg-paper text-ink/70 hover:bg-ink/10"
                }`}
              >
                <span>Day {i + 1}</span>
                <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                  {dayDone}/{dayTot}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Schedule Conflicts & Feasibility Alerts */}
      {conflicts.length > 0 && (
        <div className="rounded-2xl border-2 border-alert bg-red-50 p-4 text-alert text-xs space-y-1">
          <div className="font-extrabold flex items-center gap-1.5">
            <AlertTriangleIcon className="w-4 h-4" />
            <span>Feasibility Conflict Detected:</span>
          </div>
          {conflicts.map((c, i) => (
            <p key={i}>• {c}</p>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber/40 bg-amber/10 p-3.5 text-xs text-ink space-y-1">
          <span className="font-bold text-amber block">Schedule Notice:</span>
          {warnings.map((w, i) => (
            <p key={i}>• {w}</p>
          ))}
        </div>
      )}

      {/* Vertical Timeline */}
      <div className="space-y-4">
        {day.activities.map((act, idx) => {
          const prev = idx > 0 ? day.activities[idx - 1] : null;
          const status = act.done
            ? "completed"
            : idx === currentActIdx
            ? "current"
            : "upcoming";

          return (
            <div key={act.id} className="relative">
              <ActivityCard
                a={act}
                idx={idx}
                prevName={prev ? prev.name : `${plan.hotel.name} (Hotel)`}
                status={status}
                plan={plan}
                onUpdate={handleUpdateActivity}
                onRemove={handleRemoveActivity}
                onReplace={handleReplaceActivity}
              />
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {lateModalOpen && (
        <RunningLateModal
          day={day}
          onApply={(updatedDay) => setDay(updatedDay)}
          onClose={() => setLateModalOpen(false)}
        />
      )}

      {copilotOpen && (
        <TripCopilotModal
          plan={plan}
          dayIdx={dayIdx}
          onApplyPlan={(updatedPlan) => onUpdatePlan(updatedPlan)}
          onClose={() => setCopilotOpen(false)}
        />
      )}

      {/* Add Custom Place Modal */}
      {customModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-ink/10">
            <div className="flex items-center justify-between pb-3 border-b border-ink/10">
              <h3 className="text-lg font-bold text-ink">Add Custom Place to Day {dayIdx + 1}</h3>
              <button onClick={() => setCustomModalOpen(false)} className="rounded-full p-1 text-ink/40">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustom} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-ink block mb-1">Place Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nahargarh Biological Park"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="inp text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-ink block mb-1">Type</label>
                  <select
                    value={custKind}
                    onChange={(e) => setCustKind(e.target.value as any)}
                    className="inp text-xs"
                  >
                    <option value="attraction">Attraction</option>
                    <option value="meal">Dining / Meal</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-ink block mb-1">Environment</label>
                  <select
                    value={custIndoor ? "indoor" : "outdoor"}
                    onChange={(e) => setCustIndoor(e.target.value === "indoor")}
                    className="inp text-xs"
                  >
                    <option value="outdoor">Outdoor</option>
                    <option value="indoor">Indoor</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-ink block mb-1">Visit Duration (min)</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={custDur}
                    onChange={(e) => setCustDur(e.target.value)}
                    className="inp text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-ink block mb-1">Estimated Wait (min)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={custWait}
                    onChange={(e) => setCustWait(e.target.value)}
                    className="inp text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-ink/10">
                <button
                  type="button"
                  onClick={() => setCustomModalOpen(false)}
                  className="btn2 !rounded-2xl"
                >
                  Cancel
                </button>
                <button type="submit" className="btn !bg-lagoon text-white !rounded-2xl">
                  Add Place &amp; Re-time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
