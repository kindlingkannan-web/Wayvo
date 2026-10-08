"use client";
import React, { useState } from "react";
import { ClockIcon, CheckCircleIcon } from "./Icons";
import type { Day } from "@/lib/types";
import { runLate, RunningLateResult } from "@/lib/engine";

interface RunningLateModalProps {
  day: Day;
  onApply: (newDay: Day, changes: string[]) => void;
  onClose: () => void;
}

export function RunningLateModal({ day, onApply, onClose }: RunningLateModalProps) {
  const [delay, setDelay] = useState<number>(30);
  const [customVal, setCustomVal] = useState<string>("");
  const [isCustom, setIsCustom] = useState(false);
  const [preview, setPreview] = useState<RunningLateResult | null>(null);

  const presets = [15, 30, 45, 60];

  const handleSelectPreset = (min: number) => {
    setIsCustom(false);
    setDelay(min);
    setPreview(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsCustom(true);
    setCustomVal(e.target.value);
    const num = parseInt(e.target.value, 10);
    if (!isNaN(num) && num > 0) {
      setDelay(num);
    }
    setPreview(null);
  };

  const calculatePreview = () => {
    const res = runLate(day, delay);
    setPreview(res);
  };

  const handleConfirm = () => {
    const result = preview || runLate(day, delay);
    onApply(result.day, result.changes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-ink/10">
        <div className="flex items-center justify-between pb-3 border-b border-ink/10">
          <div className="flex items-center gap-2 text-amber">
            <ClockIcon className="w-6 h-6" />
            <h2 className="text-xl font-bold text-ink">I'm Running Late</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink transition"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-sm text-ink/70">
          Select your delay. The AI Copilot will automatically shift remaining timings, shorten flexible visits,
          and protect high-priority activities so you don't miss closing hours.
        </p>

        <div className="mt-4">
          <label className="text-xs font-bold uppercase tracking-wider text-ink/50">Choose Delay</label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {presets.map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => handleSelectPreset(min)}
                className={`rounded-2xl py-2.5 text-sm font-semibold transition ${
                  !isCustom && delay === min
                    ? "bg-amber text-ink shadow-sm"
                    : "bg-paper text-ink hover:bg-ink/10"
                }`}
              >
                +{min} min
              </button>
            ))}
          </div>

          <div className="mt-3">
            <label className="flex items-center gap-2 text-xs text-ink/70">
              <input
                type="radio"
                name="lateType"
                checked={isCustom}
                onChange={() => setIsCustom(true)}
              />
              Or specify custom minutes:
            </label>
            {isCustom && (
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="240"
                  placeholder="e.g. 75"
                  value={customVal}
                  onChange={handleCustomChange}
                  className="inp max-w-[140px]"
                />
                <span className="text-sm font-medium text-ink/60">minutes</span>
              </div>
            )}
          </div>
        </div>

        {/* What Changed Preview Section */}
        {preview && (
          <div className="mt-5 rounded-2xl bg-paper p-4 ring-1 ring-ink/10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-lagoon flex items-center gap-1.5">
              <CheckCircleIcon className="w-4 h-4" />
              What Changed ({delay} min delay applied)
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-ink/80">
              {preview.changes.map((c, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-lagoon font-bold">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn2 !rounded-2xl"
          >
            Cancel
          </button>

          {!preview ? (
            <button
              type="button"
              onClick={calculatePreview}
              className="btn !bg-lagoon text-white !rounded-2xl"
            >
              Preview Changes
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              className="btn !bg-amber !text-ink !rounded-2xl font-bold"
            >
              Apply to Schedule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
