"use client";
import React, { useState, useEffect } from "react";
import type { Plan } from "@/lib/types";
import { budget } from "@/lib/engine";
import type { PaymentTransaction, TripPaymentSummary, GroupContribution } from "@/lib/paymentTypes";
import { PaymentModal } from "./PaymentModal";
import { GroupContributions } from "./GroupContributions";
import { TransactionHistory } from "./TransactionHistory";
import { AIBudgetAssistant } from "./AIBudgetAssistant";

const inr = (n: number | null) => (n == null ? "—" : "₹" + Math.round(n).toLocaleString("en-IN"));

interface BudgetViewProps {
  plan: Plan;
  onUpdateBudget?: (newBudget: number) => void;
  onUpdatePlan?: (updatedPlan: Plan) => void;
}

export function BudgetView({ plan, onUpdateBudget, onUpdatePlan }: BudgetViewProps) {
  const [editingBudget, setEditingBudget] = useState(false);
  const [newBudgetVal, setNewBudgetVal] = useState(String(plan.budget));

  const b = budget(plan);
  const plannedCost = Math.round(b.planned);

  // Payment integration state
  const [summary, setSummary] = useState<TripPaymentSummary>({
    tripId: plan.id,
    totalTripCost: plannedCost,
    totalPaid: 0,
    remainingBalance: plannedCost,
    currency: "INR",
    contributorCount: plan.travelers || 1,
    updatedAt: new Date().toISOString(),
  });
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [contributions, setContributions] = useState<GroupContribution[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  // Modal controls
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [modalInitialAmount, setModalInitialAmount] = useState<number | undefined>(undefined);
  const [modalInitialContributor, setModalInitialContributor] = useState<string | undefined>(undefined);

  // Fetch verified transactions and group contributions
  const fetchPaymentData = async () => {
    try {
      const tripAccessKey = typeof window !== "undefined" ? sessionStorage.getItem(`trip_key_${plan.id}`) : null;
      const authHeaders: Record<string, string> = tripAccessKey ? { "x-trip-access-key": tripAccessKey } : {};

      const [txRes, groupRes] = await Promise.all([
        fetch(`/api/paypal/transactions?tripId=${encodeURIComponent(plan.id)}&totalCost=${plannedCost}`, {
          headers: authHeaders,
        }),
        fetch(
          `/api/paypal/group-contributions?tripId=${encodeURIComponent(plan.id)}&travelers=${
            plan.travelers
          }&totalCost=${plannedCost}`,
          { headers: authHeaders }
        ),
      ]);

      if (txRes.ok) {
        const txData = await txRes.json();
        if (txData.summary) {
          setSummary(txData.summary);
        }
        if (Array.isArray(txData.transactions)) {
          setTransactions(txData.transactions);
        }
      }

      if (groupRes.ok) {
        const groupData = await groupRes.json();
        if (Array.isArray(groupData.contributions)) {
          setContributions(groupData.contributions);
        }
      }
    } catch (err) {
      console.warn("Failed to load payment records:", err);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    fetchPaymentData();
  }, [plan.id, plannedCost]);

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(newBudgetVal);
    if (!isNaN(val) && val > 0 && onUpdateBudget) {
      onUpdateBudget(val);
      setEditingBudget(false);
    }
  };

  // Open checkout modal with pre-configured settings
  const handleOpenPayment = (amount?: number, contributor?: string) => {
    setModalInitialAmount(amount);
    setModalInitialContributor(contributor);
    setPaymentModalOpen(true);
  };

  // Handle successful verified payment
  const handlePaymentSuccess = (updatedSummary: TripPaymentSummary, tx: PaymentTransaction) => {
    setSummary(updatedSummary);
    setTransactions((prev) => [tx, ...prev]);
    fetchPaymentData();

    if (onUpdatePlan) {
      onUpdatePlan({
        ...plan,
        paymentSummary: updatedSummary,
      });
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

  const fundingPct =
    summary.totalTripCost > 0
      ? Math.min(100, Math.round((summary.totalPaid / summary.totalTripCost) * 100))
      : 0;
  const isFullyFunded = summary.remainingBalance <= 0;

  return (
    <div className="space-y-6">
      {/* SECTION: WAYVO SMART TRIP CHECKOUT & PAYMENT INTEGRATION */}
      <div className="rounded-3xl bg-white dark:bg-darkcard p-6 shadow-sm ring-1 ring-ink/10 dark:ring-white/10 transition-colors space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-ink/10 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-lagoon px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                PayPal Integration
              </span>
              <span className="text-xs font-semibold text-ink/50 dark:text-slate-400">
                Official REST Checkout
              </span>
            </div>
            <h2 className="text-xl font-black text-ink dark:text-white mt-1">
              Trip Payment &amp; Checkout
            </h2>
            <p className="text-xs text-ink/60 dark:text-slate-400 mt-0.5">
              Securely fund your planned itinerary via PayPal with real-time balance tracking.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isFullyFunded ? (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenPayment(summary.remainingBalance)}
                  className="btn !bg-lagoon text-white !rounded-2xl px-4 py-2 text-xs font-bold shadow-sm hover:scale-[1.02] transition"
                >
                  Pay Full Balance ({inr(summary.remainingBalance)})
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenPayment(Math.min(5000, summary.remainingBalance))}
                  className="btn2 !rounded-2xl px-3 py-2 text-xs font-bold"
                >
                  Make Partial Payment
                </button>
              </>
            ) : (
              <span className="rounded-2xl bg-emerald-100 dark:bg-emerald-950 px-4 py-2 text-xs font-black text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                <span>✓</span>
                <span>Trip 100% Funded via PayPal</span>
              </span>
            )}
          </div>
        </div>

        {/* Funding Numbers Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-paper dark:bg-darkpaper p-4">
            <span className="text-[11px] font-bold uppercase text-ink/50 dark:text-slate-400 block">
              Estimated Trip Cost
            </span>
            <span className="text-xl font-black text-ink dark:text-white block mt-1">
              {inr(summary.totalTripCost)}
            </span>
            <span className="text-[10px] text-ink/50 dark:text-slate-400">Planned itemized total</span>
          </div>

          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4">
            <span className="text-[11px] font-bold uppercase text-emerald-800 dark:text-emerald-400 block">
              Already Paid
            </span>
            <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 block mt-1">
              {inr(summary.totalPaid)}
            </span>
            <span className="text-[10px] text-emerald-800/70 dark:text-emerald-400/70">
              Captured via PayPal
            </span>
          </div>

          <div className="rounded-2xl bg-paper dark:bg-darkpaper p-4">
            <span className="text-[11px] font-bold uppercase text-ink/50 dark:text-slate-400 block">
              Remaining Balance
            </span>
            <span className="text-xl font-black text-lagoon block mt-1">
              {inr(summary.remainingBalance)}
            </span>
            <span className="text-[10px] text-ink/50 dark:text-slate-400">
              {isFullyFunded ? "All payments completed" : "Outstanding balance"}
            </span>
          </div>

          <div className="rounded-2xl bg-paper dark:bg-darkpaper p-4">
            <span className="text-[11px] font-bold uppercase text-ink/50 dark:text-slate-400 block">
              Funding Progress
            </span>
            <span className="text-xl font-black text-ink dark:text-white block mt-1">
              {fundingPct}%
            </span>
            <span className="text-[10px] text-ink/50 dark:text-slate-400">
              {transactions.length} verified payment{transactions.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-xs font-semibold text-ink/60 dark:text-slate-400">
            <span>Trip Funding Progress</span>
            <span>{inr(summary.totalPaid)} of {inr(summary.totalTripCost)} ({fundingPct}%)</span>
          </div>
          <div className="h-3 w-full rounded-full bg-paper dark:bg-darkpaper overflow-hidden ring-1 ring-ink/5 dark:ring-white/5">
            <div
              className="h-full rounded-full bg-lagoon transition-all duration-500 ease-out"
              style={{ width: `${fundingPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* SECTION: GROUP TRIP CONTRIBUTIONS */}
      <GroupContributions
        contributions={contributions}
        totalTripCost={summary.totalTripCost}
        travelersCount={plan.travelers}
        onPayForMember={(name, amt) => handleOpenPayment(amt, name)}
        onRefreshContributions={fetchPaymentData}
      />

      {/* SECTION: AI BUDGET ASSISTANT */}
      <AIBudgetAssistant
        plan={plan}
        totalPaid={summary.totalPaid}
        remainingBalance={summary.remainingBalance}
      />

      {/* SECTION: ORIGINAL BUDGET & HIDDEN COSTS OVERVIEW */}
      <div className="rounded-3xl bg-white dark:bg-darkcard p-6 shadow-sm ring-1 ring-ink/10 dark:ring-white/10 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-ink/10 dark:border-white/10">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-lagoon">
              Financial Management
            </span>
            <h2 className="text-xl font-black text-ink dark:text-white">Trip Budget &amp; Hidden Costs</h2>
          </div>

          <div className="flex items-center gap-2">
            {!editingBudget ? (
              <button
                onClick={() => setEditingBudget(true)}
                className="btn2 !rounded-2xl !py-1.5 text-xs font-bold"
              >
                Edit Target Limit (₹{plan.budget.toLocaleString("en-IN")})
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
          <div className="rounded-2xl bg-paper dark:bg-darkpaper p-4">
            <span className="text-[11px] font-bold uppercase text-ink/50 dark:text-slate-400 block">Total Budget</span>
            <span className="text-xl font-black text-ink dark:text-white block mt-1">{inr(plan.budget)}</span>
            <span className="text-[10px] text-ink/50 dark:text-slate-400">User allocated</span>
          </div>

          <div className="rounded-2xl bg-paper dark:bg-darkpaper p-4">
            <span className="text-[11px] font-bold uppercase text-ink/50 dark:text-slate-400 block">Planned Spending</span>
            <span className="text-xl font-black text-ink dark:text-white block mt-1">{inr(b.planned)}</span>
            <span className="text-[10px] text-ink/50 dark:text-slate-400">Sum of all categories</span>
          </div>

          <div className={`rounded-2xl p-4 ${b.over ? "bg-red-50 dark:bg-red-950/40 text-alert" : "bg-paper dark:bg-darkpaper text-ink dark:text-white"}`}>
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

          <div className="rounded-2xl bg-paper dark:bg-darkpaper p-4">
            <span className="text-[11px] font-bold uppercase text-ink/50 dark:text-slate-400 block">Data Integrity</span>
            <span className="text-xl font-black text-ink dark:text-white block mt-1">
              {b.unknown} {b.unknown === 1 ? "Item" : "Items"}
            </span>
            <span className="text-[10px] text-ink/50 dark:text-slate-400">Awaiting official pricing</span>
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
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60 dark:text-slate-400">
            Category Breakdown ({plan.travelers} Travelers)
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-paper dark:bg-darkpaper">
              <span className="font-semibold text-ink dark:text-white">🏨 Accommodation ({Math.max(1, plan.days.length - 1)} Nights)</span>
              <span className="font-bold text-ink dark:text-white">{inr(b.acc)}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-paper dark:bg-darkpaper">
              <span className="font-semibold text-ink dark:text-white">🚕 Transportation ({plan.days.length} Days transit buffer)</span>
              <span className="font-bold text-ink dark:text-white">{inr(b.transport)}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-paper dark:bg-darkpaper">
              <span className="font-semibold text-ink dark:text-white">🍽️ Food &amp; Dining ({plan.diet} preference)</span>
              <span className="font-bold text-ink dark:text-white">{inr(b.food)}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-paper dark:bg-darkpaper">
              <span className="font-semibold text-ink dark:text-white">🎟️ Attraction Entry Tickets</span>
              <span className="font-bold text-ink dark:text-white">{inr(b.attractions)}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-paper dark:bg-darkpaper">
              <span className="font-semibold text-ink dark:text-white">🧾 Known Additional Fees (Lockers, booking fees, permits)</span>
              <span className="font-bold text-ink dark:text-white">{inr(b.known)}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-paper dark:bg-darkpaper">
              <span className="font-semibold text-ink dark:text-white">📊 Estimated Incidental Expenses (Tips, audio guides)</span>
              <span className="font-bold text-ink dark:text-white">{inr(b.est)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: HIDDEN-COST DETECTION PANEL */}
      <div className="rounded-3xl bg-white dark:bg-darkcard p-6 shadow-sm ring-1 ring-ink/10 dark:ring-white/10 space-y-4 transition-colors">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber">
            Transparency Engine
          </span>
          <h3 className="text-lg font-bold text-ink dark:text-white">Hidden-Cost &amp; Fee Detection</h3>
          <p className="text-xs text-ink/60 dark:text-slate-400 mt-0.5">
            We separate base entry prices from mandatory charges, booking fees, and lockers so you face no surprises.
          </p>
        </div>

        {allExtras.length > 0 ? (
          <div className="space-y-2">
            {allExtras.map((ex, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-2xl border border-ink/10 dark:border-white/10 text-xs"
              >
                <div>
                  <span className="font-bold text-ink dark:text-white">{ex.label}</span>
                  <span className="text-ink/50 dark:text-slate-400 ml-2">at {ex.place}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      ex.kind === "known"
                        ? "bg-lagoon/15 text-lagoon"
                        : ex.kind === "estimated"
                        ? "bg-amber/20 text-ink dark:text-amber-300"
                        : "bg-ink/10 dark:bg-white/10 text-ink/60 dark:text-slate-400"
                    }`}
                  >
                    {ex.kind}
                  </span>
                  <span className="font-extrabold text-ink dark:text-white">{inr(ex.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-paper dark:bg-darkpaper p-4 text-xs text-ink/60 dark:text-slate-400 text-center">
            No mandatory hidden fees detected for the current planned attractions.
          </div>
        )}

        <div className="rounded-2xl bg-paper dark:bg-darkpaper p-3 text-[11px] text-ink/60 dark:text-slate-400 leading-relaxed">
          <b>Data Integrity Commitment:</b> We never fabricate hidden costs or prices. If pricing or fees
          for a monument are unavailable, they are tagged as "Unknown" rather than invented.
        </div>
      </div>

      {/* SECTION: VERIFIED TRANSACTION HISTORY */}
      <TransactionHistory transactions={transactions} isLoading={loadingPayments} />

      {/* PAYMENT MODAL */}
      {paymentModalOpen && (
        <PaymentModal
          plan={plan}
          summary={summary}
          initialAmount={modalInitialAmount}
          initialContributor={modalInitialContributor}
          onClose={() => setPaymentModalOpen(false)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
