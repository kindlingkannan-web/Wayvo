import { NextResponse } from "next/server";
import {
  getGroupContributions,
  saveGroupContributions,
  getPaymentSummary,
  getTransactionsByTripId,
  verifyTripAccess,
} from "@/lib/paymentStore";
import type { GroupContribution } from "@/lib/paymentTypes";
import { toDecimalSafe } from "@/lib/currency";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get("tripId");
    const travelersCount = Number(searchParams.get("travelers")) || 2;
    const totalCost = Number(searchParams.get("totalCost")) || 0;
    const accessKey = req.headers.get("x-trip-access-key") || searchParams.get("accessKey");

    if (!tripId) {
      return NextResponse.json({ error: "Missing 'tripId' parameter" }, { status: 400 });
    }

    if (accessKey) {
      const isValid = await verifyTripAccess(tripId, accessKey);
      if (!isValid) {
        return NextResponse.json({ error: "Unauthorized trip access" }, { status: 403 });
      }
    }

    let list = await getGroupContributions(tripId);

    // Auto-initialize if empty
    if (list.length === 0 && totalCost > 0) {
      const perPerson = toDecimalSafe(totalCost / Math.max(1, travelersCount));
      list = Array.from({ length: travelersCount }).map((_, i) => ({
        id: `contrib_${i + 1}`,
        tripId,
        name: i === 0 ? "Organizer (You)" : `Traveler ${i + 1}`,
        targetAmount: perPerson,
        paidAmount: 0,
        status: "unpaid",
      }));
      await saveGroupContributions(tripId, list);
    }

    return NextResponse.json({ tripId, contributions: list });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch group contributions" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tripId, contributions, travelersCount, totalCost } = body;
    const accessKey = req.headers.get("x-trip-access-key") || body.tripAccessKey;

    if (!tripId) {
      return NextResponse.json({ error: "Missing 'tripId' parameter" }, { status: 400 });
    }

    if (accessKey) {
      const isValid = await verifyTripAccess(tripId, accessKey);
      if (!isValid) {
        return NextResponse.json({ error: "Unauthorized trip access" }, { status: 403 });
      }
    }

    // Retrieve existing contributions and verified transactions
    const existingContributions = await getGroupContributions(tripId);
    const txs = await getTransactionsByTripId(tripId);

    // Helper to calculate true paid amount for a contributor name
    const getVerifiedPaid = (name: string, fallbackExisting = 0) => {
      const fromTxs = txs
        .filter((t) => t.status === "COMPLETED" && t.contributorName?.toLowerCase() === name.toLowerCase())
        .reduce((sum, t) => sum + t.originalAmount, 0);
      return fromTxs > 0 ? toDecimalSafe(fromTxs) : fallbackExisting;
    };

    let updatedList: GroupContribution[] = [];

    if (Array.isArray(contributions) && contributions.length > 0) {
      // User is updating participant names or targets:
      // SECURITY FIX: Never accept client-supplied paidAmount. Retain authoritative paid amounts!
      updatedList = contributions.map((c, i) => {
        const existing = existingContributions.find((ex) => ex.id === c.id || ex.name === c.name);
        const truePaid = getVerifiedPaid(c.name, existing?.paidAmount || 0);
        const target = toDecimalSafe(Number(c.targetAmount) || 0);

        return {
          id: c.id || `contrib_${i + 1}`,
          tripId,
          name: c.name || `Traveler ${i + 1}`,
          targetAmount: target,
          paidAmount: truePaid,
          status: truePaid >= target && target > 0 ? "completed" : truePaid > 0 ? "partial" : "unpaid",
          lastPaymentAt: existing?.lastPaymentAt,
        };
      });
    } else if (travelersCount && totalCost) {
      // Re-initialize / rebalance with new traveler count
      const count = Math.max(1, Number(travelersCount));
      const perPerson = toDecimalSafe(Number(totalCost) / count);

      updatedList = Array.from({ length: count }).map((_, i) => {
        const prev = existingContributions[i];
        const name = prev?.name || (i === 0 ? "Organizer (You)" : `Traveler ${i + 1}`);
        const truePaid = getVerifiedPaid(name, prev?.paidAmount || 0);

        return {
          id: prev?.id || `contrib_${i + 1}`,
          tripId,
          name,
          targetAmount: perPerson,
          paidAmount: truePaid,
          status: truePaid >= perPerson ? "completed" : truePaid > 0 ? "partial" : "unpaid",
          lastPaymentAt: prev?.lastPaymentAt,
        };
      });
    }

    await saveGroupContributions(tripId, updatedList);
    return NextResponse.json({ success: true, contributions: updatedList });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update group contributions" },
      { status: 500 }
    );
  }
}
