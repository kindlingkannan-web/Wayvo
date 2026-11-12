import { NextResponse } from "next/server";
import { getPublicPayPalConfig } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getPublicPayPalConfig();
    return NextResponse.json(config, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load PayPal configuration" },
      { status: 500 }
    );
  }
}
