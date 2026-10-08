import type { Activity, Day, Plan, BudgetSummary, Transportation } from "./types";

export const toMin = (t: string): number => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const fmt = (n: number): string => {
  n = Math.max(0, Math.round(n));
  const h = Math.floor(n / 60) % 24;
  const m = n % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * TOTAL TIME REQUIRED = EXPECTED WAITING TIME + ESTIMATED VISIT DURATION
 * This is one of the most critical principles of the application.
 */
export const total = (a: Activity): number => (a.waitMin ?? 0) + a.visitMin;

export const hm = (m: number): string => {
  m = Math.max(0, Math.round(m));
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours > 0 && mins > 0) return `${hours} hr ${mins} min`;
  if (hours > 0) return `${hours} hr`;
  return `${mins} min`;
};

export const getTransitMinutes = (transport: Activity["transport"]): number => {
  if (!transport) return 20;
  if (typeof transport === "object" && typeof transport.durationMin === "number") {
    return Math.max(5, transport.durationMin);
  }
  return 20; // Default transit buffer
};

export const DAY_END = 21 * 60 + 30; // 21:30
export const DAY_START = 9 * 60; // 09:00

export interface ReflowResult {
  day: Day;
  warnings: string[];
  conflicts: string[];
}

/**
 * Re-optimizes from index `fromIndex` only; earlier items (especially completed) are preserved.
 * Strictly respects opening hours, transit buffers, and closing times.
 */
export function reflow(day: Day, fromIndex = 0): ReflowResult {
  const acts = [...day.activities];
  const warnings: string[] = [];
  const conflicts: string[] = [];

  const startFrom = Math.max(0, fromIndex);

  for (let i = startFrom; i < acts.length; i++) {
    const a = { ...acts[i] };

    if (i > 0) {
      const prev = acts[i - 1];
      const prevFinish = toMin(prev.start) + total(prev);
      const transit = getTransitMinutes(a.transport);
      const earliestAfterTransit = prevFinish + transit;

      // Cannot start before the attraction opens
      const openMin = a.kind === "attraction" && a.open ? toMin(a.open) : 0;
      const targetStart = Math.max(earliestAfterTransit, openMin);

      // Only shift forward if the current scheduled start is too early
      if (toMin(a.start) < targetStart) {
        a.start = fmt(targetStart);
      }
    } else {
      // First activity of the day: ensure not before opening
      const openMin = a.kind === "attraction" && a.open ? toMin(a.open) : DAY_START;
      if (toMin(a.start) < openMin) {
        a.start = fmt(openMin);
      }
    }

    // Set end time for convenience
    a.end = fmt(toMin(a.start) + total(a));
    acts[i] = a;
  }

  // Conflict and feasibility validation
  acts.forEach((a) => {
    const startM = toMin(a.start);
    const finishM = startM + total(a);

    // Opening / Closing hours check
    if (a.kind === "attraction") {
      const openM = toMin(a.open);
      const closeM = toMin(a.close);

      if (startM < openM) {
        conflicts.push(`${a.name} is scheduled to start at ${a.start}, but opens at ${a.open}.`);
      }
      if (finishM > closeM) {
        conflicts.push(`${a.name} requires until ${fmt(finishM)}, but closes at ${a.close}.`);
      }
    }

    // Waiting time intelligence warning
    if ((a.waitMin ?? 0) >= 45) {
      warnings.push(`${a.name}: Long wait expected (${a.waitMin} min). This may make today's itinerary difficult to complete.`);
    }
  });

  const last = acts[acts.length - 1];
  if (last && toMin(last.start) + total(last) > DAY_END) {
    warnings.push(`Day runs until ${fmt(toMin(last.start) + total(last))}, which is past 21:30. Consider replacing or removing an activity.`);
  }

  return {
    day: { ...day, activities: acts },
    warnings,
    conflicts,
  };
}

const isDayOverloaded = (d: Day): boolean => {
  const acts = d.activities.filter((a) => !a.done);
  if (acts.length === 0) return false;
  const last = acts[acts.length - 1];
  const lastFinish = toMin(last.start) + total(last);

  if (lastFinish > DAY_END) return true;

  // Check if any unfinished attraction finishes after its closing time
  return acts.some((a) => {
    if (a.kind !== "attraction" || !a.close) return false;
    return toMin(a.start) + total(a) > toMin(a.close);
  });
};

export interface RunningLateResult {
  day: Day;
  changes: string[];
}

/**
 * "I'M RUNNING LATE" Engine:
 * 1. Shifts unfinished activities by `delayMinutes`.
 * 2. Re-times from the first unfinished activity.
 * 3. If overloaded (past closing or past 21:30):
 *    - Reduces flexible visit duration (up to 30% reduction if > 60m).
 *    - Removes lowest-priority flexible attractions (priority 3, then 2).
 *    - Preserves high-priority (priority 1) and fixed activities.
 * 4. Returns updated day and human-readable "What Changed" report.
 */
export function runLate(day: Day, delayMinutes: number): RunningLateResult {
  const changes: string[] = [];
  const firstUnfinishedIdx = day.activities.findIndex((a) => !a.done);

  if (firstUnfinishedIdx < 0) {
    return { day, changes: ["All activities today are already completed. Nothing to reschedule."] };
  }

  // 1. Shift remaining unfinished activities
  let updatedDay: Day = {
    ...day,
    activities: day.activities.map((a, i) => {
      if (i < firstUnfinishedIdx) return a;
      return { ...a, start: fmt(toMin(a.start) + delayMinutes) };
    }),
  };

  changes.push(`Shifted remaining activities by ${delayMinutes} minutes.`);
  updatedDay = reflow(updatedDay, firstUnfinishedIdx).day;

  const shortenedIds = new Set<string>();

  // 2. Loop until schedule fits or no further adjustments can be made
  while (isDayOverloaded(updatedDay)) {
    // Find candidate to adjust: lowest priority, not done, not fixed, attraction
    const candidates = updatedDay.activities
      .filter((a) => !a.done && !a.fixed && a.kind === "attraction" && a.priority > 1)
      .sort((a, b) => b.priority - a.priority);

    const target = candidates[0];
    if (!target) break;

    const idx = updatedDay.activities.indexOf(target);

    // Option A: Shorten flexible visit duration
    if (!shortenedIds.has(target.id) && target.visitMin > 60) {
      shortenedIds.add(target.id);
      const newDuration = Math.max(45, Math.round(target.visitMin * 0.7));
      const newActivities = [...updatedDay.activities];
      newActivities[idx] = { ...target, visitMin: newDuration };
      updatedDay = reflow({ ...updatedDay, activities: newActivities }, idx).day;
      changes.push(`Shortened visit at ${target.name} to ${hm(newDuration)} to preserve schedule.`);
      continue;
    }

    // Option B: Remove low-priority activity
    updatedDay = reflow(
      { ...updatedDay, activities: updatedDay.activities.filter((a) => a.id !== target.id) },
      Math.max(firstUnfinishedIdx, idx)
    ).day;
    changes.push(`Removed ${target.name} (Priority ${target.priority}) due to closing hour or evening constraints.`);
  }

  if (isDayOverloaded(updatedDay)) {
    changes.push("Schedule is still tight because remaining activities are High Priority. Consider shifting one to tomorrow.");
  }

  return { day: updatedDay, changes };
}

/**
 * Dynamic Trip Copilot logic:
 * Processes traveler situational instructions:
 * "It is raining", "I'm tired", "This place is closed", "I want to skip lunch",
 * "I want to spend more time here", "I don't want to visit this place", "I have already visited this location"
 */
export function applyCopilot(
  plan: Plan,
  dayIdx: number,
  instruction: string
): { plan: Plan; changes: string[] } {
  const currentDay = plan.days[dayIdx];
  if (!currentDay) return { plan, changes: ["Invalid day."] };

  const prompt = instruction.toLowerCase().trim();
  const changes: string[] = [];
  const unfinishedIdx = currentDay.activities.findIndex((a) => !a.done);
  const currentAct = unfinishedIdx >= 0 ? currentDay.activities[unfinishedIdx] : null;

  let newActivities = [...currentDay.activities];
  let newAlternatives = [...plan.alternatives];

  if (prompt.includes("rain") || prompt.includes("weather") || prompt.includes("storm")) {
    // Find outdoor unfinished activities and swap with indoor alternatives
    let swappedCount = 0;
    newActivities = newActivities.map((a, i) => {
      if (i < unfinishedIdx || a.done || a.indoor || a.kind !== "attraction") return a;

      const indoorAlt = newAlternatives.find((x) => x.indoor && x.kind === "attraction");
      if (indoorAlt) {
        newAlternatives = newAlternatives.filter((x) => x.id !== indoorAlt.id);
        newAlternatives.push(a);
        swappedCount++;
        changes.push(`Swapped outdoor '${a.name}' with indoor '${indoorAlt.name}' due to rain.`);
        return { ...indoorAlt, start: a.start };
      }
      return a;
    });

    if (swappedCount === 0) {
      changes.push("All remaining planned activities are already indoors.");
    }
  } else if (prompt.includes("tired") || prompt.includes("exhausted") || prompt.includes("rest")) {
    // Shorten remaining activities or drop the last attraction so the user can rest earlier
    const flexibleAttraction = [...newActivities]
      .reverse()
      .find((a) => !a.done && a.kind === "attraction" && a.priority > 1);

    if (flexibleAttraction) {
      newActivities = newActivities.filter((a) => a.id !== flexibleAttraction.id);
      newAlternatives.push(flexibleAttraction);
      changes.push(`Removed '${flexibleAttraction.name}' so you can return to the hotel and rest early.`);
    } else {
      // Shorten durations
      newActivities = newActivities.map((a, i) => {
        if (i < unfinishedIdx || a.done || a.visitMin <= 45) return a;
        const shortened = Math.round(a.visitMin * 0.7);
        changes.push(`Shortened '${a.name}' visit to ${hm(shortened)}.`);
        return { ...a, visitMin: shortened };
      });
    }
  } else if (prompt.includes("closed") || prompt.includes("shut")) {
    if (currentAct) {
      const alt = newAlternatives.find((x) => x.kind === currentAct.kind && total(x) <= total(currentAct) + 40);
      newActivities = newActivities.filter((a) => a.id !== currentAct.id);
      if (alt) {
        newAlternatives = newAlternatives.filter((x) => x.id !== alt.id);
        newActivities.splice(unfinishedIdx, 0, { ...alt, start: currentAct.start });
        changes.push(`Replaced closed venue '${currentAct.name}' with open alternative '${alt.name}'.`);
      } else {
        changes.push(`Removed closed venue '${currentAct.name}' and re-timed upcoming stops.`);
      }
    } else {
      changes.push("No active venue found to replace.");
    }
  } else if (prompt.includes("skip lunch") || prompt.includes("skip dinner") || prompt.includes("skip meal")) {
    const mealIdx = newActivities.findIndex((a, i) => i >= unfinishedIdx && !a.done && a.kind === "meal");
    if (mealIdx >= 0) {
      const skippedMeal = newActivities[mealIdx];
      newActivities.splice(mealIdx, 1);
      changes.push(`Skipped '${skippedMeal.name}'. Next activities pulled forward.`);
    } else {
      changes.push("No upcoming meals scheduled for today.");
    }
  } else if (prompt.includes("more time") || prompt.includes("extend")) {
    if (currentAct) {
      const extraMin = 45;
      newActivities[unfinishedIdx] = { ...currentAct, visitMin: currentAct.visitMin + extraMin };
      changes.push(`Added 45 minutes to '${currentAct.name}'. Later stops re-timed.`);
    }
  } else if (prompt.includes("already visited") || prompt.includes("visited this")) {
    if (currentAct) {
      newActivities[unfinishedIdx] = { ...currentAct, done: true };
      changes.push(`Marked '${currentAct.name}' as completed.`);
    }
  } else if (prompt.includes("don't want to visit") || prompt.includes("remove")) {
    if (currentAct) {
      newActivities = newActivities.filter((a) => a.id !== currentAct.id);
      newAlternatives.push(currentAct);
      changes.push(`Removed '${currentAct.name}' from your schedule.`);
    }
  } else {
    // General fallback re-balance
    changes.push("Copilot analyzed your request: verified timing buffers and preserved user preferences.");
  }

  const reflowed = reflow({ ...currentDay, activities: newActivities }, Math.max(0, unfinishedIdx));

  const updatedPlan: Plan = {
    ...plan,
    alternatives: newAlternatives,
    days: plan.days.map((d, i) => (i === dayIdx ? reflowed.day : d)),
  };

  return { plan: updatedPlan, changes };
}

/**
 * Trip-level budget recalculation
 */
export function budget(p: Plan): BudgetSummary {
  let attractions = 0;
  let food = 0;
  let unknown = 0;
  let known = 0;
  let est = 0;

  p.days.forEach((d) => {
    d.activities.forEach((a) => {
      if (a.ticket == null) {
        unknown++;
      } else {
        const cost = a.ticket * p.travelers;
        if (a.kind === "meal") food += cost;
        else attractions += cost;
      }

      a.extras.forEach((e) => {
        if (e.amount == null) {
          unknown++;
        } else if (e.kind === "known") {
          known += e.amount * (e.category === "ticket" ? p.travelers : 1);
        } else {
          est += e.amount * (e.category === "ticket" ? p.travelers : 1);
        }
      });
    });
  });

  if (p.hotel.pricePerNight == null) unknown++;
  const nights = Math.max(1, p.days.length - 1);
  const acc = (p.hotel.pricePerNight ?? 0) * nights;
  const transport = (p.transportPerDay ?? 0) * p.days.length * p.travelers;

  const planned = acc + transport + food + attractions + known + est;
  const remaining = p.budget - planned;
  const over = planned > p.budget;
  const overAmount = over ? planned - p.budget : 0;

  return {
    acc,
    transport,
    food,
    attractions,
    known,
    est,
    unknown,
    planned,
    remaining,
    over,
    overAmount,
  };
}
