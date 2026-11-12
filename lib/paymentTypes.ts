export type PayPalMode = "sandbox" | "live";

export type PaymentStatus = "COMPLETED" | "PENDING" | "FAILED" | "CANCELLED";

export type PaymentType = "full" | "partial";

export interface PaymentTransaction {
  id: string;
  tripId: string;
  paypalOrderId: string;
  paypalCaptureId: string | null;
  amount: number; // in transaction currency (e.g. USD)
  currency: string;
  originalAmount: number; // in trip display currency (e.g. INR)
  originalCurrency: string;
  exchangeRate?: number;
  paymentType: PaymentType;
  status: PaymentStatus;
  contributorName?: string;
  payerEmail?: string;
  payerName?: string;
  createdAt: string; // ISO string
  capturedAt: string | null; // ISO string
}

export interface TripPaymentSummary {
  tripId: string;
  totalTripCost: number; // in trip currency (e.g. INR)
  totalPaid: number; // in trip currency (e.g. INR)
  remainingBalance: number; // in trip currency (e.g. INR)
  currency: string;
  contributorCount: number;
  updatedAt: string; // ISO string
}

export interface GroupContribution {
  id: string;
  tripId: string;
  name: string;
  targetAmount: number; // in trip currency
  paidAmount: number; // in trip currency
  status: "unpaid" | "partial" | "completed";
  lastPaymentAt?: string;
}

export interface PayPalConfig {
  clientId: string;
  currency: string;
  mode: PayPalMode;
  configured: boolean;
}

export interface CreateOrderRequest {
  tripId: string;
  requestedAmount: number; // In trip currency (e.g. INR)
  paymentType: PaymentType;
  contributorName?: string;
  planData?: any; // Authoritative plan for budget recalculation
}

export interface CaptureOrderRequest {
  orderId: string;
  tripId: string;
}

export interface AIBudgetAssistRequest {
  tripId: string;
  question: string;
  planData: any;
}
