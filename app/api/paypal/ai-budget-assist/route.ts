import { NextResponse } from "next/server";
import { claude } from "@/lib/ai";
import { budget } from "@/lib/engine";
import type { Plan } from "@/lib/types";
import {
  getPaymentSummary,
  getTransactionsByTripId,
  getGroupContributions,
  verifyTripAccess,
} from "@/lib/paymentStore";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tripId, question, planData } = body;
    const accessKey = req.headers.get("x-trip-access-key") || body.tripAccessKey;

    if (!tripId || !question) {
      return NextResponse.json(
        { error: "Missing 'tripId' or 'question'" },
        { status: 400 }
      );
    }

    if (accessKey) {
      const isValid = await verifyTripAccess(tripId, accessKey);
      if (!isValid) {
        return NextResponse.json({ error: "Unauthorized trip access" }, { status: 403 });
      }
    }

    if (!planData || !planData.days) {
      return NextResponse.json(
        { error: "Plan data is required for budget context" },
        { status: 400 }
      );
    }

    // 1. Authoritative deterministic calculations
    const b = budget(planData as Plan);
    const summary = (await getPaymentSummary(tripId)) || {
      tripId,
      totalTripCost: Math.round(b.planned),
      totalPaid: 0,
      remainingBalance: Math.round(b.planned),
      currency: "INR",
      contributorCount: planData.travelers || 1,
      updatedAt: new Date().toISOString(),
    };

    const transactions = await getTransactionsByTripId(tripId);
    const contributions = await getGroupContributions(tripId);

    // Identify flexible activities (Priority 2 or 3) that could be altered/removed to save money
    const flexibleSavings: { name: string; priority: number; potentialSaving: number }[] = [];
    planData.days.forEach((d: any) => {
      d.activities.forEach((a: any) => {
        if (a.priority > 1 && a.ticket && a.ticket > 0) {
          flexibleSavings.push({
            name: a.name,
            priority: a.priority,
            potentialSaving: a.ticket * (planData.travelers || 1),
          });
        }
      });
    });

    // 2. Prepare verified deterministic context
    const financialContext = {
      destination: planData.destination,
      durationDays: planData.durationDays || planData.days.length,
      travelers: planData.travelers,
      allocatedBudget: Math.round(planData.budget),
      plannedSpending: Math.round(b.planned),
      totalPaidThroughPayPal: Math.round(summary.totalPaid),
      unpaidRemainingBalance: Math.round(summary.remainingBalance),
      verifiedTransactionsCount: transactions.length,
      transactions: transactions.map((t) => ({
        id: t.id,
        amountInInr: Math.round(t.originalAmount),
        amountInPayPal: `${t.amount} ${t.currency}`,
        payer: t.contributorName || t.payerName || "Traveler",
        status: t.status,
        date: t.capturedAt || t.createdAt,
      })),
      groupContributions: contributions.map((c) => ({
        name: c.name,
        target: Math.round(c.targetAmount),
        paid: Math.round(c.paidAmount),
        remaining: Math.max(0, Math.round(c.targetAmount - c.paidAmount)),
        status: c.status,
      })),
      flexiblePotentialCuts: flexibleSavings.slice(0, 5),
    };

    const systemPrompt = `You are Wayvo's Financial Co-Pilot and AI Budget Assistant for the PayPal AI Hackathon.
You analyze real-time trip budgeting, PayPal funding, and group contributions.
CRITICAL RULES:
1. All financial numbers must be derived STRICTLY from the provided verified Financial Context. NEVER invent payments, amounts, or balances.
2. AI NEVER initiates payments or alters records.
3. Be concise, actionable, and friendly. Use ₹ (INR) as the primary currency and reference PayPal contributions where relevant.
4. If asked how to reduce remaining budget, point to specific flexible Priority 2 or 3 activities with their exact saving amounts.`;

    const userPrompt = `Financial Context:
${JSON.stringify(financialContext, null, 2)}

Traveler Question:
"${question}"

Provide a clear, helpful financial explanation:`;

    let reply: string | null = null;

    if (process.env.ANTHROPIC_API_KEY) {
      reply = await claude(systemPrompt, userPrompt, 1000);
    }

    // Deterministic fallback if Claude API key is absent or unreachable
    if (!reply) {
      const q = question.toLowerCase();
      const inrStr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

      if (q.includes("paid") || q.includes("remain") || q.includes("balance") || q.includes("left")) {
        reply = `You have paid a total of ${inrStr(
          summary.totalPaid
        )} via PayPal out of the estimated trip cost of ${inrStr(
          summary.totalTripCost
        )}. Your remaining unpaid balance is ${inrStr(summary.remainingBalance)}.`;

        if (summary.remainingBalance === 0) {
          reply += " 🎉 Your trip is fully funded!";
        } else if (flexibleSavings.length > 0) {
          reply += ` To reduce this balance, you could consider adjusting flexible stops like "${flexibleSavings[0].name}" (saving ~${inrStr(
            flexibleSavings[0].potentialSaving
          )}).`;
        }
      } else if (q.includes("group") || q.includes("contribut") || q.includes("who")) {
        const completed = contributions.filter((c) => c.status === "completed").length;
        const totalPeople = Math.max(contributions.length, planData.travelers || 1);
        reply = `Group Status: ${completed} of ${totalPeople} travelers have completed their suggested contribution. Total collected so far is ${inrStr(
          summary.totalPaid
        )}, leaving ${inrStr(summary.remainingBalance)} remaining across the group.`;
      } else if (q.includes("reduce") || q.includes("cut") || q.includes("save")) {
        if (flexibleSavings.length > 0) {
          const suggestions = flexibleSavings
            .slice(0, 3)
            .map((s) => `• ${s.name}: saves ${inrStr(s.potentialSaving)}`)
            .join("\n");
          reply = `Here are flexible attractions you can adjust or skip in the itinerary to lower your remaining cost:\n${suggestions}\nTotal potential savings: ${inrStr(
            flexibleSavings.slice(0, 3).reduce((acc, s) => acc + s.potentialSaving, 0)
          )}.`;
        } else {
          reply = `Your itinerary is currently optimized. Total planned expenses are ${inrStr(
            summary.totalTripCost
          )} and remaining balance is ${inrStr(summary.remainingBalance)}.`;
        }
      } else {
        reply = `Current Trip Financial Status:\n• Estimated Cost: ${inrStr(
          summary.totalTripCost
        )}\n• Paid via PayPal: ${inrStr(
          summary.totalPaid
        )}\n• Remaining Balance: ${inrStr(
          summary.remainingBalance
        )}\nFeel free to ask about specific savings, group splits, or remaining payments!`;
      }
    }

    return NextResponse.json({
      reply,
      summary,
      context: financialContext,
    });
  } catch (err: any) {
    console.error("AI budget assist error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate budget assistance" },
      { status: 500 }
    );
  }
}
