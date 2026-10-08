import { NextResponse } from "next/server";
import { claude, parseJSON } from "@/lib/ai";
import { reflow } from "@/lib/engine";
import { generateSamplePlan } from "@/lib/sampleData";
import { fetchLiveAttractions, fetchLiveDestinationDetails } from "@/lib/liveTravelService";
import type { Plan, Activity, GroupType, FoodPreference } from "@/lib/types";

const SYSTEM_PROMPT = `You are a world-class, realistic AI travel agent. You plan time-feasible trips with UNIQUE places each day.
IMPORTANT: NEVER repeat the same spot or attraction more than once in the entire trip! Every day must have distinct, unique venues.

Return ONLY valid JSON with no markdown wrapping and no backticks matching this schema:
{
  "hotel": {
    "id": "h1",
    "name": "string",
    "rating": number or null,
    "pricePerNight": number or null (in INR),
    "description": "string",
    "keyFacilities": ["string"],
    "reason": "string (Why recommended: suitability for group/comfort/location only. NEVER mention price or distance from previous stop)",
    "availabilityStatus": "available"|"estimated"|"unavailable"
  },
  "transportPerDay": number or null (INR per person/day),
  "days": [
    {
      "date": "YYYY-MM-DD",
      "dayNumber": number,
      "activities": [
        {
          "id": "act_X_Y",
          "name": "string (MUST BE UNIQUE ACROSS ALL DAYS)",
          "description": "string",
          "kind": "attraction"|"meal",
          "indoor": boolean,
          "priority": 1|2|3 (1=must see, 3=flexible),
          "ticket": number or null (INR per person),
          "waitMin": number or null (expected queue minutes; null if none),
          "waitLabel": "Estimated waiting time"|"Waiting time unavailable"|"No queue expected",
          "visitMin": number (minutes at venue),
          "open": "HH:MM",
          "close": "HH:MM",
          "start": "HH:MM",
          "reason": "string (short concise reason why recommended)",
          "transport": {
            "method": "Walking"|"Metro"|"Bus"|"Taxi/cab"|"Auto rickshaw"|"Private vehicle",
            "durationMin": number,
            "cost": number or null,
            "departureTime": "HH:MM",
            "notes": "string"
          },
          "extras": [
            { "label": "string", "amount": number or null, "kind": "known"|"estimated"|"unknown", "category": "locker"|"booking_fee"|"service_fee"|"permit"|"other" }
          ],
          "done": false
        }
      ]
    }
  ],
  "alternatives": [
    { same Activity schema as above, unique, explaining why it fits }
  ]
}

CRITICAL RULES:
- EVERY DAY MUST VISIT UNIQUE PLACES. DO NOT REPEAT ANY MONUMENT, MUSEUM, OR RESTAURANT.
- TOTAL TIME REQUIRED = EXPECTED WAITING TIME + ESTIMATED VISIT DURATION.
- Max 2-3 attractions per day plus 2 meals (Lunch ~12:30-14:00, Dinner ~19:30-21:30).
- Respect opening & closing hours strictly.
- Strict food preference: Vegetarian, Non-vegetarian, Vegan.
- Real transit duration (15-35 min) with buffer between stops.
- Never invent prices or hours: use null for unknowns.
- Realistic day schedule: starts 09:00-09:30, ends by 21:00-21:30.`;

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      try {
        const textBody = await req.text();
        body = JSON.parse(textBody);
      } catch {
        return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
      }
    }

    const destination = (body.destination || "").trim();
    if (!destination) {
      return NextResponse.json({ error: "Destination is required" }, { status: 400 });
    }

    const travelers = Math.max(1, Math.min(20, Number(body.travelers) || 2));
    const budget = Math.max(100, Number(body.budget) || 25000);
    const duration = Math.max(1, Math.min(10, Number(body.days) || Number(body.duration) || 3));
    const group: GroupType = body.group || "Friends";
    const diet: FoodPreference = body.diet || "Vegetarian";
    const language = body.language || "English";
    const startDate = body.startDate || new Date().toISOString().split("T")[0];
    const endDate = body.endDate;

    // 1. ACCESS REAL-TIME DATA: Fetch live destination details and live attractions via Wikipedia & Open-Meteo
    let liveAttractions: any[] = [];
    let liveDestination: any = null;

    try {
      const [destDetails, attractions] = await Promise.all([
        fetchLiveDestinationDetails(destination),
        fetchLiveAttractions(destination, Math.max(15, duration * 4)),
      ]);
      liveDestination = destDetails;
      liveAttractions = attractions || [];
    } catch (liveErr: any) {
      console.warn("Live travel data fetch error (timeout handled):", liveErr.message);
    }

    // 2. Prepare Prompt for Claude AI if API key configured
    let aiPlanRaw: any = null;
    let source: Plan["source"] = liveAttractions.length > 0 ? "Live" : "Sample data";

    if (process.env.ANTHROPIC_API_KEY) {
      const livePlacesContext = liveAttractions.length > 0
        ? `\nREAL-TIME VERIFIED ATTRACTIONS FOR ${destination}:\n` +
          liveAttractions.map((a, i) => `${i + 1}. ${a.name}: ${a.description}`).join("\n")
        : "";

      const userPrompt = `Destination: ${destination}
Trip duration: ${duration} days
Start Date: ${startDate}
Number of travelers: ${travelers}
Group type: ${group}
Total budget: ₹${budget}
Food preference: ${diet} (Strictly adhere to this!)
Preferred language: ${language}${livePlacesContext}

Generate a realistic, feasible, time-optimized itinerary where TOTAL TIME REQUIRED equals WAIT TIME plus VISIT DURATION.
MANDATORY: Ensure EVERY day has UNIQUE places. Do NOT repeat any attraction or restaurant across days.`;

      const aiResponse = await claude(SYSTEM_PROMPT, userPrompt, 6000);

      if (aiResponse) {
        try {
          aiPlanRaw = parseJSON(aiResponse);
        } catch (parseErr) {
          console.warn("AI response was not valid JSON, falling back to sample plan:", parseErr);
        }
      }
    }

    // 3. Process AI Plan if valid
    if (aiPlanRaw && aiPlanRaw.days && Array.isArray(aiPlanRaw.days) && aiPlanRaw.days.length > 0) {
      const seenNames = new Set<string>();

      const reflowedDays = aiPlanRaw.days.map((d: any, idx: number) => {
        const dateObj = new Date(startDate);
        dateObj.setDate(dateObj.getDate() + idx);

        const activitiesList = (d.activities || []).map((a: any, actIdx: number) => {
          let cleanName = a.name || `Activity ${actIdx + 1}`;
          const norm = cleanName.toLowerCase().trim();

          // Enforce uniqueness across days
          if (seenNames.has(norm)) {
            // Swap with an unused live attraction if available
            const unusedLive = liveAttractions.find((la) => !seenNames.has(la.name.toLowerCase().trim()));
            if (unusedLive) {
              cleanName = unusedLive.name;
              seenNames.add(unusedLive.name.toLowerCase().trim());
            } else {
              cleanName = `${cleanName} (Section ${idx + 1})`;
            }
          } else {
            seenNames.add(norm);
          }

          return {
            id: a.id || `act_${idx}_${actIdx}`,
            name: cleanName,
            description: a.description || "",
            kind: a.kind === "meal" ? "meal" : "attraction",
            indoor: Boolean(a.indoor),
            priority: [1, 2, 3].includes(a.priority) ? a.priority : 2,
            ticket: typeof a.ticket === "number" ? a.ticket : null,
            waitMin: typeof a.waitMin === "number" ? a.waitMin : null,
            waitLabel: a.waitMin != null ? "Estimated waiting time" : "Waiting time unavailable",
            visitMin: Number(a.visitMin) || 60,
            open: a.open || "09:00",
            close: a.close || "18:00",
            start: a.start || (actIdx === 0 ? "09:30" : "12:00"),
            reason: a.reason || "Recommended for your schedule.",
            transport: a.transport || { method: "Taxi/cab", durationMin: 20, cost: 200, bookingAvailable: true },
            extras: Array.isArray(a.extras) ? a.extras : [],
            done: false,
          };
        });

        const dayFormatted = {
          date: d.date || dateObj.toISOString().split("T")[0],
          dayNumber: idx + 1,
          activities: activitiesList,
        };
        return reflow(dayFormatted).day;
      });

      const finalPlan: Plan = {
        id: "plan_" + Date.now(),
        destination,
        startDate,
        endDate,
        durationDays: duration,
        travelers,
        group,
        budget,
        diet,
        language,
        source: "AI estimate",
        hotel: aiPlanRaw.hotel || {
          id: "h_ai",
          name: `${destination} Central Hotel`,
          rating: 4.3,
          pricePerNight: Math.round((budget * 0.35) / duration),
          currency: "INR",
          description: "Comfortable and centrally positioned accommodation.",
          keyFacilities: ["Wi-Fi", "Breakfast", "Air conditioning"],
          reason: `Suited for ${group.toLowerCase()} travelers with good city access.`,
          availabilityStatus: "estimated",
        },
        transportPerDay: typeof aiPlanRaw.transportPerDay === "number" ? aiPlanRaw.transportPerDay : 400,
        days: reflowedDays,
        alternatives: (aiPlanRaw.alternatives || []).map((alt: any, idx: number) => ({
          id: alt.id || `alt_ai_${idx}`,
          name: alt.name || "Alternative venue",
          description: alt.description || "",
          kind: alt.kind === "meal" ? "meal" : "attraction",
          indoor: Boolean(alt.indoor),
          priority: 2,
          ticket: alt.ticket ?? null,
          waitMin: alt.waitMin ?? null,
          waitLabel: alt.waitMin != null ? "Estimated waiting time" : "Waiting time unavailable",
          visitMin: alt.visitMin || 60,
          open: alt.open || "09:00",
          close: alt.close || "18:00",
          start: alt.start || "14:00",
          reason: alt.reason || "Fits available time slot and budget.",
          transport: alt.transport || { method: "Taxi/cab", durationMin: 15, cost: 150 },
          extras: alt.extras || [],
          done: false,
        })),
      };

      return NextResponse.json(finalPlan);
    }

    // 4. Generate plan using Real-Time Live Attractions + Verified Directory
    const samplePlan = generateSamplePlan({
      destination,
      days: duration,
      startDate,
      endDate,
      travelers,
      group,
      budget,
      diet,
      language,
      liveAttractions,
    });

    return NextResponse.json(samplePlan);
  } catch (err: any) {
    console.error("Plan route error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate travel plan" },
      { status: 500 }
    );
  }
}
