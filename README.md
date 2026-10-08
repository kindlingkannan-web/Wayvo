# 🌍 Wayvo — Autonomous AI Travel Agent & Co-Pilot

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![React](https://img.shields.io/badge/React-18.3-61dafb?style=flat&logo=react)](https://react.dev/)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-success)](#)

> **Wayvo** is a full-stack, autonomous AI Travel Agent that crafts realistic, geographically sound, time-feasible itineraries, monitors disruptions in real time, and dynamically optimizes your trip on the go.

---

## 🌟 Key Features

### 1. 🧠 Feasibility & Scheduling Engine (`lib/engine.ts`)
- **Physics of Travel Formulation**: Accurately computes `Total Time = Transit + Queue Time + Visit Duration + Safety Buffer`.
- **Operating Hours Enforcement**: Automatically flags or reorders activities if opening/closing windows are violated.
- **Meal & Dietary Rhythm**: Automatically slots regional lunches/dinners respecting dietary constraints (Vegetarian, Non-vegetarian, Vegan, Halal).
- **Dynamic "I'm Running Late" Rescheduling**:
  - One-tap delay injection (15m, 30m, 45m, 1h, custom).
  - Automatically preserves pinned "must-see" activities, compresses flexible transit/visit buffers, or removes lowest-priority venues to prevent evening cascade failures.
  - Transparent "What Changed?" diff changelog.

### 2. 🗺️ Geographically Clustered Itineraries (No Scattered Venues)
- **Neighborhood-Clustered Days**: Groups activities by contiguous micro-districts within the destination city (e.g., Jaipur: Amer Fort / Nahargarh Ridge Day, Pink City Core Day, Royal Crafts South Day).
- **Zero Duplicate Attractions**: Every activity across multi-day itineraries is strictly unique with 0% repetition.
- **Accurate In-City POIs**: Verified landmark coordinates, descriptions, and realistic wait/visit times for destinations worldwide.

### 3. 🌐 Real-Time Data & Live Services (`lib/liveTravelService.ts`)
- **Open-Meteo Weather**: Live 7-day multi-metric forecast (precipitation, wind gusts, UV index, extreme weather alerts) with zero API key requirement.
- **Wikipedia Live Attractions Directory**: Dynamic POI discovery pulling official encyclopedic summaries and coordinates.
- **Two-Way Voice & Text Translator**: Live translation bridging traveler speech to local dialects with audio pronunciation and instant test chips.
- **Network Resilience**: Standard HTTP `fetch` requests with configurable `AbortController` timeouts (8000ms default) and graceful fallback mechanisms.

### 4. 🌙 Dark Mode & Modern UI
- **Smooth Theme Toggle**: Complete Dark/Light mode switcher with `localStorage` preference persistence.
- **Adaptive Visual Tokens**: Glassmorphic styling, responsive layout (mobile-first), timeline views, and interactive modals.
- **Multi-Currency Budget Inspector**: Real-time breakdown across Flights, Lodging, Activities, Food, and Hidden Contingencies (lockers, tipping, local permits).

### 5. 🛡️ Global Emergency Directory (`lib/emergencyData.ts`)
- Instant one-tap access to verified emergency numbers (Police, Ambulance, Fire, Tourist Police) for 30+ countries.

---

## 🏗️ Architecture & Project Structure

```
wayvo/
├── app/
│   ├── api/
│   │   ├── plan/route.ts          # AI & clustered itinerary generation
│   │   ├── weather/route.ts       # Open-Meteo live weather forecasting
│   │   ├── emergency/route.ts     # Verified emergency numbers lookup
│   │   ├── translate/route.ts     # Live multi-lingual translation endpoint
│   │   └── copilot/route.ts       # Interactive trip guidance & query responder
│   ├── page.tsx                   # Main Trip Planning & Execution Dashboard
│   ├── layout.tsx                 # Root layout with ThemeProvider & fonts
│   └── globals.css                # Global styles & dark mode design system
├── components/
│   ├── ActivityCard.tsx           # Interactive activity card (Visited/Pin/Swap/Cab)
│   ├── BudgetView.tsx             # Interactive 6-category cost breakdown
│   ├── CabBookingModal.tsx        # In-app transit ride hailing simulator
│   ├── EmergencyView.tsx          # Emergency services fast-dial directory
│   ├── ExploreAlternatives.tsx    # Drop-in activity replacement catalog
│   ├── HotelSelector.tsx          # Neighborhood-anchored accommodation picker
│   ├── Navbar.tsx                 # Top navigation with currency & theme switches
│   ├── PlanForm.tsx               # Comprehensive trip requirement intake
│   ├── RunningLateModal.tsx       # Live schedule recovery & reflow modal
│   ├── SettingsModal.tsx          # User preferences & API key management
│   ├── TimelineView.tsx           # Hour-by-hour vertical chronological timeline
│   ├── TripCopilotModal.tsx       # Floating AI concierge modal
│   ├── TripDashboard.tsx          # Main execution control center
│   └── VoiceTranslator.tsx        # Two-way voice/text translation console
├── lib/
│   ├── engine.ts                  # Pure mathematical scheduling & reflow engine
│   ├── liveTravelService.ts       # Live HTTP fetch wrapper with timeout handling
│   ├── sampleData.ts              # Neighborhood clusters & curated destination bank
│   ├── emergencyData.ts           # Curated emergency directory for 30+ nations
│   └── types.ts                   # Unified TypeScript definitions
├── public/                        # Static assets & icons
├── scripts/
│   └── deploy-github.js           # 1-command GitHub deployment script
├── tailwind.config.js             # Tailwind CSS configuration with dark mode class
└── tsconfig.json                  # Strict TypeScript configuration
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- [npm](https://www.npmjs.com/) v9.0.0 or higher

### 1. Clone the Repository
```bash
git clone https://github.com/yashliveinsaan/Wayvo.git
cd Wayvo
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment (Optional)
```bash
cp .env.example .env.local
```
Add an optional Anthropic API key to unlock dynamic Claude LLM synthesis:
```env
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```
*(Note: The application includes full offline & curated live-engine fallbacks, meaning it functions completely out of the box even without API keys!)*

### 4. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to start planning trips!

### 5. Build for Production
```bash
npm run build
npm start
```

---

## 🧪 Testing Core Scenarios

1. **Test Geographical Accuracy**: Enter destination `Jaipur`, 3 days, budget `₹35,000`. Observe how Day 1 stays strictly in the Northern Amer/Nahargarh ridge, Day 2 focuses on the Walled Pink City core, and Day 3 covers the Southern Cultural Quarter with zero duplicate locations.
2. **Test "I'm Running Late"**: Mark a 45-minute delay on Day 1. Watch the engine automatically reflow downstream activities while protecting your pinned spots.
3. **Test Dark Mode**: Click the Settings gear in the navigation bar and toggle "Dark Mode". Notice instantaneous transitions across cards, inputs, and modals.
4. **Test Live Translator**: Switch to the Translator tab, type a travel phrase (e.g. "Where is the nearest medical store?"), and test instant translation into Hindi, Japanese, French, or Spanish.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).

---

## 👤 Author
Developed and maintained by **[yashliveinsaan](https://github.com/yashliveinsaan)**.
