import { NextResponse } from "next/server";
import { applyCopilot } from "@/lib/engine";
import type { Plan } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const { plan, dayIndex, instruction } = await req.json();

    if (!plan || dayIndex == null || !instruction) {
      return NextResponse.json({ error: "Missing plan, dayIndex, or instruction" }, { status: 400 });
    }

    const result = applyCopilot(plan as Plan, Number(dayIndex), String(instruction));
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Copilot error:", err);
    return NextResponse.json({ error: err.message || "Failed to process copilot request" }, { status: 500 });
  }
}
