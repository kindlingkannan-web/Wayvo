import { NextResponse } from "next/server";
import { budget } from "@/lib/engine";
import type { Plan } from "@/lib/types";
import { createPayPalOrder, isPayPalConfigured } from "@/lib/paypal";
import { convertInrToTargetCurrency, toDecimalSafe, getVerifiedExchangeRate } from "@/lib/currency";
import {
  getPaymentSummary,
  savePaymentSummary,
  savePlan,
  getPlan,
  bindOrderToTrip,
  getOrCreateTripAccessKey,
  verifyTripAccess,
} from "@/lib/paymentStore";

export async function POST(req: Request) {
  try {
    if (!isPayPalConfigured()) {
      return NextResponse.json(
        {
          error:
            "PayPal integration is not configured on this server. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.",
          configured: false,
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { tripId, requestedAmount, paymentType, planData, contributorName } = body;
    const providedAccessKey = req.headers.get("x-trip-access-key") || body.tripAccessKey;

    if (!tripId) {
      return NextResponse.json({ error: "Missing required 'tripId'" }, { status: 400 });
    }

    // 1. Ownership & Access Key Validation
    const expectedAccessKey = await getOrCreateTripAccessKey(tripId);
    if (providedAccessKey) {
      const isValid = await verifyTripAccess(tripId, providedAccessKey);
      if (!isValid) {
        return NextResponse.json(
          { error: "Unauthorized: Invalid trip access credentials." },
          { status: 403 }
        );
      }
    }

    // 2. Authoritative Trip Data Validation
    // Check if authoritative plan exists in persistent storage
    let authoritativePlan = await getPlan(tripId);
    if (!authoritativePlan) {
      if (!planData || !planData.days) {
        return NextResponse.json(
          { error: "Plan data is required to establish authoritative trip budget." },
          { status: 400 }
        );
      }
      // Register initial plan in persistent storage
      authoritativePlan = await savePlan(planData as Plan);
    }

    // Deterministically compute authoritative trip budget
    const computedBudget = budget(authoritativePlan);
    const authoritativeTotal = Math.round(computedBudget.planned);

    if (authoritativeTotal <= 0) {
      return NextResponse.json(
        { error: "Trip has no planned expenses to fund." },
        { status: 400 }
      );
    }

    // 3. Retrieve or initialize authoritative payment summary
    let summary = await getPaymentSummary(tripId);
    if (!summary) {
      summary = {
        tripId,
        totalTripCost: authoritativeTotal,
        totalPaid: 0,
        remainingBalance: authoritativeTotal,
        currency: "INR",
        contributorCount: authoritativePlan.travelers || 1,
        updatedAt: new Date().toISOString(),
      };
      await savePaymentSummary(summary);
    }

    // Note: summary.totalPaid is reconciled directly from the verified transaction ledger in getPaymentSummary
    if (summary.remainingBalance <= 0) {
      return NextResponse.json(
        { error: "This trip is already fully funded. Remaining balance is ₹0." },
        { status: 400 }
      );
    }

    // 4. Validate requested payment amount
    let targetAmountInInr: number;
    if (paymentType === "full") {
      targetAmountInInr = summary.remainingBalance;
    } else {
      const numAmount = Number(requestedAmount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json(
          { error: "Payment amount must be greater than zero." },
          { status: 400 }
        );
      }
      if (numAmount > summary.remainingBalance + 0.01) {
        return NextResponse.json(
          {
            error: `Requested amount (₹${Math.round(numAmount).toLocaleString(
              "en-IN"
            )}) exceeds the unpaid balance of ₹${Math.round(
              summary.remainingBalance
            ).toLocaleString("en-IN")}.`,
          },
          { status: 400 }
        );
      }
      targetAmountInInr = toDecimalSafe(numAmount);
    }

    // 5. Fetch verified exchange rate & convert currency
    const rateInfo = await getVerifiedExchangeRate();
    const conversion = convertInrToTargetCurrency(targetAmountInInr, undefined, rateInfo);

    if (conversion.convertedAmount <= 0) {
      return NextResponse.json(
        { error: "Converted transaction amount must be greater than 0." },
        { status: 400 }
      );
    }

    // 6. Create PayPal Order via official REST API
    const idempotencyKey = `ord_${tripId}_${Date.now()}`;
    const destination = authoritativePlan.destination || "Destination";
    const description = `Wayvo Funding: ${destination} (${contributorName ? `by ${contributorName}` : "Trip contribution"})`;

    const { orderId, status } = await createPayPalOrder({
      tripId,
      amount: conversion.convertedAmount,
      currency: conversion.targetCurrency,
      description,
      customId: JSON.stringify({
        tripId,
        inrAmount: targetAmountInInr,
        contributorName: contributorName || null,
        paymentType: paymentType || "partial",
      }),
      idempotencyKey,
    });

    // 7. Bind PayPal Order ID to this specific Trip ID in store
    await bindOrderToTrip(orderId, tripId);

    return NextResponse.json({
      orderId,
      status,
      tripId,
      tripAccessKey: expectedAccessKey,
      amount: conversion.convertedAmount,
      currency: conversion.targetCurrency,
      originalAmount: targetAmountInInr,
      originalCurrency: "INR",
      exchangeRate: conversion.exchangeRate,
      rateTimestamp: conversion.rateTimestamp,
      rateSource: conversion.rateSource,
    });
  } catch (err: any) {
    console.error("Create order error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create PayPal order" },
      { status: 500 }
    );
  }
}
