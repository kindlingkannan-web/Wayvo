import assert from "node:assert";
import {
  convertInrToTargetCurrency,
  convertTargetCurrencyToInr,
  toDecimalSafe,
  getVerifiedExchangeRate,
  SUPPORTED_PAYPAL_CURRENCIES,
} from "../lib/currency";
import {
  saveTransaction,
  getTransactionByOrderId,
  getTransactionByCaptureId,
  getTransactionsByTripId,
  getPaymentSummary,
  savePaymentSummary,
  getGroupContributions,
  saveGroupContributions,
  savePlan,
  getPlan,
  bindOrderToTrip,
  getOrderTripId,
  getOrCreateTripAccessKey,
  verifyTripAccess,
} from "../lib/paymentStore";
import { budget, reflow, applyCopilot } from "../lib/engine";
import { generateSamplePlan } from "../lib/sampleData";
import type { PaymentTransaction, GroupContribution, TripPaymentSummary } from "../lib/paymentTypes";

async function runTests() {
  console.log("=== RUNNING WAYVO PAYPAL INTEGRATION & REGRESSION TEST SUITE ===\n");
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`✗ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  async function testAsync(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`✗ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // --- 1. CURRENCY CONVERSION & DECIMAL SAFETY ---
  test("Currency: Decimal safe rounding", () => {
    assert.strictEqual(toDecimalSafe(10.256), 10.26);
    assert.strictEqual(toDecimalSafe(10.254), 10.25);
    assert.strictEqual(toDecimalSafe(0), 0);
  });

  test("Currency: Convert INR to USD with verified exchange rate", () => {
    const res = convertInrToTargetCurrency(8440, "USD");
    assert.strictEqual(res.originalAmount, 8440);
    assert.strictEqual(res.originalCurrency, "INR");
    assert.strictEqual(res.targetCurrency, "USD");
    assert.strictEqual(res.convertedAmount, 100); // 8440 / 84.40 = 100
    assert.strictEqual(res.exchangeRate, 84.40);
    assert.ok(res.rateTimestamp, "Should have timestamp");
    assert.ok(res.rateSource, "Should have verified source attribution");
  });

  await testAsync("Currency: Verified rate fetcher with source attribution", async () => {
    const rateInfo = await getVerifiedExchangeRate("USD");
    assert.ok(rateInfo.rate > 0, "Rate must be positive");
    assert.ok(rateInfo.timestamp, "Must have timestamp");
    assert.ok(rateInfo.source, "Must have identifiable source");
    assert.strictEqual(rateInfo.verified, true);
  });

  test("Currency: Convert Target back to INR", () => {
    const inr = convertTargetCurrencyToInr(100, "USD");
    assert.strictEqual(inr, 8440);
  });

  test("Currency: Reject unsupported currency", () => {
    assert.throws(
      () => convertInrToTargetCurrency(1000, "XYZ"),
      /Unsupported/
    );
  });

  // --- 2. PAYMENT STORE & DUPLICATE PROTECTION ---
  await testAsync("Store: Save and retrieve transaction", async () => {
    const tripId = "test_trip_1";
    const tx: PaymentTransaction = {
      id: "tx_test_1",
      tripId,
      paypalOrderId: "ord_paypal_1001",
      paypalCaptureId: "cap_paypal_2001",
      amount: 50.0,
      currency: "USD",
      originalAmount: 4220,
      originalCurrency: "INR",
      paymentType: "partial",
      status: "COMPLETED",
      contributorName: "Alice",
      createdAt: new Date().toISOString(),
      capturedAt: new Date().toISOString(),
    };

    await saveTransaction(tx);
    const byOrder = await getTransactionByOrderId("ord_paypal_1001");
    assert.ok(byOrder, "Transaction should be found by order ID");
    assert.strictEqual(byOrder.id, "tx_test_1");

    const byCapture = await getTransactionByCaptureId("cap_paypal_2001");
    assert.ok(byCapture, "Transaction should be found by capture ID");
    assert.strictEqual(byCapture.amount, 50.0);
  });

  await testAsync("Store: Enforce unique constraint on Order ID (Scenario 6)", async () => {
    const dupTx: PaymentTransaction = {
      id: "tx_test_2",
      tripId: "test_trip_1",
      paypalOrderId: "ord_paypal_1001", // Duplicate order ID
      paypalCaptureId: "cap_paypal_2002",
      amount: 25.0,
      currency: "USD",
      originalAmount: 2110,
      originalCurrency: "INR",
      paymentType: "partial",
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      capturedAt: new Date().toISOString(),
    };

    await assert.rejects(
      async () => saveTransaction(dupTx),
      /Duplicate transaction: PayPal Order ID/
    );
  });

  await testAsync("Store: Enforce unique constraint on Capture ID", async () => {
    const dupCapTx: PaymentTransaction = {
      id: "tx_test_3",
      tripId: "test_trip_1",
      paypalOrderId: "ord_paypal_1003",
      paypalCaptureId: "cap_paypal_2001", // Duplicate capture ID
      amount: 15.0,
      currency: "USD",
      originalAmount: 1266,
      originalCurrency: "INR",
      paymentType: "partial",
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      capturedAt: new Date().toISOString(),
    };

    await assert.rejects(
      async () => saveTransaction(dupCapTx),
      /Duplicate transaction: PayPal Capture ID/
    );
  });

  // --- 3. SCENARIOS: FULL & PARTIAL PAYMENTS WITH LEDGER RECONCILIATION ---
  await testAsync("Scenario 1, 2, 3: Ledger-reconciled balance calculation", async () => {
    const tripId = "trip_balance_calc";
    const totalCost = 40000;

    // Initial summary
    let summary: TripPaymentSummary = {
      tripId,
      totalTripCost: totalCost,
      totalPaid: 0,
      remainingBalance: totalCost,
      currency: "INR",
      contributorCount: 4,
      updatedAt: new Date().toISOString(),
    };
    await savePaymentSummary(summary);

    // Record partial payment 1 via transaction ledger (10,000 INR)
    await saveTransaction({
      id: "tx_ledger_1",
      tripId,
      paypalOrderId: "ord_led_1",
      paypalCaptureId: "cap_led_1",
      amount: 118.48,
      currency: "USD",
      originalAmount: 10000,
      originalCurrency: "INR",
      paymentType: "partial",
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      capturedAt: new Date().toISOString(),
    });

    let current = await getPaymentSummary(tripId);
    assert.ok(current);
    assert.strictEqual(current.totalPaid, 10000);
    assert.strictEqual(current.remainingBalance, 30000);

    // Record partial payment 2 via transaction ledger (15,000 INR)
    await saveTransaction({
      id: "tx_ledger_2",
      tripId,
      paypalOrderId: "ord_led_2",
      paypalCaptureId: "cap_led_2",
      amount: 177.72,
      currency: "USD",
      originalAmount: 15000,
      originalCurrency: "INR",
      paymentType: "partial",
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      capturedAt: new Date().toISOString(),
    });

    current = await getPaymentSummary(tripId);
    assert.ok(current);
    assert.strictEqual(current.totalPaid, 25000);
    assert.strictEqual(current.remainingBalance, 15000);

    // Record final payment (15,000 INR)
    await saveTransaction({
      id: "tx_ledger_3",
      tripId,
      paypalOrderId: "ord_led_3",
      paypalCaptureId: "cap_led_3",
      amount: 177.72,
      currency: "USD",
      originalAmount: 15000,
      originalCurrency: "INR",
      paymentType: "full",
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      capturedAt: new Date().toISOString(),
    });

    current = await getPaymentSummary(tripId);
    assert.ok(current);
    assert.strictEqual(current.totalPaid, 40000);
    assert.strictEqual(current.remainingBalance, 0);
  });

  // --- 4. OWNERSHIP & SECURITY ENFORCEMENT ---
  await testAsync("Security: Trip access key generation and verification", async () => {
    const tripId = "trip_ownership_test";
    const key = await getOrCreateTripAccessKey(tripId);
    assert.ok(key && key.length >= 16, "Access key must be a secure token");

    const valid = await verifyTripAccess(tripId, key);
    assert.strictEqual(valid, true, "Valid key must pass");

    const invalid = await verifyTripAccess(tripId, "wrong_token_12345");
    assert.strictEqual(invalid, false, "Invalid key must fail");

    const empty = await verifyTripAccess(tripId, "");
    assert.strictEqual(empty, false, "Empty key must fail");
  });

  await testAsync("Security: Order-Trip binding enforcement", async () => {
    await bindOrderToTrip("ord_secure_555", "trip_alpha");
    const bound = await getOrderTripId("ord_secure_555");
    assert.strictEqual(bound, "trip_alpha");

    const unbound = await getOrderTripId("ord_unknown");
    assert.strictEqual(unbound, null);
  });

  await testAsync("Security: Authoritative plan storage and retrieval", async () => {
    const sample = generateSamplePlan({
      destination: "Paris, France",
      days: 3,
      travelers: 2,
      group: "Couple",
      budget: 85000,
      diet: "Non-vegetarian",
      language: "English",
    });

    await savePlan(sample);
    const retrieved = await getPlan(sample.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.destination, "Paris, France");
  });

  // --- 5. GROUP CONTRIBUTION MANAGEMENT ---
  await testAsync("Group: Initialize and track equal split", async () => {
    const tripId = "group_trip_test";
    const totalCost = 40000;
    const travelers = 4;
    const perPerson = totalCost / travelers; // 10,000

    const list: GroupContribution[] = Array.from({ length: travelers }).map((_, i) => ({
      id: `c_${i}`,
      tripId,
      name: i === 0 ? "Organizer" : `Traveler ${i + 1}`,
      targetAmount: perPerson,
      paidAmount: 0,
      status: "unpaid" as const,
    }));

    await saveGroupContributions(tripId, list);
    let contribs = await getGroupContributions(tripId);
    assert.strictEqual(contribs.length, 4);
    assert.strictEqual(contribs[0].targetAmount, 10000);

    // Traveler 1 pays full
    contribs[0].paidAmount = 10000;
    contribs[0].status = "completed";

    // Traveler 2 pays partial
    contribs[1].paidAmount = 5000;
    contribs[1].status = "partial";

    await saveGroupContributions(tripId, contribs);
    const updated = await getGroupContributions(tripId);
    assert.strictEqual(updated[0].status, "completed");
    assert.strictEqual(updated[1].status, "partial");
    assert.strictEqual(updated[2].status, "unpaid");
  });

  // --- 6. REGRESSION CHECK: CORE APPLICATION MODULES ---
  test("Regression: Sample plan generation", () => {
    const plan = generateSamplePlan({
      destination: "Jaipur, India",
      days: 3,
      travelers: 2,
      group: "Friends",
      budget: 35000,
      diet: "Vegetarian",
      language: "English",
    });

    assert.ok(plan.id, "Plan must have id");
    assert.strictEqual(plan.destination, "Jaipur, India");
    assert.strictEqual(plan.days.length, 3);
    assert.ok(plan.hotel, "Plan must have hotel");
    assert.ok(plan.days[0].activities.length > 0, "Plan must have activities");
  });

  test("Regression: Budget calculation logic", () => {
    const plan = generateSamplePlan({
      destination: "Jaipur, India",
      days: 3,
      travelers: 2,
      group: "Friends",
      budget: 35000,
      diet: "Vegetarian",
      language: "English",
    });

    const b = budget(plan);
    assert.ok(typeof b.planned === "number" && b.planned > 0);
    assert.ok(typeof b.acc === "number");
    assert.ok(typeof b.transport === "number");
    assert.ok(typeof b.attractions === "number");
    assert.ok(typeof b.food === "number");
    assert.strictEqual(b.planned, b.acc + b.transport + b.food + b.attractions + b.known + b.est);
  });

  test("Regression: Timeline reflow engine", () => {
    const plan = generateSamplePlan({
      destination: "Jaipur, India",
      days: 3,
      travelers: 2,
      group: "Friends",
      budget: 35000,
      diet: "Vegetarian",
      language: "English",
    });

    const result = reflow(plan.days[0], 0);
    assert.ok(result.day, "Reflow must return updated day");
    assert.ok(Array.isArray(result.warnings));
    assert.ok(Array.isArray(result.conflicts));
  });

  test("Regression: Copilot adjustment engine", () => {
    const plan = generateSamplePlan({
      destination: "Jaipur, India",
      days: 3,
      travelers: 2,
      group: "Friends",
      budget: 35000,
      diet: "Vegetarian",
      language: "English",
    });

    const res = applyCopilot(plan, 0, "It is raining outside");
    assert.ok(res.plan, "Copilot must return updated plan");
    assert.ok(Array.isArray(res.changes));
  });

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
