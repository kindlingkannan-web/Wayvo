"use client";
import React from "react";
import { MAIN_TABS, TabType } from "./Navbar";

interface MobileNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  hasPlan: boolean;
  onOpenSettings: () => void;
}

const MOBILE_ICONS: Record<TabType, string> = {
  "Plan Trip": "📝",
  "My Trip": "🧭",
  "Itinerary": "📅",
  "Explore": "🔍",
  "Voice Translator": "🎙️",
  "Emergency": "🚨",
  "Budget": "💰",
  "Weather & Alerts": "🌦️",
};

export function MobileNav({ currentTab, onSelectTab, hasPlan, onOpenSettings }: MobileNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 dark:bg-darkcard/95 backdrop-blur-md border-t border-ink/10 dark:border-white/10 px-2 py-1 shadow-lg transition-colors"
      aria-label="Mobile Navigation"
    >
      <div className="flex items-center justify-between overflow-x-auto no-scrollbar py-1">
        {MAIN_TABS.map((t) => {
          const isActive = currentTab === t;
          return (
            <button
              key={t}
              onClick={() => onSelectTab(t)}
              className={`flex flex-col items-center justify-center min-w-[58px] py-1 px-1 rounded-xl text-[10px] font-bold transition ${
                isActive
                  ? "text-lagoon font-extrabold"
                  : "text-ink/60 dark:text-slate-400 hover:text-ink dark:hover:text-white"
              }`}
            >
              <span className="text-base">{MOBILE_ICONS[t]}</span>
              <span className="whitespace-nowrap mt-0.5 scale-90">{t.replace("Voice ", "").replace(" & Alerts", "")}</span>
            </button>
          );
        })}

        {/* Mobile Settings button */}
        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center justify-center min-w-[58px] py-1 px-1 rounded-xl text-[10px] font-bold text-ink/60 dark:text-slate-400 hover:text-ink dark:hover:text-white transition"
        >
          <span className="text-base">⚙️</span>
          <span className="whitespace-nowrap mt-0.5 scale-90">Settings</span>
        </button>
      </div>
    </nav>
  );
}
