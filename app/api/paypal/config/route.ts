import { NextResponse } from "next/server";
import { getPublicPayPalConfig } from "@/lib/paypal";

export async function GET() {
  try {
    const config = getPublicPayPalConfig();
    return NextResponse.json(config);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load PayPal configuration" },
      { status: 500 }
    );
  }
}
