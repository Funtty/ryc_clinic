import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider, type PaymentIntentResult } from "./provider";
import { recordAudit } from "@/lib/server/audit";
import { errors } from "@/lib/server/errors";
import { enabledProviderId, depositAmountMajor, DEPOSIT_EXPIRY_MS } from "./config";
import { formatMoney } from "@/lib/utils";
import { notifyClinic } from "@/lib/server/email/clinic-alerts";

// RYC Dental (Abeokuta, NGN) — server-authoritative appointment deposit.
//
// SECURITY CONTRACT (enforced here + verified by tests, never by the browser):
//   1. The BROWSER NEVER declares success. A Payment only reaches PAID when
//      THIS server calls provider.verify(providerRef) and the provider says
//      PAID — or when a signature-checked webhook runs through the SAME
//      verify path. A browser "I paid!" payload is ignored entirely.
//   2. We NEVER store raw card data. We keep an opaque providerRef and
//      non-PHI bookkeeping (amount, currency, type, status, timestamps).
//      The PCI surface stays entirely upstream with the provider.
//   3. Idempotency: a unique dedupeKey (provider:appointmentId:type) means
//      a double click, a network retry, or a replayed webhook each resolve to
//      the SAME Payment row and can never create a second intent or a
//      second charge.
//   4. A failed/expired/cancelled deposit NEVER flips the appointment: the
//      slot stays intact and the deposit can be retried.
//   5. PHI rule (shared with email templates): any list label shown inside
//      this module never carries a patient name, a diagnosis, notes, or a
//      cancellation/rescheduling reason. Those live on the patient's own
//      record and the audit trail, server-side, addressed to that recipient
//      only.

export type DepositInput = {
  appointmentId: string;
  patientId: string;
  /** Deposit amount in minor currency units (kobo for NGN). */
  amountCents: number;
  currency?: string; // default NGN
  type?: string; // DEPOSIT
};

export type DepositResult = {
  paymentId: string;
  paymentRef: string; // our stable ref, e.g. PAY-<cuid>; shown to the patient
  provider: string;
  providerRef: string; // opaque upstream intent/charge id, never a card
  checkoutUrl: string; // where the patient authorizes — NEVER where "paid" is decided
  status: string; // always PENDING at creation
  amountCents: number;
  currency: string;
};

function toPaymentRef(): string {
  // CSPRNG so the public payment reference is never guessable from time or a
  // weak PRNG seed ("PAY-" + 12 hex chars ≈ 48 bits).
  return `PAY-${randomBytes(6).toString("hex").toUpperCase()}`;
}

/**
 * Internal checkout route for offline providers (never a live hosted page):
 * - simulate: dev sandbox checkout (/pay/simulate/<ref>)
 * - bank_transfer: account details + "I've made payment" page (/pay/bank/<ref>)
 */
function internalCheckoutUrl(providerId: string, paymentRef: string): string {
  return providerId === "bank_transfer"
    ? `/pay/bank/${paymentRef}`
    : `/pay/simulate/${paymentRef}`;
}

/**
 * Kick off (or resume) a deposit intent for an appointment.
 * - Fresh: provider.initiate → store intent, return checkout URL.
 * - Existing PENDING: return the SAME intent (idempotent), never a 2nd charge.
 * - Existing PAID: idempotent no-op returning the stored record.
 * - Existing FAILED/EXPIRED/CANCELLED: a new intent may be created (retry).
 * The provider returns a hosted checkout URL for real providers; the simulate
 * provider returns our internal /pay/simulate page.
 */
export async function createDeposit(input: DepositInput): Promise<DepositResult> {
  const provider = getPaymentProvider(enabledProviderId());
  const paymentRef = toPaymentRef();
  const currency = input.currency ?? "NGN";
  const type = input.type ?? "DEPOSIT";
  const dedupeKey = `${provider.id}:${input.appointmentId}:${type}`;

  const existing = await prisma.payment.findUnique({ where: { dedupeKey } });
  if (existing && (existing.status === "PENDING" || existing.status === "PAID")) {
    return {
      paymentId: existing.id,
      paymentRef: existing.paymentId,
      provider: existing.provider,
      providerRef: existing.providerRef ?? "",
      checkoutUrl: existing.checkoutUrl || internalCheckoutUrl(existing.provider, existing.id),
      status: existing.status,
      amountCents: existing.amountCents,
      currency: existing.currency,
    };
  }

  const initiated: PaymentIntentResult = await provider.initiate({
    reference: paymentRef,
    amountCents: input.amountCents,
    currency,
    description: `Deposit ${type} • ${paymentRef}`,
  });
  const checkoutUrl = initiated.checkoutUrl ?? internalCheckoutUrl(provider.id, paymentRef);

  const created = await prisma.payment.upsert({
    where: { dedupeKey },
    create: {
      paymentId: paymentRef,
      appointmentId: input.appointmentId,
      patientId: input.patientId,
      provider: provider.id,
      providerRef: initiated.providerRef,
      checkoutUrl,
      type,
      status: "PENDING",
      amountCents: input.amountCents,
      currency,
      dedupeKey,
      attempt: 1,
      reportedBy: "SERVER",
      expiresAt: new Date(Date.now() + DEPOSIT_EXPIRY_MS),
    },
    update: {
      // Retry after FAILED/EXPIRED/CANCELLED: re-use the row, fresh intent.
      paymentId: paymentRef,
      provider: provider.id,
      providerRef: initiated.providerRef,
      checkoutUrl,
      status: "PENDING",
      amountCents: input.amountCents,
      currency,
      attempt: { increment: 1 },
      providerEvent: "",
      paidAt: null,
      expiresAt: new Date(Date.now() + DEPOSIT_EXPIRY_MS),
      updatedAt: new Date(),
    },
  });

  await recordAudit({
    userId: null,
    action: "payment.deposit.initiated",
    entityType: "Payment",
    entityId: created.id,
    meta: JSON.stringify({
      paymentRef,
      provider: provider.id,
      type,
      amountCents: input.amountCents,
      currency,
    }),
  });

  return {
    paymentId: created.id,
    paymentRef,
    provider: provider.id,
    providerRef: initiated.providerRef,
    checkoutUrl,
    status: "PENDING",
    amountCents: input.amountCents,
    currency,
  };
}

export type PaymentView = {
  id: string;
  paymentRef: string;
  appointmentId: string;
  patientId: string;
  provider: string;
  status: string;
  type: string;
  amountCents: number;
  currency: string;
  paidAt: Date | null;
  createdAt: Date;
  /** bank_transfer only: when the patient claimed "I've made payment". */
  patientReportedAt: Date | null;
  appointmentReference?: string;
  serviceName?: string;
};

function toView(
  row: {
    id: string;
    paymentId: string;
    appointmentId: string;
    patientId: string;
    provider: string;
    type: string;
    status: string;
    amountCents: number;
    currency: string;
    paidAt: Date | null;
    createdAt: Date;
    patientReportedAt: Date | null;
    appointment?: {
      reference: string;
      service?: { name: string } | null;
    } | null;
  },
): PaymentView {
  return {
    id: row.id,
    paymentRef: row.paymentId,
    appointmentId: row.appointmentId,
    patientId: row.patientId,
    provider: row.provider,
    status: row.status,
    type: row.type,
    amountCents: row.amountCents,
    currency: row.currency,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    patientReportedAt: row.patientReportedAt,
    appointmentReference: row.appointment?.reference,
    serviceName: row.appointment?.service?.name,
  };
}

export type VerifyResult = {
  status: string;
  paidAt: Date | null;
};

/**
 * SERVER-SIDE verification — the ONLY way a deposit is declared paid.
 * Called with the payment id; never trusts a browser-provided outcome.
 * Signature-checked webhooks funnel here too (see handlePaymentWebhook).
 * Expired intents resolve to FAILED (a PENDING intent whose window elapsed can
 * never retroactively become PAID on a later verify — the patient re-books).
 */
export async function verifyDeposit(paymentId: string): Promise<VerifyResult> {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      appointment: {
        include: {
          service: { select: { name: true } },
          dentist: { select: { name: true } },
          patient: { select: { firstName: true, lastName: true, phone: true } },
        },
      },
    },
  });

  // Already terminal — idempotent no-op (dedupes duplicate webhooks/verifies).
  if (
    payment.status === "PAID" ||
    payment.status === "FAILED" ||
    payment.status === "EXPIRED" ||
    payment.status === "CANCELLED" ||
    payment.status === "REFUNDED"
  ) {
    return { status: payment.status, paidAt: payment.paidAt };
  }

  const provider = getPaymentProvider(payment.provider);
  const verified = await provider.verify(payment.providerRef ?? "");

  const next: string =
    verified.providerStatus === "PAID"
      ? "PAID"
      : verified.providerStatus === "CANCELLED"
        ? "CANCELLED"
        : verified.providerStatus === "PENDING"
          ? "PENDING"
          : "FAILED";

  // Time-based expiry: user closed the page or never returned from the
  // provider. Only a truly abandoned intent expires — a PENDING intent under
  // the expiry window stays PENDING (retryable).
  if (next === "PENDING" && payment.createdAt.getTime() + DEPOSIT_EXPIRY_MS < Date.now()) {
    const expired = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "EXPIRED", updatedAt: new Date() },
    });
    await recordAudit({
      userId: null,
      action: "payment.deposit.expired",
      entityType: "Payment",
      entityId: payment.id,
      meta: JSON.stringify({ from: "PENDING", to: "EXPIRED" }),
    });
    return { status: expired.status, paidAt: expired.paidAt };
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: next === "PENDING" ? payment.status : next,
      paidAt: next === "PAID" ? new Date() : payment.paidAt,
      providerEvent: verified.providerEcho,
      attempt: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  if (next !== "PENDING") {
    await recordAudit({
      userId: null,
      action: "payment.deposit.verified",
      entityType: "Payment",
      entityId: payment.id,
      meta: JSON.stringify({ providerStatus: verified.providerStatus, to: next }),
    });
  }

  if (next === "PAID") {
    const appt = payment.appointment;
    void notifyClinic(
      "Payment received",
      [
        {
          label: "Patient",
          value: [appt.patient.firstName, appt.patient.lastName].filter(Boolean).join(" ") || "—",
        },
        { label: "Phone", value: appt.patient.phone ?? "—" },
        { label: "Service", value: appt.service.name },
        { label: "Technologist", value: appt.dentist?.name ?? "—" },
        { label: "Appointment", value: appt.reference },
        { label: "Payment", value: payment.paymentId },
        { label: "Amount", value: formatMoney(payment.amountCents / 100, payment.currency) },
        { label: "Status", value: "PAID — verified with the payment provider" },
      ],
      payment.paymentId,
    );
  }

  return { status: updated.status, paidAt: updated.paidAt };
}

/**
 * Signature-checked provider webhook. The RAW body + signature come straight
 * from the provider transport; we re-derive what the provider says and only
 * ever apply a transition through verifyDeposit. Duplicate/replayed webhooks
 * are idempotent (terminal-suppression above).
 */
export async function handlePaymentWebhook(
  rawBody: string,
  opts?: { signature?: string | null },
): Promise<VerifyResult> {
  const parsed = JSON.parse(rawBody) as {
    paymentId?: string;
    data?: { reference?: string };
  } | null;
  if (!parsed) throw errors.validation("payment.webhook.malformed");

  // simulate sends { paymentId }; paystack sends { event, data: { reference } }.
  const ref = parsed.paymentId ?? parsed.data?.reference;
  if (!ref) throw errors.validation("payment.webhook.malformed");

  const payment = await prisma.payment.findFirst({
    where: { OR: [{ id: ref }, { paymentId: ref }] },
  });
  if (!payment) throw errors.notFound("Payment");

  // Verify the HMAC signature (paystack) BEFORE any state change.
  if (opts?.signature !== undefined) {
    const provider = getPaymentProvider(payment.provider);
    provider.verifyWebhook?.(rawBody, opts.signature);
  }

  return verifyDeposit(payment.id);
}

/** Payments for one appointment (used on the admin appointment detail). */
export async function listPaymentsForAppointment(
  appointmentId: string,
): Promise<PaymentView[]> {
  const rows = await prisma.payment.findMany({
    where: { appointmentId },
    orderBy: { createdAt: "desc" },
    include: {
      appointment: {
        select: { reference: true, service: { select: { name: true } } },
      },
    },
  });
  return rows.map(toView);
}

/** Admin surface: payments with an optional status filter (PHI-safe list). */
export async function listPayments(filter?: {
  status?: string;
  take?: number;
}): Promise<PaymentView[]> {
  const where = filter?.status ? { status: filter.status } : {};
  const rows = await prisma.payment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(filter?.take ?? 100, 200),
    include: {
      appointment: {
        select: { reference: true, service: { select: { name: true } } },
      },
    },
  });
  return rows.map(toView);
}

export async function getPayment(paymentId: string): Promise<PaymentView> {
  const row = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      appointment: {
        select: { reference: true, service: { select: { name: true } } },
      },
    },
  });
  if (!row) throw errors.notFound("Payment");
  return toView(row);
}

/** Look up a payment by our stable PAY-<ref> (used by checkout redirects). */
export async function getPaymentByRef(paymentRef: string): Promise<PaymentView> {
  const row = await prisma.payment.findUnique({
    where: { paymentId: paymentRef },
    include: {
      appointment: {
        select: { reference: true, service: { select: { name: true } } },
      },
    },
  });
  if (!row) throw errors.notFound("Payment");
  return toView(row);
}

/**
 * Refund a PAID deposit. The provider is asked to refund FIRST: if the push
 * fails the local record stays PAID so it never claims a refund that was not
 * issued upstream. simulate refunds natively (no-op); paystack pushes a real
 * /refund request.
 */
export async function refundDeposit(paymentId: string): Promise<VerifyResult> {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (payment.status !== "PAID") {
    throw errors.conflict("Only a paid deposit can be refunded.");
  }
  const provider = getPaymentProvider(payment.provider);
  await provider.refund?.(payment.providerRef ?? "");
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "REFUNDED", paidAt: payment.paidAt, updatedAt: new Date() },
  });
  await recordAudit({
    userId: null,
    action: "payment.deposit.refunded",
    entityType: "Payment",
    entityId: payment.id,
    meta: JSON.stringify({ from: "PAID", to: "REFUNDED" }),
  });
  return { status: updated.status, paidAt: updated.paidAt };
}

/**
 * Bank transfer flow — patient claims "I've made payment". This records the
 * CLAIM only; it NEVER changes status. The payment stays PENDING (the admin
 * will verify against the bank) and the deposit remains retryable.
 */
export async function reportBankTransfer(paymentId: string): Promise<{
  reported: boolean;
  status: string;
}> {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (payment.provider !== "bank_transfer") {
    throw errors.conflict("Only bank-transfer payments have a manual report step.");
  }
  if (payment.status !== "PENDING") {
    throw errors.conflict(
      `Cannot report a transfer for a payment that is ${payment.status}.`,
    );
  }
  const already = payment.patientReportedAt !== null;
  if (!already) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { patientReportedAt: new Date(), updatedAt: new Date() },
    });
    await recordAudit({
      userId: null,
      action: "payment.deposit.reported_by_patient",
      entityType: "Payment",
      entityId: payment.id,
      meta: JSON.stringify({ provider: "bank_transfer" }),
    });
  }
  return { reported: true, status: "PENDING" };
}

/**
 * Admin verification for bank_transfer payments — the ONLY way one reaches
 * PAID (there is no upstream verdict to trust). The admin checks the clinic's
 * bank statement and then confirms receipt. Conditional update so a raced
 * change by another admin cannot be overwritten.
 */
export async function confirmBankTransferPayment(paymentId: string): Promise<VerifyResult> {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      appointment: {
        include: {
          service: { select: { name: true } },
          dentist: { select: { name: true } },
          patient: { select: { firstName: true, lastName: true, phone: true } },
        },
      },
    },
  });
  if (payment.provider !== "bank_transfer") {
    throw errors.conflict("Only bank-transfer payments can be confirmed by bank check.");
  }
  if (payment.status !== "PENDING") {
    throw errors.conflict(
      `Cannot confirm a payment that is ${payment.status}.`,
    );
  }

  const updated = await prisma.payment.updateMany({
    where: { id: payment.id, status: "PENDING", provider: "bank_transfer" },
    data: {
      status: "PAID",
      paidAt: new Date(),
      reportedBy: "MANUAL",
      providerEvent: "confirmed by admin after bank check",
      updatedAt: new Date(),
    },
  });
  if (updated.count === 0) {
    throw errors.conflict("This payment was just changed by someone else. Refresh and try again.");
  }

  const changed = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  await recordAudit({
    userId: null,
    action: "payment.deposit.confirmed",
    entityType: "Payment",
    entityId: payment.id,
    meta: JSON.stringify({ from: "PENDING", to: "PAID", provider: "bank_transfer" }),
  });

  const appt = payment.appointment;
  if (appt) {
    void notifyClinic(
      "Deposit confirmed (bank transfer)",
      [
        {
          label: "Patient",
          value:
            [appt.patient.firstName, appt.patient.lastName].filter(Boolean).join(" ") || "—",
        },
        { label: "Phone", value: appt.patient.phone ?? "—" },
        { label: "Service", value: appt.service.name },
        { label: "Technologist", value: appt.dentist?.name ?? "—" },
        { label: "Appointment", value: appt.reference },
        { label: "Amount", value: formatMoney(changed.amountCents / 100, changed.currency) },
        { label: "Status", value: "PAID — confirmed against bank statement" },
      ],
      changed.paymentId,
    );
  }

  return { status: changed.status, paidAt: changed.paidAt };
}

/**
 * Book a deposit against an appointment, deriving the amount from the service
 * price via the clinic deposit policy. Returns null when the service has no
 * set price ("pay at clinic" model) — no online deposit for that visit.
 */
export async function createDepositForBooking(input: {
  appointmentId: string;
  patientId: string;
  servicePriceMajor: number | null;
  currency?: string;
}): Promise<DepositResult | null> {
  if (input.servicePriceMajor == null) return null;
  return createDeposit({
    appointmentId: input.appointmentId,
    patientId: input.patientId,
    amountCents: depositAmountMajor(input.servicePriceMajor) * 100,
    currency: input.currency ?? "NGN",
    type: "DEPOSIT",
  });
}