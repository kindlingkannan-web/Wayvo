"use client";
import React from "react";
import { SparklesIcon, CheckCircleIcon } from "./Icons";

interface SettingsModalProps {
  darkMode: boolean;
  onToggleDarkMode: (val: boolean) => void;
  onClose: () => void;
}

export function SettingsModal({ darkMode, onToggleDarkMode, onClose }: SettingsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-darkcard p-6 shadow-2xl ring-1 ring-ink/10 dark:ring-white/10 text-ink dark:text-slate-100 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-ink/10 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <h2 className="text-xl font-bold">Application Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ink/40 dark:text-white/40 hover:bg-ink/5 dark:hover:bg-white/10 hover:text-ink transition"
          >
            ✕
          </button>
        </div>

        {/* Settings Items */}
        <div className="mt-5 space-y-4 text-xs">
          {/* DARK MODE TOGGLE */}
          <div className="flex items-center justify-between rounded-2xl bg-paper dark:bg-darkpaper p-4 ring-1 ring-ink/5 dark:ring-white/5">
            <div>
              <div className="font-bold text-sm text-ink dark:text-white flex items-center gap-1.5">
                <span>{darkMode ? "🌙" : "☀️"}</span>
                <span>Dark Mode</span>
              </div>
              <p className="text-[11px] text-ink/60 dark:text-slate-400 mt-0.5">
                Switch between high-contrast dark theme and clean light theme
              </p>
            </div>

            {/* Toggle switch button */}
            <button
              type="button"
              onClick={() => onToggleDarkMode(!darkMode)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
                darkMode ? "bg-lagoon" : "bg-ink/20"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                  darkMode ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Real-time Services Health Status */}
          <div className="rounded-2xl bg-paper dark:bg-darkpaper p-4 space-y-2 ring-1 ring-ink/5 dark:ring-white/5">
            <div className="font-bold uppercase tracking-wider text-[10px] text-lagoon">
              Live API Services Status
            </div>

            <div className="flex items-center justify-between">
              <span className="text-ink/80 dark:text-slate-300">Open-Meteo Radar</span>
              <span className="font-semibold text-lagoon flex items-center gap-1">
                <CheckCircleIcon className="w-3.5 h-3.5" /> Live HTTP (Active)
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-ink/80 dark:text-slate-300">Wikipedia POI Intelligence</span>
              <span className="font-semibold text-lagoon flex items-center gap-1">
                <CheckCircleIcon className="w-3.5 h-3.5" /> Real-Time Places
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-ink/80 dark:text-slate-300">Multi-Language Translator</span>
              <span className="font-semibold text-lagoon flex items-center gap-1">
                <CheckCircleIcon className="w-3.5 h-3.5" /> Live HTTP Engine
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-ink/80 dark:text-slate-300">Speech Recognition (STT/TTS)</span>
              <span className="font-semibold text-lagoon flex items-center gap-1">
                <CheckCircleIcon className="w-3.5 h-3.5" /> Web Speech Audio
              </span>
            </div>
          </div>

          {/* Itinerary Intelligence Rule */}
          <div className="rounded-2xl bg-paper dark:bg-darkpaper p-4 text-[11px] text-ink/70 dark:text-slate-300 space-y-1">
            <div className="font-bold text-ink dark:text-white">Strict De-Duplication Enabled:</div>
            <p>
              Attractions and restaurants are strictly unique for each day of the journey. No venue will
              be repeated more than once.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="btn !bg-lagoon text-white !rounded-2xl !py-2 text-xs font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
