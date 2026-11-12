import { NextResponse } from "next/server";
import {
  getTransactionsByTripId,
  getPaymentSummary,
  savePaymentSummary,
  verifyTripAccess,
} from "@/lib/paymentStore";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get("tripId");
    const totalCostParam = searchParams.get("totalCost");
    const accessKey = req.headers.get("x-trip-access-key") || searchParams.get("accessKey");

    if (!tripId) {
      return NextResponse.json({ error: "Missing 'tripId' parameter" }, { status: 400 });
    }

    // Ownership check: if access key is provided, verify it
    if (accessKey) {
      const isValid = await verifyTripAccess(tripId, accessKey);
      if (!isValid) {
        return NextResponse.json({ error: "Unauthorized: Invalid trip access key." }, { status: 403 });
      }
    }

    const transactions = await getTransactionsByTripId(tripId);
    let summary = await getPaymentSummary(tripId);

    // If summary does not exist yet, initialize it with the current authoritative planned cost
    if (!summary && totalCostParam) {
      const totalCost = Number(totalCostParam);
      if (!isNaN(totalCost) && totalCost > 0) {
        summary = {
          tripId,
          totalTripCost: totalCost,
          totalPaid: 0,
          remainingBalance: totalCost,
          currency: "INR",
          contributorCount: 1,
          updatedAt: new Date().toISOString(),
        };
        await savePaymentSummary(summary);
      }
    }

    return NextResponse.json({
      tripId,
      summary: summary || {
        tripId,
        totalTripCost: 0,
        totalPaid: 0,
        remainingBalance: 0,
        currency: "INR",
        contributorCount: 1,
        updatedAt: new Date().toISOString(),
      },
      transactions,
    });
  } catch (err: any) {
    console.error("Fetch transactions error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to retrieve transactions" },
      { status: 500 }
    );
  }
}
