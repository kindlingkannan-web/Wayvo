"use client";
import React, { useState, useEffect } from "react";
import type { GroupType, FoodPreference } from "@/lib/types";
import { SparklesIcon, CalendarIcon } from "./Icons";

const LANGUAGES: [string, string][] = [
  ["English", "en-US"],
  ["Hindi", "hi-IN"],
  ["Tamil", "ta-IN"],
  ["Japanese", "ja-JP"],
  ["French", "fr-FR"],
  ["Spanish", "es-ES"],
  ["German", "de-DE"],
  ["Thai", "th-TH"],
  ["Italian", "it-IT"],
];

const GENERATION_STEPS = [
  "Analyzing destination topography & local travel regulations...",
  "Querying venue opening hours & queue intelligence data...",
  "Calculating total required time (expected queue + visit duration)...",
  "Curating hotels matching group type and comfort preferences...",
  "Scheduling dietary-specific meals (Vegetarian/Vegan/Non-veg windows)...",
  "Optimizing transportation routes and realistic time buffers...",
  "Cross-referencing live meteorological warnings & safety advisories...",
  "Validating schedule feasibility & compiling trip dashboard...",
];

interface PlanFormProps {
  onSubmit: (formData: Record<string, any>) => void;
  busy: boolean;
  error?: string;
}

export function PlanForm({ onSubmit, busy, error }: PlanFormProps) {
  const [mode, setMode] = useState<"dates" | "duration">("duration");
  const [destination, setDestination] = useState("Jaipur, India");
  const [travelers, setTravelers] = useState(2);
  const [duration, setDuration] = useState(3);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState(35000);
  const [group, setGroup] = useState<GroupType>("Friends");
  const [diet, setDiet] = useState<FoodPreference>("Vegetarian");
  const [language, setLanguage] = useState("English");
  const [validationErr, setValidationErr] = useState("");

  // Progress animation state
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    let interval: any;
    if (busy) {
      setStepIdx(0);
      interval = setInterval(() => {
        setStepIdx((prev) => (prev < GENERATION_STEPS.length - 1 ? prev + 1 : prev));
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [busy]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErr("");

    if (!destination.trim()) {
      setValidationErr("Please enter a destination.");
      return;
    }

    if (budget < 500) {
      setValidationErr("Please specify a realistic total trip budget (min ₹500).");
      return;
    }

    let calculatedDays = duration;
    if (mode === "dates") {
      if (!startDate || !endDate) {
        setValidationErr("Please select both start and end dates.");
        return;
      }
      const diffMs = new Date(endDate).getTime() - new Date(startDate).getTime();
      const diffDays = Math.round(diffMs / 864e5) + 1;
      if (diffDays <= 0) {
        setValidationErr("End date must be on or after start date.");
        return;
      }
      calculatedDays = Math.min(10, Math.max(1, diffDays));
    }

    onSubmit({
      destination: destination.trim(),
      travelers,
      duration: calculatedDays,
      days: calculatedDays,
      startDate,
      endDate: mode === "dates" ? endDate : undefined,
      budget,
      group,
      diet,
      language,
    });
  };

  const quickDests = ["Jaipur, India", "Goa, India", "Tokyo, Japan", "Paris, France"];

  return (
    <div className="space-y-6">
      {/* Brand Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-ink to-ink/90 p-8 text-white shadow-xl">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-lagoon/20 px-3 py-1 text-xs font-bold text-lagoon border border-lagoon/30">
            <SparklesIcon className="w-4 h-4" />
            <span>Wayvo AI Travel Agent</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Plan a Feasible, Realistic Trip
          </h1>
          <p className="text-xs sm:text-sm text-white/70">
            Intelligent itinerary engineering. We factor in <b>waiting times</b>, <b>opening hours</b>,
            <b>dietary requirements</b>, and <b>transport buffers</b> — avoiding overloaded tourist traps.
          </p>
        </div>
      </div>

      {/* Main Planning Form */}
      <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-ink/10 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-ink/10">
          <h2 className="text-lg font-bold text-ink">Trip Parameters</h2>
          <span className="text-xs text-ink/50">* All inputs validated</span>
        </div>

        {/* Destination & Quick Tags */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-ink/60 block mb-1">
            Destination
          </label>
          <input
            type="text"
            required
            className="inp text-sm"
            placeholder="e.g. Jaipur, Tokyo, Paris, Goa..."
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink/60">
            <span>Popular:</span>
            {quickDests.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDestination(d)}
                className="rounded-lg bg-paper px-2 py-0.5 hover:bg-lagoon/10 hover:text-lagoon transition text-[11px] font-medium"
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Dates / Duration */}
        <div className="rounded-2xl bg-paper p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-ink/60">
              Trip Length Mode
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("duration")}
                className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                  mode === "duration" ? "bg-ink text-white" : "bg-white text-ink/70"
                }`}
              >
                Duration (Days)
              </button>
              <button
                type="button"
                onClick={() => setMode("dates")}
                className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                  mode === "dates" ? "bg-ink text-white" : "bg-white text-ink/70"
                }`}
              >
                Start &amp; End Dates
              </button>
            </div>
          </div>

          {mode === "duration" ? (
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="10"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full accent-lagoon cursor-pointer"
              />
              <span className="rounded-xl bg-white px-3 py-1.5 font-bold text-ink shadow-sm text-sm whitespace-nowrap min-w-[70px] text-center">
                {duration} {duration === 1 ? "Day" : "Days"}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-ink/60 block mb-1">Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="inp text-xs"
                />
              </div>
              <div>
                <span className="text-[11px] text-ink/60 block mb-1">End Date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="inp text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Travelers & Group Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink/60 block mb-1">
              Travelers
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={travelers}
              onChange={(e) => setTravelers(Math.max(1, Number(e.target.value)))}
              className="inp text-sm font-semibold"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink/60 block mb-1">
              Group Type
            </label>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value as GroupType)}
              className="inp text-sm font-semibold"
            >
              <option value="Solo">Solo</option>
              <option value="Couple">Couple</option>
              <option value="Friends">Friends</option>
              <option value="Family">Family</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Budget, Food & Language */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink/60 block mb-1">
              Total Budget (₹)
            </label>
            <input
              type="number"
              min="500"
              step="500"
              required
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="inp text-sm font-semibold"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink/60 block mb-1">
              Food Preference
            </label>
            <select
              value={diet}
              onChange={(e) => setDiet(e.target.value as FoodPreference)}
              className="inp text-sm font-semibold"
            >
              <option value="Vegetarian">Vegetarian</option>
              <option value="Non-vegetarian">Non-vegetarian</option>
              <option value="Vegan">Vegan</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink/60 block mb-1">
              Preferred Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="inp text-sm font-semibold"
            >
              {LANGUAGES.map(([name]) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Validation Error Message */}
        {(validationErr || error) && (
          <div className="rounded-2xl border border-alert/30 bg-alert/10 p-3 text-xs text-alert font-bold">
            ⚠ {validationErr || error}
          </div>
        )}

        {/* Submit or Loading Animation */}
        {!busy ? (
          <button
            type="submit"
            className="btn w-full !bg-lagoon text-white !py-3.5 text-base font-extrabold shadow-lg hover:shadow-xl transition"
          >
            Generate Feasible Itinerary ➔
          </button>
        ) : (
          <div className="rounded-2xl bg-paper p-5 space-y-3 ring-1 ring-ink/10">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-lagoon border-t-transparent" />
              <div className="font-extrabold text-sm text-ink">
                Wayvo Planning Trip ({stepIdx + 1}/{GENERATION_STEPS.length})
              </div>
            </div>
            <p className="text-xs text-lagoon font-semibold animate-pulse">
              {GENERATION_STEPS[stepIdx]}
            </p>
            <div className="h-1.5 w-full rounded-full bg-ink/10 overflow-hidden">
              <div
                className="h-full bg-lagoon transition-all duration-300 ease-out"
                style={{ width: `${((stepIdx + 1) / GENERATION_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
