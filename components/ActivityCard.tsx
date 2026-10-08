"use client";
import React, { useState } from "react";
import { ClockIcon, AlertTriangleIcon, CheckCircleIcon } from "./Icons";
import { total, hm, toMin, fmt } from "@/lib/engine";
import type { Activity, Plan, Transportation } from "@/lib/types";
import { CabBookingModal } from "./CabBookingModal";

const inr = (n: number | null) => (n == null ? "Price unavailable" : "₹" + Math.round(n).toLocaleString("en-IN"));

interface ActivityCardProps {
  a: Activity;
  idx: number;
  prevName?: string;
  status: "completed" | "current" | "upcoming";
  plan: Plan;
  onUpdate: (id: string, patch: Partial<Activity>, reflowFrom?: boolean) => void;
  onRemove: (id: string) => void;
  onReplace: (id: string, alt: Activity) => void;
}

export function ActivityCard({
  a,
  idx,
  prevName = "Accommodation / Prior Location",
  status,
  plan,
  onUpdate,
  onRemove,
  onReplace,
}: ActivityCardProps) {
  const [showCabModal, setShowCabModal] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editTimeVal, setEditTimeVal] = useState(a.start);

  const totalMin = total(a);
  const isLongWait = (a.waitMin ?? 0) >= 45;

  // Matching alternatives for this activity
  const alts = (plan.alternatives || []).filter(
    (x) => x.kind === a.kind && total(x) <= totalMin + 45
  );

  const transportObj: Transportation =
    typeof a.transport === "object"
      ? a.transport
      : { method: "Taxi/cab", durationMin: 20, cost: 200, notes: String(a.transport) };

  const handleTimeBlur = () => {
    setIsEditingTime(false);
    if (editTimeVal && editTimeVal !== a.start) {
      onUpdate(a.id, { start: editTimeVal }, true);
    }
  };

  return (
    <div
      className={`relative rounded-3xl bg-white p-5 shadow-sm ring-1 transition ${
        status === "current"
          ? "ring-2 ring-lagoon shadow-md"
          : a.done
          ? "ring-ink/10 opacity-75 bg-paper/50"
          : "ring-ink/10 hover:shadow-md"
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                a.done
                  ? "bg-ink/10 text-ink/70"
                  : status === "current"
                  ? "bg-lagoon text-white animate-pulse"
                  : "bg-paper text-ink/60"
              }`}
            >
              {a.done ? "Completed" : status === "current" ? "Current Stop" : "Upcoming"}
            </span>

            <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-ink/60">
              {a.indoor ? "🏛️ Indoor" : "☀️ Outdoor"}
            </span>

            <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-ink/60">
              Priority {a.priority === 1 ? "1 (Must-see)" : a.priority === 2 ? "2 (Recommended)" : "3 (Flexible)"}
            </span>

            {a.fixed && (
              <span className="rounded-full bg-lagoon/10 text-lagoon px-2 py-0.5 text-xs font-semibold">
                Locked ✓
              </span>
            )}
          </div>

          <h3 className="text-lg font-extrabold text-ink flex items-center gap-2">
            <span>{a.kind === "meal" ? "🍽️" : "📍"}</span>
            <span>{a.name}</span>
          </h3>

          {a.description && <p className="text-xs text-ink/70 max-w-2xl">{a.description}</p>}
        </div>

        {/* Visited Toggle */}
        <label className="flex cursor-pointer items-center gap-2 rounded-2xl bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:bg-ink/10 transition">
          <input
            type="checkbox"
            checked={a.done}
            onChange={(e) => onUpdate(a.id, { done: e.target.checked }, false)}
            className="rounded text-lagoon focus:ring-lagoon"
          />
          <span>{a.done ? "Visited ✓" : "Mark Visited"}</span>
        </label>
      </div>

      {/* Structured Time & Visiting Stats Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-2xl bg-paper p-3.5 text-xs">
        <div>
          <span className="text-ink/50 uppercase font-semibold text-[10px] block">Arrival Time</span>
          {isEditingTime ? (
            <input
              type="time"
              value={editTimeVal}
              onChange={(e) => setEditTimeVal(e.target.value)}
              onBlur={handleTimeBlur}
              autoFocus
              className="mt-0.5 rounded border border-ink/20 px-1 py-0.5 text-xs"
            />
          ) : (
            <button
              onClick={() => setIsEditingTime(true)}
              className="mt-0.5 font-bold text-sm text-ink hover:text-lagoon flex items-center gap-1"
              title="Click to change start time"
            >
              <span>{a.start}</span>
              <span className="text-[10px] text-ink/40 font-normal">✎</span>
            </button>
          )}
        </div>

        <div>
          <span className="text-ink/50 uppercase font-semibold text-[10px] block">Opening Hours</span>
          <span className="mt-0.5 font-bold text-sm text-ink block">
            {a.open || "09:00"} – {a.close || "18:00"}
          </span>
          <span className="text-[10px] text-ink/40 italic">verify on site</span>
        </div>

        <div>
          <span className="text-ink/50 uppercase font-semibold text-[10px] block">Ticket / Cost</span>
          <span className="mt-0.5 font-bold text-sm text-ink block">
            {a.ticket == null ? "Check official source" : inr(a.ticket)}
          </span>
          <span className="text-[10px] text-ink/40">
            {a.ticket != null ? "per traveler (approx.)" : "unknown"}
          </span>
        </div>

        <div>
          <span className="text-ink/50 uppercase font-semibold text-[10px] block">Expected Queue</span>
          <span className="mt-0.5 font-bold text-sm text-ink block">
            {a.waitMin != null ? `${a.waitMin} min` : "No queue / N/A"}
          </span>
          <span className="text-[10px] text-ink/40 italic">{a.waitLabel}</span>
        </div>
      </div>

      {/* HIGHLIGHTED TOTAL TIME REQUIRED */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-lagoon/10 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-1.5 text-lagoon font-bold">
          <ClockIcon className="w-4 h-4" />
          <span>TOTAL TIME REQUIRED:</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-ink/70">
            Queue: <b>{a.waitMin ? `${a.waitMin}m` : "0m"}</b> + Visit: <b>{hm(a.visitMin)}</b> =
          </span>
          <span className="rounded-xl bg-lagoon px-2.5 py-1 text-sm font-extrabold text-white shadow-sm">
            {hm(totalMin)}
          </span>
        </div>
      </div>

      {/* Explainable Recommendation Reason */}
      <div className="mt-3 text-xs text-ink/80 flex items-start gap-1.5">
        <span className="text-amber">💡</span>
        <div>
          <span className="font-semibold text-ink">Why recommended: </span>
          <span>{a.reason || "Selected to fit group dynamics and time feasibility."}</span>
        </div>
      </div>

      {/* Transportation Segment from previous stop */}
      <div className="mt-3 rounded-2xl border border-ink/10 bg-paper/60 p-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-ink/70">
            <span>🚗</span>
            <span>
              Transit from <b>{prevName}</b>: {transportObj.method} ({transportObj.durationMin} min
              {transportObj.cost != null ? `, ~₹${transportObj.cost}` : ""})
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowCabModal(true)}
            className="rounded-xl bg-ink/5 px-2.5 py-1 font-semibold text-ink hover:bg-ink/10 transition text-[11px]"
          >
            Book Cab / Ride ➔
          </button>
        </div>
      </div>

      {/* Hidden Cost / Add-ons Detection */}
      {a.extras && a.extras.length > 0 && (
        <div className="mt-3 rounded-2xl bg-amber/10 p-2.5 text-xs text-ink/80 border border-amber/20">
          <span className="font-bold text-ink">Additional Fees Detected: </span>
          {a.extras.map((e, i) => (
            <span key={i} className="inline-block mr-2">
              • {e.label}: <b>{inr(e.amount)}</b> ({e.kind})
            </span>
          ))}
        </div>
      )}

      {/* Long-Wait Intelligence Banner */}
      {isLongWait && (
        <div className="mt-3 rounded-2xl border-2 border-amber bg-amber/15 p-3.5 text-xs text-ink">
          <div className="flex items-center gap-2 font-bold text-ink">
            <AlertTriangleIcon className="w-4 h-4 text-amber" />
            <span>Long wait expected ({a.waitMin} min). This may make today's itinerary difficult to complete.</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={() => onUpdate(a.id, { fixed: true })}
              className="rounded-xl bg-white px-3 py-1.5 font-bold text-ink shadow-sm ring-1 ring-ink/10 hover:bg-paper"
            >
              KEEP (Lock Attraction)
            </button>

            {alts.length > 0 ? (
              <select
                value=""
                onChange={(e) => {
                  const alt = plan.alternatives.find((x) => x.id === e.target.value);
                  if (alt) onReplace(a.id, alt);
                }}
                className="rounded-xl bg-white px-3 py-1.5 font-bold text-lagoon shadow-sm ring-1 ring-ink/10"
              >
                <option value="">REPLACE (Choose Alternative)…</option>
                {alts.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({hm(total(x))})
                  </option>
                ))}
              </select>
            ) : (
              <button
                onClick={() => onRemove(a.id)}
                className="rounded-xl bg-white px-3 py-1.5 font-bold text-amber shadow-sm ring-1 ring-ink/10"
              >
                SWAP WITH EXPLORE
              </button>
            )}

            <button
              onClick={() => onRemove(a.id)}
              className="rounded-xl bg-white px-3 py-1.5 font-bold text-alert shadow-sm ring-1 ring-ink/10 hover:bg-alert/10"
            >
              REMOVE
            </button>
          </div>
        </div>
      )}

      {/* General Controls Toolbar */}
      {!isLongWait && (
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-ink/5 text-xs">
          <button
            onClick={() => onUpdate(a.id, { fixed: !a.fixed })}
            className={`btn2 !rounded-xl !py-1.5 ${a.fixed ? "!bg-lagoon/15 !text-lagoon font-bold" : ""}`}
          >
            {a.fixed ? "Locked in Itinerary ✓" : "Keep / Lock"}
          </button>

          {alts.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const alt = plan.alternatives.find((x) => x.id === e.target.value);
                if (alt) onReplace(a.id, alt);
              }}
              className="btn2 !rounded-xl !py-1.5"
            >
              <option value="">Swap with alternative…</option>
              {alts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({hm(total(x))})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => onRemove(a.id)}
            className="btn2 !rounded-xl !py-1.5 !text-alert hover:!bg-alert/10"
          >
            Remove
          </button>
        </div>
      )}

      {/* Cab Booking Modal */}
      {showCabModal && (
        <CabBookingModal
          destination={plan.destination}
          transport={a.transport}
          fromName={prevName}
          toName={a.name}
          onClose={() => setShowCabModal(false)}
        />
      )}
    </div>
  );
}
