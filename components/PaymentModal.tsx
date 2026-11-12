"use client";
import React, { useState, useEffect, useRef } from "react";
import type { Plan } from "@/lib/types";
import type { PaymentTransaction, TripPaymentSummary, PayPalConfig } from "@/lib/paymentTypes";
import { convertInrToTargetCurrency, formatCurrency } from "@/lib/currency";

interface PaymentModalProps {
  plan: Plan;
  summary: TripPaymentSummary;
  initialContributor?: string;
  initialAmount?: number;
  onClose: () => void;
  onPaymentSuccess: (summary: TripPaymentSummary, tx: PaymentTransaction) => void;
}

const inr = (n: number | null) => (n == null ? "—" : "₹" + Math.round(n).toLocaleString("en-IN"));

declare global {
  interface Window {
    paypal?: any;
  }
}

export function PaymentModal({
  plan,
  summary,
  initialContributor,
  initialAmount,
  onClose,
  onPaymentSuccess,
}: PaymentModalProps) {
  const [paymentType, setPaymentType] = useState<"full" | "partial">(
    initialAmount && initialAmount < summary.remainingBalance ? "partial" : "full"
  );
  const [customAmountInr, setCustomAmountInr] = useState<string>(
    initialAmount ? String(Math.round(initialAmount)) : String(Math.round(summary.remainingBalance))
  );
  const [contributorName, setContributorName] = useState<string>(initialContributor || "Organizer (You)");

  const [config, setConfig] = useState<PayPalConfig | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [processingState, setProcessingState] = useState<
    "idle" | "creating_order" | "awaiting_approval" | "verifying" | "success" | "cancelled" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successTx, setSuccessTx] = useState<PaymentTransaction | null>(null);

  const buttonsContainerRef = useRef<HTMLDivElement>(null);
  const renderedButtonsRef = useRef<any>(null);

  // Compute selected amount in INR
  const selectedAmountInr =
    paymentType === "full" ? summary.remainingBalance : Math.max(0, Number(customAmountInr) || 0);

  // Currency conversion calculation for disclosure
  let conversion: ReturnType<typeof convertInrToTargetCurrency> | null = null;
  try {
    if (selectedAmountInr > 0) {
      conversion = convertInrToTargetCurrency(selectedAmountInr, config?.currency || "USD");
    }
  } catch (e: any) {
    // Ignore conversion preview error
  }

  // 1. Fetch PayPal Configuration
  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        const res = await fetch("/api/paypal/config", { cache: "no-store" });
        const data: PayPalConfig = await res.json();
        if (isMounted) {
          setConfig(data);
          setLoadingConfig(false);
        }
      } catch (err) {
        if (isMounted) {
          setLoadingConfig(false);
          setErrorMessage("Failed to load PayPal configuration from server.");
        }
      }
    }
    loadConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Load official PayPal JavaScript SDK
  useEffect(() => {
    if (!config || !config.configured || !config.clientId) return;

    const scriptId = "paypal-sdk-script";
    const expectedSrc = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      config.clientId
    )}&currency=${encodeURIComponent(config.currency)}&intent=capture`;

    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (existingScript) {
      if (existingScript.src === expectedSrc && window.paypal) {
        setSdkLoaded(true);
        return;
      }
      // If client ID or currency changed, replace script
      existingScript.remove();
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = expectedSrc;
    script.async = true;
    script.onload = () => {
      setSdkLoaded(true);
    };
    script.onerror = () => {
      setErrorMessage("Failed to load PayPal JavaScript SDK. Please verify network connectivity.");
    };

    document.head.appendChild(script);
  }, [config]);

  // 3. Render PayPal Buttons when SDK and container are ready
  useEffect(() => {
    if (!sdkLoaded || !window.paypal || !buttonsContainerRef.current) return;
    if (processingState === "success") return;

    // Validate amount
    if (selectedAmountInr <= 0 || selectedAmountInr > summary.remainingBalance) {
      if (buttonsContainerRef.current) {
        buttonsContainerRef.current.innerHTML = "";
      }
      return;
    }

    // Clean previous container buttons
    buttonsContainerRef.current.innerHTML = "";

    try {
      const buttons = window.paypal.Buttons({
        style: {
          layout: "vertical",
          color: "gold",
          shape: "pill",
          label: "pay",
          height: 44,
        },
        createOrder: async () => {
          setProcessingState("creating_order");
          setErrorMessage(null);

          try {
            const tripAccessKey = typeof window !== "undefined" ? sessionStorage.getItem(`trip_key_${plan.id}`) : null;
            const res = await fetch("/api/paypal/create-order", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(tripAccessKey ? { "x-trip-access-key": tripAccessKey } : {}),
              },
              body: JSON.stringify({
                tripId: plan.id,
                tripAccessKey,
                requestedAmount: selectedAmountInr,
                paymentType,
                planData: plan,
                contributorName,
              }),
            });

            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || "Failed to create PayPal order.");
            }

            if (data.tripAccessKey && typeof window !== "undefined") {
              sessionStorage.setItem(`trip_key_${plan.id}`, data.tripAccessKey);
            }

            setProcessingState("awaiting_approval");
            return data.orderId;
          } catch (err: any) {
            setProcessingState("error");
            setErrorMessage(err.message || "Failed to initialize PayPal transaction.");
            throw err;
          }
        },
        onApprove: async (data: { orderId: string }) => {
          setProcessingState("verifying");
          setErrorMessage(null);

          try {
            const tripAccessKey = typeof window !== "undefined" ? sessionStorage.getItem(`trip_key_${plan.id}`) : null;
            const res = await fetch("/api/paypal/capture-order", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(tripAccessKey ? { "x-trip-access-key": tripAccessKey } : {}),
              },
              body: JSON.stringify({
                orderId: data.orderId,
                tripId: plan.id,
                tripAccessKey,
                contributorName,
                paymentType,
              }),
            });

            const captureData = await res.json();
            if (!res.ok || !captureData.success) {
              throw new Error(captureData.error || "Payment verification failed.");
            }

            setProcessingState("success");
            setSuccessTx(captureData.transaction);
            onPaymentSuccess(captureData.summary, captureData.transaction);
          } catch (err: any) {
            setProcessingState("error");
            setErrorMessage(
              err.message || "Payment capture could not be verified by the server. No completed payment was recorded."
            );
          }
        },
        onCancel: () => {
          setProcessingState("cancelled");
        },
        onError: (err: any) => {
          console.error("PayPal component error:", err);
          setProcessingState("error");
          setErrorMessage("An unexpected error occurred during the PayPal checkout session.");
        },
      });

      renderedButtonsRef.current = buttons;
      buttons.render(buttonsContainerRef.current);
    } catch (renderErr: any) {
      console.error("Failed to render PayPal buttons:", renderErr);
    }
  }, [sdkLoaded, selectedAmountInr, paymentType, contributorName, processingState, summary.remainingBalance, plan]);

  const isValidAmount = selectedAmountInr > 0 && selectedAmountInr <= summary.remainingBalance + 0.01;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-darkcard p-6 shadow-2xl ring-1 ring-ink/10 dark:ring-white/10 transition-colors my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-ink/10 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-lagoon px-2.5 py-0.5 text-[10px] font-black uppercase text-white tracking-wider">
                PayPal Checkout
              </span>
              <span className="text-xs font-semibold text-ink/50 dark:text-slate-400">
                {config?.mode === "live" ? "Live Production" : "Sandbox Environment"}
              </span>
            </div>
            <h2 className="text-xl font-black text-ink dark:text-white mt-1">
              Fund Trip · {plan.destination}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-ink/40 dark:text-slate-400 hover:bg-paper dark:hover:bg-darkpaper hover:text-ink dark:hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* SUCCESS STATE */}
        {processingState === "success" && successTx ? (
          <div className="py-6 space-y-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-3xl animate-bounce">
              ✓
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-ink dark:text-white">Payment Verified &amp; Captured!</h3>
              <p className="text-xs text-ink/60 dark:text-slate-300">
                Your payment has been verified by the server and credited towards your trip funding balance.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="rounded-2xl bg-paper dark:bg-darkpaper p-4 text-left text-xs space-y-2">
              <div className="flex justify-between border-b border-ink/10 dark:border-white/10 pb-2">
                <span className="text-ink/60 dark:text-slate-400">Amount Credited:</span>
                <span className="font-extrabold text-ink dark:text-white">{inr(successTx.originalAmount)}</span>
              </div>
              <div className="flex justify-between border-b border-ink/10 dark:border-white/10 pb-2">
                <span className="text-ink/60 dark:text-slate-400">PayPal Charged:</span>
                <span className="font-bold text-lagoon">
                  {formatCurrency(successTx.amount, successTx.currency)}
                </span>
              </div>
              <div className="flex justify-between border-b border-ink/10 dark:border-white/10 pb-2">
                <span className="text-ink/60 dark:text-slate-400">Payer / Contributor:</span>
                <span className="font-semibold text-ink dark:text-white">
                  {successTx.contributorName || successTx.payerName || "Organizer"}
                </span>
              </div>
              <div className="flex justify-between border-b border-ink/10 dark:border-white/10 pb-2">
                <span className="text-ink/60 dark:text-slate-400">Capture ID:</span>
                <span className="font-mono text-[11px] text-ink/80 dark:text-slate-300">
                  {successTx.paypalCaptureId}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-ink/60 dark:text-slate-400">Status:</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                  ● Verified {successTx.status}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="btn !bg-lagoon text-white !rounded-2xl w-full py-2.5 text-xs font-bold"
            >
              Done &amp; View Updated Budget
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            {/* Trip Financial Snapshot */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-paper dark:bg-darkpaper p-3 text-center">
              <div>
                <span className="text-[10px] font-bold uppercase text-ink/50 dark:text-slate-400 block">Total Cost</span>
                <span className="text-sm font-black text-ink dark:text-white block mt-0.5">{inr(summary.totalTripCost)}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-ink/50 dark:text-slate-400 block">Already Paid</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">{inr(summary.totalPaid)}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-ink/50 dark:text-slate-400 block">Remaining</span>
                <span className="text-sm font-black text-lagoon block mt-0.5">{inr(summary.remainingBalance)}</span>
              </div>
            </div>

            {/* Payment Options */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-ink/60 dark:text-slate-400 block">
                Select Payment Amount
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentType("full")}
                  className={`rounded-2xl p-3 text-left border transition ${paymentType === "full"
                      ? "border-lagoon bg-lagoon/10 dark:bg-lagoon/20 ring-1 ring-lagoon"
                      : "border-ink/10 dark:border-white/10 bg-white dark:bg-darkcard hover:bg-paper"
                    }`}
                >
                  <span className="block text-xs font-bold text-ink dark:text-white">Pay Full Balance</span>
                  <span className="block text-sm font-black text-lagoon mt-0.5">
                    {inr(summary.remainingBalance)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentType("partial")}
                  className={`rounded-2xl p-3 text-left border transition ${paymentType === "partial"
                      ? "border-lagoon bg-lagoon/10 dark:bg-lagoon/20 ring-1 ring-lagoon"
                      : "border-ink/10 dark:border-white/10 bg-white dark:bg-darkcard hover:bg-paper"
                    }`}
                >
                  <span className="block text-xs font-bold text-ink dark:text-white">Partial Payment</span>
                  <span className="block text-xs text-ink/50 dark:text-slate-400 mt-0.5">
                    Custom or contribution
                  </span>
                </button>
              </div>

              {/* Partial Amount Input */}
              {paymentType === "partial" && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink dark:text-white">₹</span>
                    <input
                      type="number"
                      min="100"
                      max={summary.remainingBalance}
                      step="100"
                      value={customAmountInr}
                      onChange={(e) => setCustomAmountInr(e.target.value)}
                      placeholder="Enter amount in INR"
                      className="inp flex-1 text-xs font-bold"
                    />
                  </div>
                  {!isValidAmount && (
                    <p className="text-[11px] text-alert font-semibold">
                      Please enter a valid amount between ₹100 and {inr(summary.remainingBalance)}.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Traveler / Contributor Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-ink/60 dark:text-slate-400 block">
                Traveler / Contributor Name
              </label>
              <input
                type="text"
                value={contributorName}
                onChange={(e) => setContributorName(e.target.value)}
                placeholder="e.g. Organizer (You) or Traveler Name"
                className="inp text-xs font-semibold"
              />
            </div>

            {/* Currency Conversion & Exchange Rate Disclosure */}
            {conversion && isValidAmount && (
              <div className="rounded-2xl bg-lagoon/10 dark:bg-lagoon/20 border border-lagoon/30 p-3.5 space-y-1 text-xs">
                <div className="flex items-center justify-between font-bold text-ink dark:text-white">
                  <span>PayPal Charge Amount:</span>
                  <span className="text-sm text-lagoon font-black">
                    {formatCurrency(conversion.convertedAmount, conversion.targetCurrency)}
                  </span>
                </div>
                <p className="text-[11px] text-ink/70 dark:text-slate-300">
                  Converted from {inr(conversion.originalAmount)} at 1 {conversion.targetCurrency} = ₹{conversion.exchangeRate}
                </p>
                <div className="text-[10px] text-ink/50 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-lagoon/20">
                  <span>Reference: {conversion.rateSource}</span>
                  <span>{new Date(conversion.rateTimestamp).toLocaleDateString()}</span>
                </div>
              </div>
            )}

            {/* Processing States */}
            {processingState === "verifying" && (
              <div className="rounded-2xl bg-lagoon/10 border border-lagoon/40 p-3 text-center space-y-1">
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-lagoon">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-lagoon border-t-transparent" />
                  <span>Verifying &amp; Capturing Payment with PayPal...</span>
                </div>
                <p className="text-[11px] text-ink/60">
                  Performing authoritative server-side capture verification.
                </p>
              </div>
            )}

            {processingState === "cancelled" && (
              <div className="rounded-2xl bg-amber/15 border border-amber/40 p-3 text-xs text-ink dark:text-amber-200">
                Payment approval window was cancelled. No charges were made to your PayPal account.
              </div>
            )}

            {errorMessage && (
              <div className="rounded-2xl bg-alert/10 border border-alert p-3 text-xs text-alert font-bold">
                ⚠ {errorMessage}
              </div>
            )}

            {/* PAYPAL BUTTONS CONTAINER OR CONFIG WARNING */}
            <div className="pt-2">
              {loadingConfig ? (
                <div className="flex items-center justify-center p-4 text-xs text-ink/50">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-lagoon border-t-transparent mr-2" />
                  Initializing PayPal Checkout...
                </div>
              ) : !config?.configured ? (
                <div className="rounded-2xl border-2 border-amber bg-amber/10 p-4 text-xs space-y-2">
                  <div className="font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <span>⚙️</span>
                    <span>PayPal Sandbox Configuration Needed</span>
                  </div>
                  <p className="text-ink/80 dark:text-slate-300 leading-relaxed">
                    To test PayPal Checkout in Sandbox mode, please define your Sandbox credentials in <b>.env.local</b> or Vercel:
                  </p>
                  <div className="font-mono text-[10px] bg-white/70 dark:bg-black/40 p-2 rounded-xl text-ink dark:text-slate-200">
                    PAYPAL_CLIENT_ID=&lt;your-sandbox-client-id&gt;<br />
                    PAYPAL_CLIENT_SECRET=&lt;your-sandbox-client-secret&gt;<br />
                    PAYPAL_MODE=sandbox<br />
                    PAYPAL_CURRENCY=USD
                  </div>
                  <p className="text-[10px] text-ink/60 dark:text-slate-400">
                    Get test credentials from the PayPal Developer Portal at <a href="https://developer.paypal.com" target="_blank" rel="noreferrer" className="underline font-bold text-lagoon">developer.paypal.com</a>.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {!isValidAmount ? (
                    <button
                      disabled
                      className="btn !bg-ink/20 text-ink/40 !rounded-2xl w-full py-2.5 text-xs font-bold cursor-not-allowed"
                    >
                      Enter Valid Amount to Enable PayPal
                    </button>
                  ) : (
                    <div>
                      <div ref={buttonsContainerRef} className="min-h-[44px]" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Notice */}
            <p className="text-[10px] text-ink/50 dark:text-slate-400 text-center leading-relaxed">
              Wayvo connects directly to PayPal's official Orders v2 REST API. Charges represent trip funding &amp; budget contribution management.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
