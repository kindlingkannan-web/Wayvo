"use client";
import React, { useState } from "react";
import type { GroupContribution } from "@/lib/paymentTypes";

interface GroupContributionsProps {
  contributions: GroupContribution[];
  totalTripCost: number;
  travelersCount: number;
  onPayForMember: (name: string, suggestedAmount: number) => void;
  onRefreshContributions?: () => void;
}

const inr = (n: number | null) => (n == null ? "—" : "₹" + Math.round(n).toLocaleString("en-IN"));

export function GroupContributions({
  contributions,
  totalTripCost,
  travelersCount,
  onPayForMember,
}: GroupContributionsProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const suggestedPerPerson = Math.round(totalTripCost / Math.max(1, travelersCount));
  const totalCollected = contributions.reduce((acc, c) => acc + c.paidAmount, 0);
  const totalRemaining = Math.max(0, totalTripCost - totalCollected);

  return (
    <div className="rounded-3xl bg-white dark:bg-darkcard p-6 shadow-sm ring-1 ring-ink/10 dark:ring-white/10 transition-colors space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-ink/10 dark:border-white/10">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber">
            Group Trip Management
          </span>
          <h3 className="text-lg font-bold text-ink dark:text-white">Group Trip Contributions</h3>
          <p className="text-xs text-ink/60 dark:text-slate-400 mt-0.5">
            Fair equal-split tracking for group travel. Record and verify contributions processed through PayPal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-2xl bg-paper dark:bg-darkpaper px-3 py-1.5 text-xs font-bold text-ink dark:text-white">
            {travelersCount} Travelers · {inr(suggestedPerPerson)} / person
          </span>
        </div>
      </div>

      {/* Progress Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-paper dark:bg-darkpaper p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink/50 dark:text-slate-400 block">
            Total Group Goal
          </span>
          <span className="text-lg font-black text-ink dark:text-white block mt-0.5">
            {inr(totalTripCost)}
          </span>
          <span className="text-[10px] text-ink/50 dark:text-slate-400">
            For {travelersCount} travelers
          </span>
        </div>

        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block">
            Collected via PayPal
          </span>
          <span className="text-lg font-black text-emerald-700 dark:text-emerald-400 block mt-0.5">
            {inr(totalCollected)}
          </span>
          <span className="text-[10px] text-emerald-800/70 dark:text-emerald-400/70">
            Verified server-side
          </span>
        </div>

        <div className="rounded-2xl bg-paper dark:bg-darkpaper p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink/50 dark:text-slate-400 block">
            Group Outstanding
          </span>
          <span className="text-lg font-black text-ink dark:text-white block mt-0.5">
            {inr(totalRemaining)}
          </span>
          <span className="text-[10px] text-ink/50 dark:text-slate-400">
            Remaining to be funded
          </span>
        </div>
      </div>

      {/* Participant List */}
      <div className="space-y-2.5 pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-ink/50 dark:text-slate-400">
          Individual Participant Status
        </h4>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {contributions.map((c, idx) => {
            const remainingForPerson = Math.max(0, c.targetAmount - c.paidAmount);
            const pct = c.targetAmount > 0 ? Math.min(100, Math.round((c.paidAmount / c.targetAmount) * 100)) : 0;
            const isCompleted = c.paidAmount >= c.targetAmount && c.targetAmount > 0;

            return (
              <div
                key={c.id || idx}
                className="rounded-2xl border border-ink/10 dark:border-white/10 p-3.5 space-y-2 bg-paper/30 dark:bg-darkpaper/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-lagoon/20 text-lagoon flex items-center justify-center text-xs font-black">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-xs text-ink dark:text-white">
                      {c.name}
                    </span>
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      isCompleted
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400"
                        : c.paidAmount > 0
                        ? "bg-amber/20 text-amber-800 dark:text-amber-400"
                        : "bg-ink/10 dark:bg-white/10 text-ink/60 dark:text-slate-400"
                    }`}
                  >
                    {isCompleted ? "✓ Paid" : c.paidAmount > 0 ? "Partial" : "Unpaid"}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-ink/70 dark:text-slate-300">
                    <span>
                      Paid: <b>{inr(c.paidAmount)}</b>
                    </span>
                    <span>
                      Target: <b>{inr(c.targetAmount)}</b>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-ink/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-lagoon transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {!isCompleted && (
                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => onPayForMember(c.name, remainingForPerson)}
                      className="rounded-xl bg-lagoon px-3 py-1 text-xs font-bold text-white hover:bg-lagoon/90 transition shadow-sm"
                    >
                      Pay ₹{Math.round(remainingForPerson).toLocaleString("en-IN")} via PayPal
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl bg-paper dark:bg-darkpaper p-3 text-[11px] text-ink/60 dark:text-slate-400 leading-relaxed">
        <b>Transparency Notice:</b> All group contributions are securely processed through the configured PayPal Checkout merchant account. Wayvo maintains an independent audit log for each participant to ensure complete group financial clarity.
      </div>
    </div>
  );
}
