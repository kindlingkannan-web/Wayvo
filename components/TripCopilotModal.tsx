"use client";
import React, { useState } from "react";
import { SparklesIcon, CheckCircleIcon } from "./Icons";
import type { Plan } from "@/lib/types";
import { applyCopilot } from "@/lib/engine";

interface TripCopilotModalProps {
  plan: Plan;
  dayIdx: number;
  onApplyPlan: (newPlan: Plan, changes: string[]) => void;
  onClose: () => void;
}

const COPILOT_PRESETS = [
  { label: "🌧 It is raining", prompt: "It is raining. Move outdoor activities indoors." },
  { label: "🥱 I'm tired", prompt: "I'm tired. Shorten remaining visits or let me rest early." },
  { label: "🚪 This place is closed", prompt: "This place is closed. Swap with an alternative." },
  { label: "🥗 I want to skip lunch", prompt: "I want to skip lunch and move ahead." },
  { label: "⏳ Spend more time here", prompt: "I want to spend more time here (+45 min)." },
  { label: "🚫 Don't want to visit", prompt: "I don't want to visit this place." },
  { label: "✅ Already visited", prompt: "I have already visited this location." },
];

export function TripCopilotModal({ plan, dayIdx, onApplyPlan, onClose }: TripCopilotModalProps) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ plan: Plan; changes: string[] } | null>(null);

  const handleRun = async (text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      // Direct local engine execution ensures instant response and works offline
      const res = applyCopilot(plan, dayIdx, text);
      setResult(res);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = () => {
    if (result) {
      onApplyPlan(result.plan, result.changes);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-ink/10">
        <div className="flex items-center justify-between pb-3 border-b border-ink/10">
          <div className="flex items-center gap-2 text-lagoon">
            <SparklesIcon className="w-6 h-6" />
            <h2 className="text-xl font-bold text-ink">Trip Copilot</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink transition"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-sm text-ink/70">
          Tell your AI Copilot what changed. It adjusts your remaining schedule in real time without
          altering your completed stops.
        </p>

        {/* Quick presets */}
        <div className="mt-4">
          <label className="text-xs font-bold uppercase tracking-wider text-ink/50">Quick Situations</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {COPILOT_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setInput(p.prompt);
                  handleRun(p.prompt);
                }}
                className="rounded-xl bg-paper px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-lagoon/10 hover:text-lagoon transition ring-1 ring-ink/5"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom prompt */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRun(input);
          }}
          className="mt-4 flex gap-2"
        >
          <input
            type="text"
            className="inp text-sm"
            placeholder="e.g. Traffic is heavy, need 30 min buffer..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="btn whitespace-nowrap !bg-lagoon !rounded-xl"
          >
            {busy ? "Analyzing…" : "Ask AI"}
          </button>
        </form>

        {/* Results */}
        {result && (
          <div className="mt-5 rounded-2xl bg-paper p-4 ring-1 ring-ink/10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-lagoon flex items-center gap-1.5">
              <CheckCircleIcon className="w-4 h-4" />
              Copilot Optimizations
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-ink/80">
              {result.changes.map((c, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-lagoon font-bold">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="btn2 !rounded-2xl">
            Cancel
          </button>
          {result && (
            <button
              type="button"
              onClick={handleConfirm}
              className="btn !bg-lagoon text-white !rounded-2xl font-bold"
            >
              Update Itinerary
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
