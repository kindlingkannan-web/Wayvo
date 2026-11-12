import type {
  PaymentTransaction,
  TripPaymentSummary,
  GroupContribution,
} from "./paymentTypes";
import type { Plan } from "./types";
import crypto from "node:crypto";

/**
 * Storage adapter for Wayvo Payment transactions and Trip summaries.
 *
 * Persistence Strategy:
 * 1. Production on Vercel: Supports Vercel KV / Upstash Redis REST API
 *    using standard environment variables:
 *    - KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)
 *    Zero npm package dependencies needed; communicates directly over HTTPS REST.
 * 2. Critical Safety Rule: If running in production (or PAYPAL_MODE=live),
 *    missing Upstash credentials will throw an error to prevent silent in-memory data loss.
 * 3. Local / Development / Testing fallback: Resilient server-side storage
 *    with thread-safe unique constraint protection for PayPal Order IDs and Capture IDs.
 */

// In-process fallback store for local development / testing
const memoryStore = {
  transactions: new Map<string, PaymentTransaction>(), // key: id
  orderIdIndex: new Map<string, string>(), // key: paypalOrderId -> tx.id
  captureIdIndex: new Map<string, string>(), // key: paypalCaptureId -> tx.id
  orderTripMap: new Map<string, string>(), // key: paypalOrderId -> tripId
  summaries: new Map<string, TripPaymentSummary>(), // key: tripId
  contributions: new Map<string, GroupContribution[]>(), // key: tripId
  plans: new Map<string, Plan>(), // key: tripId
  accessKeys: new Map<string, string>(), // key: tripId -> accessKey
};

interface KVConfig {
  url: string;
  token: string;
}

function getKVConfig(): KVConfig | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return { url, token };
  }
  return null;
}

/**
 * Safety check: If in production, verify persistent storage is configured.
 */
function assertStorageConfigured(): void {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    (process.env.PAYPAL_MODE || "").toLowerCase() === "live";

  if (isProduction && !getKVConfig()) {
    throw new Error(
      "Persistent payment storage (KV_REST_API_URL / UPSTASH_REDIS_REST_URL) is required in production. In-memory storage is disabled for live payment safety."
    );
  }
}

/**
 * Execute Upstash Redis command via standard JSON POST array format.
 * This guarantees that JSON strings and special characters are never corrupted by URL-encoding.
 */
async function kvCommand<T>(command: string, ...args: (string | number)[]): Promise<T | null> {
  const cfg = getKVConfig();
  if (!cfg) {
    assertStorageConfigured();
    return null;
  }

  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([command, ...args]),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`KV Error: ${res.status} ${res.statusText} - ${errText}`);
      throw new Error(`Upstash Storage Error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    if (json.error) {
      throw new Error(`Upstash Command Error: ${json.error}`);
    }
    return json.result as T;
  } catch (err: any) {
    console.error("KV fetch execution error:", err.message);
    throw err;
  }
}

/**
 * Generate or get a secure trip access key for ownership validation.
 */
export async function getOrCreateTripAccessKey(tripId: string): Promise<string> {
  const kv = getKVConfig();

  if (kv) {
    let key = await kvCommand<string>("GET", `access_key:${tripId}`);
    if (!key) {
      key = crypto.randomBytes(16).toString("hex");
      await kvCommand("SET", `access_key:${tripId}`, key);
    }
    return key;
  }

  assertStorageConfigured();
  let key = memoryStore.accessKeys.get(tripId);
  if (!key) {
    key = crypto.randomBytes(16).toString("hex");
    memoryStore.accessKeys.set(tripId, key);
  }
  return key;
}

/**
 * Verify whether the provided accessKey has ownership of the tripId.
 */
export async function verifyTripAccess(tripId: string, providedKey?: string | null): Promise<boolean> {
  if (!providedKey) return false;
  const expectedKey = await getOrCreateTripAccessKey(tripId);
  // Constant-time comparison to prevent timing attacks
  try {
    const a = Buffer.from(providedKey);
    const b = Buffer.from(expectedKey);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Bind a PayPal Order ID to a specific Trip ID to prevent cross-trip order manipulation.
 */
export async function bindOrderToTrip(orderId: string, tripId: string): Promise<void> {
  const kv = getKVConfig();
  if (kv) {
    await kvCommand("SET", `order_trip:${orderId}`, tripId);
    return;
  }
  assertStorageConfigured();
  memoryStore.orderTripMap.set(orderId, tripId);
}

/**
 * Get the Trip ID bound to a PayPal Order ID.
 */
export async function getOrderTripId(orderId: string): Promise<string | null> {
  const kv = getKVConfig();
  if (kv) {
    return await kvCommand<string>("GET", `order_trip:${orderId}`);
  }
  assertStorageConfigured();
  return memoryStore.orderTripMap.get(orderId) || null;
}

/**
 * Save an authoritative plan to persistent storage.
 */
export async function savePlan(plan: Plan): Promise<Plan> {
  const kv = getKVConfig();
  if (kv) {
    await kvCommand("SET", `plan:${plan.id}`, JSON.stringify(plan));
    return plan;
  }
  assertStorageConfigured();
  memoryStore.plans.set(plan.id, plan);
  return plan;
}

/**
 * Retrieve an authoritative plan from persistent storage.
 */
export async function getPlan(tripId: string): Promise<Plan | null> {
  const kv = getKVConfig();
  if (kv) {
    const raw = await kvCommand<string>("GET", `plan:${tripId}`);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }
  assertStorageConfigured();
  return memoryStore.plans.get(tripId) || null;
}

/**
 * Save or update a PaymentTransaction.
 * Enforces unique constraints on paypalOrderId and paypalCaptureId.
 */
export async function saveTransaction(tx: PaymentTransaction): Promise<PaymentTransaction> {
  const kv = getKVConfig();

  if (kv) {
    // 1. Check uniqueness of orderId
    const existingTxId = await kvCommand<string>("GET", `order_idx:${tx.paypalOrderId}`);
    if (existingTxId && existingTxId !== tx.id) {
      throw new Error(`Duplicate transaction: PayPal Order ID '${tx.paypalOrderId}' is already recorded.`);
    }

    // 2. Check uniqueness of captureId if present
    if (tx.paypalCaptureId) {
      const existingCapTxId = await kvCommand<string>("GET", `capture_idx:${tx.paypalCaptureId}`);
      if (existingCapTxId && existingCapTxId !== tx.id) {
        throw new Error(`Duplicate transaction: PayPal Capture ID '${tx.paypalCaptureId}' is already recorded.`);
      }
    }

    // Store transaction object
    await kvCommand("SET", `tx:${tx.id}`, JSON.stringify(tx));
    // Index by order ID
    await kvCommand("SET", `order_idx:${tx.paypalOrderId}`, tx.id);
    if (tx.paypalCaptureId) {
      await kvCommand("SET", `capture_idx:${tx.paypalCaptureId}`, tx.id);
    }

    // Append to trip's transaction list
    const tripTxList = (await kvCommand<string[]>("LRANGE", `trip_txs:${tx.tripId}`, 0, -1)) || [];
    if (!tripTxList.includes(tx.id)) {
      await kvCommand("RPUSH", `trip_txs:${tx.tripId}`, tx.id);
    }

    return tx;
  }

  assertStorageConfigured();

  // Memory fallback with duplicate protection
  const existingId = memoryStore.orderIdIndex.get(tx.paypalOrderId);
  if (existingId && existingId !== tx.id) {
    throw new Error(`Duplicate transaction: PayPal Order ID '${tx.paypalOrderId}' is already recorded.`);
  }

  if (tx.paypalCaptureId) {
    const existingCap = memoryStore.captureIdIndex.get(tx.paypalCaptureId);
    if (existingCap && existingCap !== tx.id) {
      throw new Error(`Duplicate transaction: PayPal Capture ID '${tx.paypalCaptureId}' is already recorded.`);
    }
    memoryStore.captureIdIndex.set(tx.paypalCaptureId, tx.id);
  }

  memoryStore.transactions.set(tx.id, tx);
  memoryStore.orderIdIndex.set(tx.paypalOrderId, tx.id);
  return tx;
}

/**
 * Look up a transaction by PayPal Order ID
 */
export async function getTransactionByOrderId(orderId: string): Promise<PaymentTransaction | null> {
  const kv = getKVConfig();

  if (kv) {
    const txId = await kvCommand<string>("GET", `order_idx:${orderId}`);
    if (!txId) return null;
    const raw = await kvCommand<string>("GET", `tx:${txId}`);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }

  assertStorageConfigured();
  const txId = memoryStore.orderIdIndex.get(orderId);
  if (!txId) return null;
  return memoryStore.transactions.get(txId) || null;
}

/**
 * Look up a transaction by PayPal Capture ID
 */
export async function getTransactionByCaptureId(captureId: string): Promise<PaymentTransaction | null> {
  const kv = getKVConfig();

  if (kv) {
    const txId = await kvCommand<string>("GET", `capture_idx:${captureId}`);
    if (!txId) return null;
    const raw = await kvCommand<string>("GET", `tx:${txId}`);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }

  assertStorageConfigured();
  const txId = memoryStore.captureIdIndex.get(captureId);
  if (!txId) return null;
  return memoryStore.transactions.get(txId) || null;
}

/**
 * Retrieve all transactions for a specific trip
 */
export async function getTransactionsByTripId(tripId: string): Promise<PaymentTransaction[]> {
  const kv = getKVConfig();

  if (kv) {
    const txIds = (await kvCommand<string[]>("LRANGE", `trip_txs:${tripId}`, 0, -1)) || [];
    const results: PaymentTransaction[] = [];
    for (const id of txIds) {
      const raw = await kvCommand<string>("GET", `tx:${id}`);
      if (raw) {
        results.push(typeof raw === "string" ? JSON.parse(raw) : raw);
      }
    }
    // Return newest first
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  assertStorageConfigured();
  const list = Array.from(memoryStore.transactions.values()).filter((t) => t.tripId === tripId);
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Retrieve the authoritative payment summary for a trip.
 * Computes totalPaid from verified COMPLETED transactions in the ledger to avoid race conditions.
 */
export async function getPaymentSummary(tripId: string): Promise<TripPaymentSummary | null> {
  const kv = getKVConfig();
  let summary: TripPaymentSummary | null = null;

  if (kv) {
    const raw = await kvCommand<string>("GET", `summary:${tripId}`);
    if (raw) {
      summary = typeof raw === "string" ? JSON.parse(raw) : raw;
    }
  } else {
    assertStorageConfigured();
    summary = memoryStore.summaries.get(tripId) || null;
  }

  if (summary) {
    // Reconcile totalPaid from actual transaction ledger
    const txs = await getTransactionsByTripId(tripId);
    const verifiedTotalPaid = txs
      .filter((t) => t.status === "COMPLETED")
      .reduce((sum, t) => sum + t.originalAmount, 0);

    summary.totalPaid = Math.round(verifiedTotalPaid * 100) / 100;
    summary.remainingBalance = Math.max(0, Math.round((summary.totalTripCost - summary.totalPaid) * 100) / 100);
  }

  return summary;
}

/**
 * Save or update the authoritative payment summary for a trip
 */
export async function savePaymentSummary(summary: TripPaymentSummary): Promise<TripPaymentSummary> {
  const kv = getKVConfig();

  if (kv) {
    await kvCommand("SET", `summary:${summary.tripId}`, JSON.stringify(summary));
    return summary;
  }

  assertStorageConfigured();
  memoryStore.summaries.set(summary.tripId, summary);
  return summary;
}

/**
 * Retrieve group contributions for a trip
 */
export async function getGroupContributions(tripId: string): Promise<GroupContribution[]> {
  const kv = getKVConfig();

  if (kv) {
    const raw = await kvCommand<string>("GET", `contributions:${tripId}`);
    if (!raw) return [];
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }

  assertStorageConfigured();
  return memoryStore.contributions.get(tripId) || [];
}

/**
 * Save group contributions for a trip
 */
export async function saveGroupContributions(
  tripId: string,
  contributions: GroupContribution[]
): Promise<GroupContribution[]> {
  const kv = getKVConfig();

  if (kv) {
    await kvCommand("SET", `contributions:${tripId}`, JSON.stringify(contributions));
    return contributions;
  }

  assertStorageConfigured();
  memoryStore.contributions.set(tripId, contributions);
  return contributions;
}
