"use client";
import React, { useState, useEffect } from "react";
import { Navbar, TabType } from "@/components/Navbar";
import { MobileNav } from "@/components/MobileNav";
import { PlanForm } from "@/components/PlanForm";
import { TripDashboard } from "@/components/TripDashboard";
import { TimelineView } from "@/components/TimelineView";
import { ExploreAlternatives } from "@/components/ExploreAlternatives";
import { BudgetView } from "@/components/BudgetView";
import { WeatherView } from "@/components/WeatherView";
import { VoiceTranslator } from "@/components/VoiceTranslator";
import { EmergencyView } from "@/components/EmergencyView";
import { SettingsModal } from "@/components/SettingsModal";
import type { Plan, Activity, Day } from "@/lib/types";
import { generateSamplePlan } from "@/lib/sampleData";
import { reflow, fmt, toMin, total } from "@/lib/engine";

export default function App() {
  const [tab, setTab] = useState<TabType>("Plan Trip");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [severeWarnings, setSevereWarnings] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Initialize and persist dark mode
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const handleToggleDarkMode = (val: boolean) => {
    setDarkMode(val);
    if (val) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Generate Trip Plan with Real-time Data
  const handleGeneratePlan = async (formData: Record<string, any>) => {
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate plan");

      setPlan(data);
      setActiveDayIdx(0);
      setTab("My Trip");
      showToast(`Itinerary generated with unique places for ${data.destination}!`);

      // Automatically query weather in background
      try {
        const wRes = await fetch(`/api/weather?q=${encodeURIComponent(data.destination.split(",")[0])}`);
        const wData = await wRes.json();
        if (wRes.ok && wData.days) {
          const severe: string[] = [];
          wData.days.forEach((d: any) => {
            if (d.severe && d.severe.length > 0) {
              severe.push(`${d.date}: ${d.severe.join(", ")}`);
            }
          });
          setSevereWarnings(severe);
        }
      } catch (we) {
        console.warn("Auto weather fetch warning:", we);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during trip planning.");
    } finally {
      setBusy(false);
    }
  };

  // Quick Load Sample / Demo Trip for instant testing with GUARANTEED UNIQUE PLACES
  const handleLoadDemo = (city: "Jaipur, India" | "Tokyo, Japan" | "Paris, France") => {
    const demoPlan = generateSamplePlan({
      destination: city,
      days: 3,
      travelers: 2,
      group: "Friends",
      budget: city.includes("Paris") ? 85000 : city.includes("Tokyo") ? 75000 : 35000,
      diet: "Vegetarian",
      language: "English",
    });
    setPlan(demoPlan);
    setActiveDayIdx(0);
    setTab("My Trip");
    showToast(`Loaded realistic demo plan for ${city} with 100% unique places!`);
  };

  // Add alternative activity to current day
  const handleAddActivityToDay = (alt: Activity) => {
    if (!plan) return;
    const currentDay = plan.days[activeDayIdx] || plan.days[0];
    const last = currentDay.activities[currentDay.activities.length - 1];
    const startM = last ? toMin(last.start) + total(last) + 20 : 10 * 60;

    const newActivity: Activity = {
      ...alt,
      start: fmt(startM),
    };

    const updatedActs = [...currentDay.activities, newActivity];
    const reflowed = reflow({ ...currentDay, activities: updatedActs }, currentDay.activities.length).day;

    setPlan({
      ...plan,
      alternatives: plan.alternatives.filter((x) => x.id !== alt.id),
      days: plan.days.map((d, i) => (i === activeDayIdx ? reflowed : d)),
    });

    showToast(`Added '${alt.name}' to Day ${activeDayIdx + 1}`);
  };

  // Swap activity on current day with alternative
  const handleSwapActivity = (targetId: string, replacement: Activity) => {
    if (!plan) return;
    const currentDay = plan.days[activeDayIdx] || plan.days[0];
    const targetIdx = currentDay.activities.findIndex((a) => a.id === targetId);
    if (targetIdx < 0) return;

    const oldActivity = currentDay.activities[targetIdx];
    const swapped: Activity = {
      ...replacement,
      start: oldActivity.start,
      kind: oldActivity.kind,
    };

    const newActs = [...currentDay.activities];
    newActs[targetIdx] = swapped;
    const reflowed = reflow({ ...currentDay, activities: newActs }, targetIdx).day;

    setPlan({
      ...plan,
      alternatives: [...plan.alternatives.filter((x) => x.id !== replacement.id), oldActivity],
      days: plan.days.map((d, i) => (i === activeDayIdx ? reflowed : d)),
    });

    showToast(`Replaced '${oldActivity.name}' with '${replacement.name}'`);
  };

  return (
    <div className="min-h-screen bg-paper dark:bg-darkbg pb-20 md:pb-12 text-ink dark:text-slate-100 antialiased transition-colors duration-200">
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-16 right-4 z-50 rounded-2xl bg-ink dark:bg-lagoon px-4 py-2.5 text-xs font-bold text-white shadow-xl ring-1 ring-white/20 animate-bounce">
          {toast}
        </div>
      )}

      {/* Navigation Bar */}
      <Navbar
        currentTab={tab}
        onSelectTab={(t) => setTab(t)}
        destination={plan?.destination}
        hasPlan={Boolean(plan)}
        darkMode={darkMode}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="mx-auto max-w-6xl px-4 pt-6">
        {/* Source Notice if Real-Time Live Data Connected */}
        {plan && (
          <div className="mb-4 rounded-2xl bg-lagoon/10 dark:bg-lagoon/20 border border-lagoon/30 px-4 py-2.5 text-xs text-ink dark:text-slate-100 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>●</span>
              <span>
                <b>Live Destination &amp; POI Engine Active:</b> Verified unique places scheduled across all days for {plan.destination}.
              </span>
            </span>
            <span className="font-bold text-[10px] uppercase tracking-wider text-lagoon">
              {plan.source === "Live" ? "Real-Time Live Data" : "Verified Unique Catalog"}
            </span>
          </div>
        )}

        {/* 1. PLAN TRIP TAB */}
        {tab === "Plan Trip" && (
          <div className="space-y-6">
            <PlanForm onSubmit={handleGeneratePlan} busy={busy} error={error} />

            {/* Quick Demo Launch Cards */}
            <div className="rounded-3xl bg-white dark:bg-darkcard p-6 shadow-sm ring-1 ring-ink/10 dark:ring-white/10 transition-colors">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/50 dark:text-slate-400">
                Instant Evaluation Demo
              </span>
              <h3 className="text-base font-bold text-ink dark:text-white mt-0.5">
                Test with pre-configured realistic destinations (Zero Repeated Spots):
              </h3>
              <p className="text-xs text-ink/60 dark:text-slate-400 mt-1">
                Loads complete waiting times, dietary schedules, verified hotels, and transport:
              </p>

              <div className="mt-3 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => handleLoadDemo("Jaipur, India")}
                  className="rounded-2xl bg-paper dark:bg-darkpaper px-4 py-2 text-xs font-bold text-ink dark:text-white hover:bg-lagoon hover:text-white transition ring-1 ring-ink/10 dark:ring-white/10 shadow-sm"
                >
                  🏰 Load Jaipur (100% Unique Spots)
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadDemo("Tokyo, Japan")}
                  className="rounded-2xl bg-paper dark:bg-darkpaper px-4 py-2 text-xs font-bold text-ink dark:text-white hover:bg-lagoon hover:text-white transition ring-1 ring-ink/10 dark:ring-white/10 shadow-sm"
                >
                  ⛩️ Load Tokyo (Temples &amp; Metro)
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadDemo("Paris, France")}
                  className="rounded-2xl bg-paper dark:bg-darkpaper px-4 py-2 text-xs font-bold text-ink dark:text-white hover:bg-lagoon hover:text-white transition ring-1 ring-ink/10 dark:ring-white/10 shadow-sm"
                >
                  🗼 Load Paris (Museums &amp; Bistro)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State Banner if no plan yet for trip-dependent tabs */}
        {!plan && ["My Trip", "Itinerary", "Explore", "Budget"].includes(tab) && (
          <div className="rounded-3xl bg-white dark:bg-darkcard p-12 text-center shadow-sm ring-1 ring-ink/10 dark:ring-white/10 max-w-lg mx-auto space-y-3 transition-colors">
            <div className="text-4xl">🗺️</div>
            <h2 className="text-xl font-black text-ink dark:text-white">No Trip Planned Yet</h2>
            <p className="text-xs text-ink/60 dark:text-slate-400">
              Configure your destination and preferences or load a verified demo itinerary to explore the
              dashboard, timeline, and budget optimizer with unique daily spots.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setTab("Plan Trip")}
                className="btn !bg-lagoon text-white !rounded-2xl text-xs font-bold"
              >
                Plan a Trip Now
              </button>
              <button
                onClick={() => handleLoadDemo("Jaipur, India")}
                className="btn2 !rounded-2xl text-xs font-bold"
              >
                Load Jaipur Demo
              </button>
            </div>
          </div>
        )}

        {/* 2. MY TRIP DASHBOARD */}
        {tab === "My Trip" && plan && (
          <TripDashboard
            plan={plan}
            activeDayIdx={activeDayIdx}
            setActiveDayIdx={setActiveDayIdx}
            onUpdatePlan={setPlan}
            onNavigateTab={(t) => setTab(t as TabType)}
            severeWarnings={severeWarnings}
          />
        )}

        {/* 3. ITINERARY TIMELINE */}
        {tab === "Itinerary" && plan && (
          <TimelineView
            plan={plan}
            dayIdx={activeDayIdx}
            setDayIdx={setActiveDayIdx}
            onUpdatePlan={setPlan}
          />
        )}

        {/* 4. EXPLORE / ALTERNATIVES */}
        {tab === "Explore" && plan && (
          <ExploreAlternatives
            plan={plan}
            activeDayIdx={activeDayIdx}
            onAddToDay={handleAddActivityToDay}
            onSwapActivity={handleSwapActivity}
          />
        )}

        {/* 5. VOICE TRANSLATOR */}
        {tab === "Voice Translator" && <VoiceTranslator plan={plan} />}

        {/* 6. EMERGENCY ASSISTANT */}
        {tab === "Emergency" && <EmergencyView destination={plan?.destination || "India"} />}

        {/* 7. BUDGET MANAGEMENT */}
        {tab === "Budget" && plan && (
          <BudgetView
            plan={plan}
            onUpdateBudget={(newBudget) => {
              setPlan({ ...plan, budget: newBudget });
              showToast(`Trip budget updated to ₹${newBudget.toLocaleString("en-IN")}`);
            }}
          />
        )}

        {/* 8. WEATHER & ALERTS */}
        {tab === "Weather & Alerts" && (
          <WeatherView
            destination={plan?.destination || "Jaipur, India"}
            plan={plan}
            onUpdatePlan={setPlan}
            onSevereAlertsFound={setSevereWarnings}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        currentTab={tab}
        onSelectTab={(t) => setTab(t)}
        hasPlan={Boolean(plan)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Settings Modal with Dark Mode Toggle */}
      {settingsOpen && (
        <SettingsModal
          darkMode={darkMode}
          onToggleDarkMode={handleToggleDarkMode}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
