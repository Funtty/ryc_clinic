import "server-only";
import { env } from "@/lib/env";
import { errors } from "@/lib/server/errors";

// Deposit policy for RYC Dental (appointment deposit model).
// The deposit is a fixed fraction of the service price, rounded up to the
// nearest whole naira. Services without a price ("price on consultation")
// never require an online deposit — the patient simply pays at the clinic.

export const DEPOSIT_FRACTION = 0.2;
export const DEPOSIT_MIN_MAJOR = 1000; // ₦1,000 minimum deposit
export const DEPOSIT_EXPIRY_MS = 60 * 60 * 1000; // unverified deposits expire after 1h
export const DEFAULT_CURRENCY = "NGN";

export function depositAmountMajor(priceMajor: number): number {
  return Math.max(Math.round(priceMajor * DEPOSIT_FRACTION), DEPOSIT_MIN_MAJOR);
}

/**
 * The `simulate` provider echoes "PAID" for almost any reference, so letting
 * it run against a production database lets anyone mark a deposit paid with a
 * forged /api/payments webhook or verify call. It is a development/test tool
 * and must never be the enabled provider outside those environments.
 */
export function assertProviderUsable(providerId: string, nodeEnv: string): void {
  if (providerId === "simulate" && nodeEnv === "production") {
    throw errors.internal(
      "PAYMENT_PROVIDER=simulate is not allowed in production. Configure Paystack.",
    );
  }
}

export function enabledProviderId(): string {
  const providerId = env.PAYMENT_PROVIDER ?? "simulate";
  assertProviderUsable(providerId, env.NODE_ENV);
  return providerId;
}