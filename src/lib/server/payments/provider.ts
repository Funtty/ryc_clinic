import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { errors } from "@/lib/server/errors";

// Pluggable payment provider for RYC Dental (NGN).
//
// SECURITY CONTRACT (enforced by engine.ts + tests, never by the browser):
//   - The BROWSER never declares success. The server only transitions a
//     Payment via provider verification or a signature-checked webhook.
//   - We never persist raw card data. We keep an opaque providerRef and
//     non-PHI bookkeeping (amount, currency, status, timestamps). The PCI
//     surface lives entirely upstream with the provider.
//   - `simulate` is the default offline/log-backed provider so tests and dev
//     run without a sandbox account; it just echoes statuses deterministically
//     by providerRef. `paystack` is the production adapter for Nigeria (NGN).

export type PaymentIntentInput = {
  reference: string; // our paymentId, e.g. PAY-<cuid> (PHI-safe, never a card)
  amountCents: number;
  currency: string; // "NGN"
  description: string; // PHI-safe: service + date + reference only
  customerEmail?: string;
};

export type PaymentIntentResult = {
  providerRef: string; // opaque upstream intent/charge id
  /** Hosted checkout URL for real providers, or null for internal flows. */
  checkoutUrl: string | null;
};

export type PaymentVerifyResult = {
  providerStatus: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
  providerEcho: string; // provider verification/webhook echo, stored server-side
};

export interface PaymentProvider {
  readonly id: string;
  initiate(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  verify(providerRef: string): Promise<PaymentVerifyResult>;
  /**
   * Verify a webhook signature. Throws an AppError when the signature does not
   * match the raw body. Providers without signed webhooks (offline simulate)
   * return immediately.
   */
  verifyWebhook?(rawBody: string, signature: string | null): void;
  /**
   * Push a refund through the provider. Providers without an online refund
   * surface (offline simulate) return immediately; a throwing refund aborts
   * the local REFUNDED transition so the record never claims a refund that was
   * not actually issued upstream.
   */
  refund?(providerRef: string): Promise<void>;
}

const PAYSTACK_API = "https://api.paystack.co";

/** HMAC-SHA512 signature used by Paystack webhooks (x-paystack-signature). */
function paystackSignature(rawBody: string): string {
  return createHmac("sha512", paystackSecret()).update(rawBody).digest("hex");
}

function paystackSecret(): string {
  const secret = env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw errors.internal(
      "PAYSTACK_SECRET_KEY is not configured — payment provider unavailable.",
    );
  }
  return secret;
}

export const simulateProvider: PaymentProvider = {
  id: "simulate",
  async initiate(_input: PaymentIntentInput) {
    const providerRef = `sim_${randomBytes(10).toString("hex")}`;
    // No hosted checkout for the offline sandbox; the engine routes patients to
    // the internal /pay/simulate page. Never null-parameter diagnostic warning.
    return { providerRef, checkoutUrl: null };
  },
  async verify(providerRef) {
    // Deterministic sandbox: a ref ending in "_failed" fails, "_cancel" is
    // cancelled, else it verifies as PAID. This lets tests exercise every
    // server-side transition without a live account.
    if (providerRef.endsWith("_failed")) {
      return { providerStatus: "FAILED", providerEcho: "simulate FAILED" };
    }
    if (providerRef.endsWith("_cancel")) {
      return { providerStatus: "CANCELLED", providerEcho: "simulate CANCELLED" };
    }
    return { providerStatus: "PAID", providerEcho: "simulate PAID" };
  },
  async refund() {
    // Offline sandbox: nothing to push upstream.
  },
};

/**
 * Offline "bank transfer" provider (Nigeria). There is no electronic gateway:
 * the patient transfers to the clinic's bank account and the admin confirms
 * receipt after checking the bank. The engine routes the patient to the
 * internal /pay/bank page which shows the account and a "I've made payment"
 * claim button. There is NO provider verify/webhook — the only way such a
 * payment reaches PAID is an explicit, audited admin confirmation. The claim
 * button never changes status; it just records that the patient transferred.
 */
export const bankTransferProvider: PaymentProvider = {
  id: "bank_transfer",
  async initiate(_input: PaymentIntentInput) {
    // Opaque local intent id; no upstream charge exists to reference.
    return { providerRef: `bt_${randomBytes(10).toString("hex")}`, checkoutUrl: null };
  },
  async verify() {
    // No upstream verdict — the clinic's bank statement is the source of
    // truth. Kept PENDING until an admin confirms receipt.
    return { providerStatus: "PENDING", providerEcho: "bank_transfer manual" };
  },
  async refund() {
    // The clinic refunds via a bank transfer themselves; nothing to push.
  },
};

/** Production adapter for Paystack (NGN). Uses Transaction initialize/verify. */
export const paystackProvider: PaymentProvider = {
  id: "paystack",
  async initiate(input) {
    const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountCents,
        currency: input.currency,
        reference: input.reference,
        email: input.customerEmail ?? "payment@ryc-dental.example",
        metadata: { description: input.description },
      }),
    });
    const payload = (await res.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; reference?: string };
    } | null;
    if (!res.ok || !payload?.status || !payload.data?.authorization_url) {
      throw errors.internal(
        `Payment initiation rejected by provider: ${payload?.message ?? res.status}`,
      );
    }
    return {
      providerRef: payload.data.reference ?? input.reference,
      checkoutUrl: payload.data.authorization_url,
    };
  },
  async verify(providerRef) {
    const res = await fetch(
      `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(providerRef)}`,
      { headers: { Authorization: `Bearer ${paystackSecret()}` } },
    );
    const payload = (await res.json().catch(() => null)) as {
      status?: boolean;
      data?: {
        status?: string; // success | failed | abandoned | reversed | ...
      };
    } | null;
    if (!res.ok || !payload?.status) {
      return {
        providerStatus: "FAILED",
        providerEcho: `paystack verify error (${res.status})`,
      };
    }
    const providerStatus =
      payload.data?.status === "success"
        ? "PAID"
        : payload.data?.status === "abandoned"
          ? "CANCELLED"
          : payload.data?.status === "reversed"
            ? "REFUNDED"
            : "FAILED";
    return {
      providerStatus,
      providerEcho: JSON.stringify(payload),
    };
  },
  verifyWebhook(rawBody, signature) {
    if (!signature) throw errors.unauthorized("Missing webhook signature.");
    const expected = paystackSignature(rawBody);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw errors.unauthorized("Webhook signature mismatch.");
    }
  },
  async refund(providerRef) {
    const res = await fetch(`${PAYSTACK_API}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transaction: providerRef }),
    });
    const payload = (await res.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
    } | null;
    if (!res.ok || !payload?.status) {
      throw errors.internal(
        `Payment refund rejected by provider: ${payload?.message ?? res.status}`,
      );
    }
  },
};

const REGISTRY: Record<string, PaymentProvider> = {
  simulate: simulateProvider,
  paystack: paystackProvider,
  bank_transfer: bankTransferProvider,
};

/** Test hook: register a synthetic provider for a single test run. */
export function registerPaymentProvider(provider: PaymentProvider): void {
  REGISTRY[provider.id] = provider;
}

export function unregisterPaymentProvider(id: string): void {
  delete REGISTRY[id];
}

export function getPaymentProvider(id = "simulate"): PaymentProvider {
  const provider = REGISTRY[id];
  if (!provider) throw new Error(`[payments] unknown provider: ${id}`);
  return provider;
}