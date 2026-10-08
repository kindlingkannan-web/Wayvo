"use client";
import React from "react";
import { SparklesIcon } from "./Icons";

export const MAIN_TABS = [
  "Plan Trip",
  "My Trip",
  "Itinerary",
  "Explore",
  "Voice Translator",
  "Emergency",
  "Budget",
  "Weather & Alerts",
] as const;

export type TabType = typeof MAIN_TABS[number];

interface NavbarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  destination?: string;
  hasPlan: boolean;
  darkMode: boolean;
  onOpenSettings: () => void;
}

export function Navbar({
  currentTab,
  onSelectTab,
  destination,
  hasPlan,
  darkMode,
  onOpenSettings,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-darkcard/90 backdrop-blur-md border-b border-ink/10 dark:border-white/10 transition-colors">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        {/* Brand */}
        <div
          onClick={() => onSelectTab("Plan Trip")}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-ink dark:bg-lagoon text-lagoon dark:text-white shadow-sm group-hover:scale-105 transition">
            <SparklesIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base font-black tracking-tight text-ink dark:text-white block leading-none">
              AI Travel Agent
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-lagoon">
              Automated Dynamic Planner
            </span>
          </div>
        </div>

        {/* Destination badge if trip planned */}
        {hasPlan && destination && (
          <div className="hidden lg:flex items-center gap-2 rounded-full bg-paper dark:bg-darkpaper px-3 py-1 text-xs font-bold text-ink dark:text-white">
            <span className="h-2 w-2 rounded-full bg-lagoon animate-pulse" />
            <span>{destination}</span>
          </div>
        )}

        {/* Desktop Nav Pills */}
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto" aria-label="Desktop Navigation">
          {MAIN_TABS.map((t) => {
            const isActive = currentTab === t;
            return (
              <button
                key={t}
                onClick={() => onSelectTab(t)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? "bg-ink dark:bg-lagoon text-white shadow-sm"
                    : "text-ink/70 dark:text-slate-300 hover:bg-paper dark:hover:bg-darkpaper hover:text-ink dark:hover:text-white"
                }`}
              >
                {t}
              </button>
            );
          })}
        </nav>

        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-2xl bg-paper dark:bg-darkpaper p-2 text-ink dark:text-white ring-1 ring-ink/10 dark:ring-white/10 hover:bg-lagoon hover:text-white transition flex items-center gap-1.5 text-xs font-bold"
          title="Open Settings & Dark Mode"
        >
          <span>{darkMode ? "🌙" : "⚙️"}</span>
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>
    </header>
  );
}
