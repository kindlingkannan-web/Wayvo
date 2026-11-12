"use client";
import React, { useState } from "react";
import type { Plan } from "@/lib/types";
import { SparklesIcon } from "./Icons";

interface AIBudgetAssistantProps {
  plan: Plan;
  totalPaid: number;
  remainingBalance: number;
}

const QUICK_PROMPTS = [
  "How much remaining balance is left to pay?",
  "What flexible activities can I adjust to lower expenses?",
  "Summarize our group contribution progress",
  "Can I reduce remaining costs by ₹2,000?",
];

export function AIBudgetAssistant({ plan, totalPaid, remainingBalance }: AIBudgetAssistantProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (qText: string) => {
    if (!qText.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const tripAccessKey = typeof window !== "undefined" ? sessionStorage.getItem(`trip_key_${plan.id}`) : null;
      const res = await fetch("/api/paypal/ai-budget-assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tripAccessKey ? { "x-trip-access-key": tripAccessKey } : {}),
        },
        body: JSON.stringify({
          tripId: plan.id,
          tripAccessKey,
          question: qText,
          planData: plan,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate AI budget answer");

      setResponse(data.reply);
    } catch (err: any) {
      setError(err.message || "An error occurred while consulting the AI Budget Assistant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-darkcard p-6 shadow-sm ring-1 ring-ink/10 dark:ring-white/10 transition-colors space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-ink/10 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-lagoon/20 text-lagoon flex items-center justify-center">
            <SparklesIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-lagoon">
              PayPal AI Hackathon Feature
            </span>
            <h3 className="text-lg font-bold text-ink dark:text-white">AI Budget &amp; Payment Co-Pilot</h3>
          </div>
        </div>
      </div>

      <p className="text-xs text-ink/70 dark:text-slate-300">
        Ask intelligent questions about your verified PayPal funding, remaining balance, or ways to adjust flexible activities to meet financial targets.
      </p>

      {/* Quick Prompt Chips */}
      <div className="flex flex-wrap gap-2 pt-1">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => {
              setQuestion(prompt);
              handleAsk(prompt);
            }}
            disabled={loading}
            className="rounded-xl bg-paper dark:bg-darkpaper px-3 py-1.5 text-xs font-semibold text-ink/80 dark:text-slate-200 hover:bg-lagoon hover:text-white dark:hover:bg-lagoon dark:hover:text-white transition ring-1 ring-ink/10 dark:ring-white/10 disabled:opacity-50"
          >
            💬 {prompt}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk(question);
        }}
        className="flex gap-2 pt-2"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about your trip budget or payments..."
          className="inp flex-1 text-xs"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="btn !bg-lagoon text-white !rounded-2xl px-5 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <SparklesIcon className="w-4 h-4" />
              <span>Ask AI</span>
            </>
          )}
        </button>
      </form>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-alert bg-alert/10 p-3 text-xs text-alert font-semibold">
          ⚠ {error}
        </div>
      )}

      {/* Response Display */}
      {response && (
        <div className="rounded-2xl bg-lagoon/10 dark:bg-lagoon/15 border border-lagoon/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-lagoon uppercase tracking-wide">
            <SparklesIcon className="w-4 h-4" />
            <span>AI Budget Analysis</span>
          </div>
          <div className="text-xs text-ink dark:text-slate-100 whitespace-pre-line leading-relaxed font-medium">
            {response}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-paper dark:bg-darkpaper p-3 text-[11px] text-ink/60 dark:text-slate-400 leading-relaxed">
        <b>Data Integrity Guarantee:</b> Financial determinations are computed deterministically from verified PayPal capture records. AI provides contextual analysis and suggestions but never modifies financial data.
      </div>
    </div>
  );
}
