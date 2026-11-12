import { NextResponse } from "next/server";
import { capturePayPalOrder, isPayPalConfigured } from "@/lib/paypal";
import { convertTargetCurrencyToInr, toDecimalSafe } from "@/lib/currency";
import {
  saveTransaction,
  getTransactionByOrderId,
  getTransactionByCaptureId,
  getPaymentSummary,
  savePaymentSummary,
  getGroupContributions,
  saveGroupContributions,
  getOrderTripId,
  verifyTripAccess,
} from "@/lib/paymentStore";
import type { PaymentTransaction } from "@/lib/paymentTypes";

export async function POST(req: Request) {
  try {
    if (!isPayPalConfigured()) {
      return NextResponse.json(
        { error: "PayPal is not configured on this server." },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { orderId, tripId, contributorName, paymentType } = body;
    const providedAccessKey = req.headers.get("x-trip-access-key") || body.tripAccessKey;

    if (!orderId || !tripId) {
      return NextResponse.json(
        { error: "Missing required 'orderId' or 'tripId'." },
        { status: 400 }
      );
    }

    // 1. Ownership & Trip Access Verification
    if (providedAccessKey) {
      const isValid = await verifyTripAccess(tripId, providedAccessKey);
      if (!isValid) {
        return NextResponse.json(
          { error: "Unauthorized: Invalid trip access credentials." },
          { status: 403 }
        );
      }
    }

    // 2. Order-Trip Binding Verification (Prevent capturing another trip's order)
    const boundTripId = await getOrderTripId(orderId);
    if (boundTripId && boundTripId !== tripId) {
      return NextResponse.json(
        { error: "Cross-trip ownership violation: This order belongs to a different trip." },
        { status: 403 }
      );
    }

    // 3. Idempotency Check: Check if this order was already captured and recorded
    const existingTx = await getTransactionByOrderId(orderId);
    if (existingTx && existingTx.status === "COMPLETED") {
      const summary = await getPaymentSummary(tripId);
      return NextResponse.json({
        success: true,
        alreadyCaptured: true,
        transaction: existingTx,
        summary,
        message: "Order was already verified and captured.",
      });
    }

    // 4. Perform official server-side capture via PayPal REST API
    const idempotencyKey = `cap_${orderId}`;
    const captureResult = await capturePayPalOrder(orderId, idempotencyKey);

    // 5. Strictly verify PayPal's authoritative response
    if (captureResult.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: `Payment capture status is '${captureResult.status}'. Expected 'COMPLETED'.`,
          status: captureResult.status,
        },
        { status: 400 }
      );
    }

    if (!captureResult.captureId) {
      return NextResponse.json(
        { error: "PayPal did not return a valid Capture ID." },
        { status: 500 }
      );
    }

    // Verify PayPal's referenceId matches tripId if returned
    if (captureResult.referenceId && captureResult.referenceId !== tripId) {
      return NextResponse.json(
        { error: "Security violation: PayPal order reference does not match requested trip ID." },
        { status: 403 }
      );
    }

    // 6. Check if capture ID was already recorded
    const existingCapTx = await getTransactionByCaptureId(captureResult.captureId);
    if (existingCapTx) {
      const summary = await getPaymentSummary(tripId);
      return NextResponse.json({
        success: true,
        alreadyCaptured: true,
        transaction: existingCapTx,
        summary,
      });
    }

    // 7. Convert captured amount to authoritative trip INR
    const capturedInr = convertTargetCurrencyToInr(
      captureResult.amount,
      captureResult.currency
    );

    const nowIso = new Date().toISOString();

    // 8. Build verified transaction record
    const transaction: PaymentTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tripId,
      paypalOrderId: orderId,
      paypalCaptureId: captureResult.captureId,
      amount: captureResult.amount,
      currency: captureResult.currency,
      originalAmount: capturedInr,
      originalCurrency: "INR",
      paymentType: (paymentType as any) || "partial",
      status: "COMPLETED",
      contributorName: contributorName || undefined,
      payerEmail: captureResult.payerEmail,
      payerName: captureResult.payerName,
      createdAt: nowIso,
      capturedAt: nowIso,
    };

    // 9. Save transaction with duplicate constraint enforcement
    await saveTransaction(transaction);

    // 10. Update authoritative Trip Payment Summary
    // (getPaymentSummary automatically reconciles totalPaid from verified COMPLETED transactions)
    let summary = await getPaymentSummary(tripId);
    if (!summary) {
      summary = {
        tripId,
        totalTripCost: capturedInr,
        totalPaid: capturedInr,
        remainingBalance: 0,
        currency: "INR",
        contributorCount: 1,
        updatedAt: nowIso,
      };
      await savePaymentSummary(summary);
    } else {
      summary.updatedAt = nowIso;
      await savePaymentSummary(summary);
    }

    // 11. Update group contribution for participant
    if (contributorName) {
      const contributions = await getGroupContributions(tripId);
      const contributor = contributions.find(
        (c) => c.name.toLowerCase() === contributorName.toLowerCase()
      );
      if (contributor) {
        contributor.paidAmount = toDecimalSafe(contributor.paidAmount + capturedInr);
        contributor.status =
          contributor.paidAmount >= contributor.targetAmount
            ? "completed"
            : contributor.paidAmount > 0
            ? "partial"
            : "unpaid";
        contributor.lastPaymentAt = nowIso;
        await saveGroupContributions(tripId, contributions);
      }
    }

    return NextResponse.json({
      success: true,
      transaction,
      summary,
    });
  } catch (err: any) {
    console.error("Capture order error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to capture PayPal order" },
      { status: 500 }
    );
  }
}
