"use client";
import React from "react";
import type { PaymentTransaction } from "@/lib/paymentTypes";

interface TransactionHistoryProps {
  transactions: PaymentTransaction[];
  isLoading?: boolean;
}

const inr = (n: number | null) => (n == null ? "—" : "₹" + Math.round(n).toLocaleString("en-IN"));

export function TransactionHistory({ transactions, isLoading }: TransactionHistoryProps) {
  if (isLoading) {
    return (
      <div className="rounded-3xl bg-white dark:bg-darkcard p-6 shadow-sm ring-1 ring-ink/10 dark:ring-white/10 transition-colors">
        <div className="flex items-center gap-2 text-xs text-ink/50 dark:text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-lagoon border-t-transparent" />
          <span>Loading verified payment history...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white dark:bg-darkcard p-6 shadow-sm ring-1 ring-ink/10 dark:ring-white/10 transition-colors space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-ink/10 dark:border-white/10">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-lagoon">
            Audit &amp; Verification
          </span>
          <h3 className="text-lg font-bold text-ink dark:text-white">Verified PayPal Transactions</h3>
          <p className="text-xs text-ink/60 dark:text-slate-400 mt-0.5">
            Every transaction is verified and captured through the official PayPal REST Orders API.
          </p>
        </div>
        <div className="rounded-full bg-lagoon/10 dark:bg-lagoon/20 px-3 py-1 text-xs font-bold text-lagoon">
          {transactions.length} {transactions.length === 1 ? "Record" : "Records"}
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-2xl bg-paper dark:bg-darkpaper p-8 text-center space-y-2">
          <div className="text-3xl">🧾</div>
          <div className="text-xs font-bold text-ink dark:text-white">No Transactions Yet</div>
          <p className="text-xs text-ink/50 dark:text-slate-400 max-w-sm mx-auto">
            Payments captured via PayPal Checkout will automatically appear here with their official Capture ID and verification status.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-ink/10 dark:border-white/10 text-ink/50 dark:text-slate-400 uppercase text-[10px] font-bold">
                <th className="pb-2">Date &amp; Time</th>
                <th className="pb-2">Traveler / Contributor</th>
                <th className="pb-2">Amount (INR)</th>
                <th className="pb-2">PayPal Charged</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">PayPal Capture ID</th>
                <th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5 dark:divide-white/5">
              {transactions.map((tx) => {
                const dateStr = new Date(tx.capturedAt || tx.createdAt).toLocaleDateString("en-IN", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <tr key={tx.id} className="hover:bg-paper/50 dark:hover:bg-darkpaper/50 transition">
                    <td className="py-3 font-medium text-ink dark:text-slate-200">{dateStr}</td>
                    <td className="py-3 font-semibold text-ink dark:text-white">
                      {tx.contributorName || tx.payerName || tx.payerEmail || "Organizer"}
                    </td>
                    <td className="py-3 font-bold text-ink dark:text-white">
                      {inr(tx.originalAmount)}
                    </td>
                    <td className="py-3 font-semibold text-lagoon">
                      {tx.amount.toFixed(2)} {tx.currency}
                    </td>
                    <td className="py-3 uppercase text-[10px] font-bold text-ink/60 dark:text-slate-400">
                      {tx.paymentType}
                    </td>
                    <td className="py-3 font-mono text-[11px] text-ink/70 dark:text-slate-300">
                      {tx.paypalCaptureId || tx.paypalOrderId}
                    </td>
                    <td className="py-3 text-right">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-400">
                        <span>✓</span>
                        <span>{tx.status}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-2xl bg-paper dark:bg-darkpaper p-3 text-[11px] text-ink/60 dark:text-slate-400 leading-relaxed">
        <b>Security &amp; Compliance:</b> Transactions are captured server-side with strict duplicate protection and idempotency keys. Wayvo never stores credit card details or client credentials.
      </div>
    </div>
  );
}
