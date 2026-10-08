"use client";
import React, { useState } from "react";
import type { Plan } from "@/lib/types";
import { budget } from "@/lib/engine";

const inr = (n: number | null) => (n == null ? "—" : "₹" + Math.round(n).toLocaleString("en-IN"));

interface BudgetViewProps {
  plan: Plan;
  onUpdateBudget?: (newBudget: number) => void;
}

export function BudgetView({ plan, onUpdateBudget }: BudgetViewProps) {
  const [editingBudget, setEditingBudget] = useState(false);
  const [newBudgetVal, setNewBudgetVal] = useState(String(plan.budget));

  const b = budget(plan);

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(newBudgetVal);
    if (!isNaN(val) && val > 0 && onUpdateBudget) {
      onUpdateBudget(val);
      setEditingBudget(false);
    }
  };

  // Collect all hidden/extra costs across activities
  const allExtras: { place: string; label: string; amount: number | null; kind: string; category?: string }[] = [];
  plan.days.forEach((d) => {
    d.activities.forEach((a) => {
      a.extras.forEach((e) => {
        allExtras.push({
          place: a.name,
          label: e.label,
          amount: e.amount,
          kind: e.kind,
          category: e.category,
        });
      });
    });
  });

  return (
    <div className="space-y-5">
      {/* Overview Card */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-ink/10">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-ink/10">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-lagoon">
              Financial Management
            </span>
            <h2 className="text-xl font-black text-ink">Trip Budget &amp; Hidden Costs</h2>
          </div>

          <div className="flex items-center gap-2">
            {!editingBudget ? (
              <button
                onClick={() => setEditingBudget(true)}
                className="btn2 !rounded-2xl !py-1.5 text-xs font-bold"
              >
                Edit Total Budget (₹{plan.budget.toLocaleString("en-IN")})
              </button>
            ) : (
              <form onSubmit={handleSaveBudget} className="flex items-center gap-2">
                <input
                  type="number"
                  min="500"
                  step="500"
                  value={newBudgetVal}
                  onChange={(e) => setNewBudgetVal(e.target.value)}
                  className="inp !w-36 text-xs font-bold"
                  autoFocus
                />
                <button type="submit" className="btn !bg-lagoon text-white !rounded-xl !py-1 text-xs">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingBudget(false)}
                  className="btn2 !rounded-xl !py-1 text-xs"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Top Numbers Grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-paper p-4">
            <span className="text-[11px] font-bold uppercase text-ink/50 block">Total Budget</span>
            <span className="text-xl font-black text-ink block mt-1">{inr(plan.budget)}</span>
            <span className="text-[10px] text-ink/50">User allocated</span>
          </div>

          <div className="rounded-2xl bg-paper p-4">
            <span className="text-[11px] font-bold uppercase text-ink/50 block">Planned Spending</span>
            <span className="text-xl font-black text-ink block mt-1">{inr(b.planned)}</span>
            <span className="text-[10px] text-ink/50">Sum of all categories</span>
          </div>

          <div className={`rounded-2xl p-4 ${b.over ? "bg-red-50 text-alert" : "bg-paper text-ink"}`}>
            <span className="text-[11px] font-bold uppercase block opacity-70">
              {b.over ? "Over-Budget Amount" : "Remaining Buffer"}
            </span>
            <span className="text-xl font-black block mt-1">
              {b.over ? `+${inr(b.overAmount)}` : inr(b.remaining)}
            </span>
            <span className="text-[10px] opacity-70">
              {b.over ? "Exceeds set limit" : "Available to spend"}
            </span>
          </div>

          <div className="rounded-2xl bg-paper p-4">
            <span className="text-[11px] font-bold uppercase text-ink/50 block">Data Integrity</span>
            <span className="text-xl font-black text-ink block mt-1">
              {b.unknown} {b.unknown === 1 ? "Item" : "Items"}
            </span>
            <span className="text-[10px] text-ink/50">Awaiting official pricing</span>
          </div>
        </div>

        {/* Over-Budget Warning Banner */}
        {b.over && (
          <div className="mt-5 rounded-2xl border-2 border-alert bg-alert/10 p-4 text-xs text-alert font-bold">
            ⚠ Warning: Your current plan is approximately <b>{inr(b.overAmount)}</b> above your budget.
            Consider replacing or removing paid attractions in the Itinerary or selecting alternative hotels.
          </div>
        )}

        {/* Category Breakdown Table */}
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
            Category Breakdown ({plan.travelers} Travelers)
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-paper">
              <span className="font-semibold text-ink">🏨 Accommodation ({Math.max(1, plan.days.length - 1)} Nights)</span>
              <span className="font-bold text-ink">{inr(b.acc)}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-paper">
              <span className="font-semibold text-ink">🚕 Transportation ({plan.days.length} Days transit buffer)</span>
              <span className="font-bold text-ink">{inr(b.transport)}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-paper">
              <span className="font-semibold text-ink">🍽️ Food &amp; Dining ({plan.diet} preference)</span>
              <span className="font-bold text-ink">{inr(b.food)}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-paper">
              <span className="font-semibold text-ink">🎟️ Attraction Entry Tickets</span>
              <span className="font-bold text-ink">{inr(b.attractions)}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-paper">
              <span className="font-semibold text-ink">🧾 Known Additional Fees (Lockers, booking fees, permits)</span>
              <span className="font-bold text-ink">{inr(b.known)}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-paper">
              <span className="font-semibold text-ink">📊 Estimated Incidental Expenses (Tips, audio guides)</span>
              <span className="font-bold text-ink">{inr(b.est)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden-Cost Detection Panel */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-ink/10 space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber">
            Transparency Engine
          </span>
          <h3 className="text-lg font-bold text-ink">Hidden-Cost &amp; Fee Detection</h3>
          <p className="text-xs text-ink/60 mt-0.5">
            We separate base entry prices from mandatory charges, booking fees, and lockers so you face no surprises.
          </p>
        </div>

        {allExtras.length > 0 ? (
          <div className="space-y-2">
            {allExtras.map((ex, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-2xl border border-ink/10 text-xs"
              >
                <div>
                  <span className="font-bold text-ink">{ex.label}</span>
                  <span className="text-ink/50 ml-2">at {ex.place}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      ex.kind === "known"
                        ? "bg-lagoon/15 text-lagoon"
                        : ex.kind === "estimated"
                        ? "bg-amber/20 text-ink"
                        : "bg-ink/10 text-ink/60"
                    }`}
                  >
                    {ex.kind}
                  </span>
                  <span className="font-extrabold text-ink">{inr(ex.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-paper p-4 text-xs text-ink/60 text-center">
            No mandatory hidden fees detected for the current planned attractions.
          </div>
        )}

        <div className="rounded-2xl bg-paper p-3 text-[11px] text-ink/60 leading-relaxed">
          <b>Data Integrity Commitment:</b> We never fabricate hidden costs or prices. If pricing or fees
          for a monument are unavailable, they are tagged as "Unknown" rather than invented.
        </div>
      </div>
    </div>
  );
}
