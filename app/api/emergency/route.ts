import { NextResponse } from "next/server";
import { lookupEmergency } from "@/lib/emergencyData";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("country") || "";
  if (!q.trim()) {
    return NextResponse.json({ error: "Country or destination is required" }, { status: 400 });
  }

  const result = lookupEmergency(q);
  return NextResponse.json(result);
}
