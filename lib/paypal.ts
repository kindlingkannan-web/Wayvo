import { getConfiguredCurrency } from "./currency";
import type { PayPalConfig } from "./paymentTypes";

/**
 * Server-side PayPal REST API Client
 * Using official PayPal Orders v2 API & OAuth 2.0
 *
 * Documentation: https://developer.paypal.com/docs/api/orders/v2/
 */

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cachedAccessToken: CachedToken | null = null;

export function getPayPalBaseUrl(): string {
  const mode = (process.env.PAYPAL_MODE || "sandbox").toLowerCase();
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function isPayPalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function getPublicPayPalConfig(): PayPalConfig {
  const mode = (process.env.PAYPAL_MODE || "sandbox").toLowerCase() === "live" ? "live" : "sandbox";
  return {
    clientId: process.env.PAYPAL_CLIENT_ID || "",
    currency: getConfiguredCurrency(),
    mode,
    configured: isPayPalConfigured(),
  };
}

/**
 * Obtain an OAuth 2.0 access token using server credentials with in-memory caching.
 */
export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal API credentials missing. Please configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET."
    );
  }

  // Check cached token (refresh 60 seconds before expiration)
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60000) {
    return cachedAccessToken.accessToken;
  }

  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const baseUrl = getPayPalBaseUrl();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      console.error("PayPal OAuth failure:", res.status, errText);
      throw new Error(`PayPal authentication failed: ${res.statusText}`);
    }

    const data = await res.json();
    const expiresInSec = Number(data.expires_in) || 3600;

    cachedAccessToken = {
      accessToken: data.access_token,
      expiresAt: now + expiresInSec * 1000,
    };

    return cachedAccessToken.accessToken;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("PayPal authentication timed out after 15 seconds.");
    }
    throw err;
  }
}

export interface CreateOrderParams {
  tripId: string;
  amount: number; // in PayPal transaction currency (e.g. 50.00 USD)
  currency: string; // e.g. "USD"
  description: string;
  customId?: string;
  idempotencyKey?: string;
}

/**
 * Create a PayPal Order with intent = CAPTURE
 */
export async function createPayPalOrder(params: CreateOrderParams): Promise<{
  orderId: string;
  status: string;
}> {
  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  if (params.idempotencyKey) {
    headers["PayPal-Request-Id"] = params.idempotencyKey;
  }

  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: params.tripId,
        custom_id: params.customId || params.tripId,
        description: params.description.substring(0, 127),
        amount: {
          currency_code: params.currency.toUpperCase(),
          value: params.amount.toFixed(2),
        },
      },
    ],
    application_context: {
      brand_name: "Wayvo AI Travel",
      user_action: "PAY_NOW",
      shipping_preference: "NO_SHIPPING",
    },
  };

  try {
    const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error("PayPal Create Order error response:", errBody);
      throw new Error(
        errBody.message ||
          errBody.error_description ||
          `PayPal failed to create order: ${res.statusText}`
      );
    }

    const orderData = await res.json();
    return {
      orderId: orderData.id,
      status: orderData.status,
    };
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("PayPal order creation timed out after 20 seconds.");
    }
    throw err;
  }
}

/**
 * Capture payment for an approved PayPal order
 */
export async function capturePayPalOrder(orderId: string, idempotencyKey?: string): Promise<{
  captureId: string | null;
  status: string;
  amount: number;
  currency: string;
  referenceId?: string;
  customId?: string;
  payerEmail?: string;
  payerName?: string;
}> {
  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  if (idempotencyKey) {
    headers["PayPal-Request-Id"] = idempotencyKey;
  }

  try {
    const res = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Check if order was already captured (status 422 with ORDER_ALREADY_CAPTURED)
      if (
        res.status === 422 &&
        data.details?.some((d: any) => d.issue === "ORDER_ALREADY_CAPTURED")
      ) {
        // Fetch order details to retrieve capture record
        return await getPayPalOrderDetails(orderId);
      }

      console.error("PayPal Capture error:", data);
      throw new Error(
        data.message ||
          data.error_description ||
          `PayPal capture failed with status: ${res.status}`
      );
    }

    const purchaseUnit = data.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];

    const captureId = capture?.id || null;
    const captureStatus = capture?.status || data.status;
    const amountVal = capture?.amount?.value ? parseFloat(capture.amount.value) : 0;
    const currencyVal = capture?.amount?.currency_code || getConfiguredCurrency();

    const payer = data.payer;
    const payerEmail = payer?.email_address;
    const payerName = payer?.name
      ? `${payer.name.given_name || ""} ${payer.name.surname || ""}`.trim()
      : undefined;

    return {
      captureId,
      status: captureStatus,
      amount: amountVal,
      currency: currencyVal,
      referenceId: purchaseUnit?.reference_id,
      customId: purchaseUnit?.custom_id,
      payerEmail,
      payerName,
    };
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("PayPal payment capture timed out after 25 seconds.");
    }
    throw err;
  }
}

/**
 * Retrieve PayPal Order details to verify status and captures
 */
export async function getPayPalOrderDetails(orderId: string): Promise<{
  captureId: string | null;
  status: string;
  amount: number;
  currency: string;
  referenceId?: string;
  customId?: string;
  payerEmail?: string;
  payerName?: string;
}> {
  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const res = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to retrieve PayPal order details: ${res.statusText}`);
  }

  const data = await res.json();
  const purchaseUnit = data.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];

  const captureId = capture?.id || null;
  const status = capture?.status || data.status;
  const amountVal = capture?.amount?.value
    ? parseFloat(capture.amount.value)
    : purchaseUnit?.amount?.value
    ? parseFloat(purchaseUnit.amount.value)
    : 0;
  const currencyVal =
    capture?.amount?.currency_code ||
    purchaseUnit?.amount?.currency_code ||
    getConfiguredCurrency();

  const payer = data.payer;
  const payerEmail = payer?.email_address;
  const payerName = payer?.name
    ? `${payer.name.given_name || ""} ${payer.name.surname || ""}`.trim()
    : undefined;

  return {
    captureId,
    status,
    amount: amountVal,
    currency: currencyVal,
    referenceId: purchaseUnit?.reference_id,
    customId: purchaseUnit?.custom_id,
    payerEmail,
    payerName,
  };
}
