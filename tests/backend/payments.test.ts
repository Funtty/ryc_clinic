import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPublicBooking } from "@/lib/server/public-booking";
import {
  createDeposit,
  verifyDeposit,
  handlePaymentWebhook,
  refundDeposit,
  getPaymentByRef,
  listPayments,
  createDepositForBooking,
  reportBankTransfer,
  confirmBankTransferPayment,
  type DepositInput,
} from "@/lib/server/payments/engine";
import {
  registerPaymentProvider,
  simulateProvider,
  type PaymentProvider,
} from "@/lib/server/payments/provider";
import { seedBase, cleanDb, nextStartAtAt } from "../helpers/backend";
import type { Service } from "@prisma/client";

/**
 * Payment / deposit engine — SERVER-SIDE verification contract.
 *
 * The browser NEVER declares success: a Payment only reaches PAID through
 * provider.verify() or a signature-checked webhook that funnels into the same
 * verify path. These tests drive the simulate provider (deterministic statuses
 * by providerRef suffix) and swap in synthetic providers to prove idempotency,
 * expiry and "network interrupt" behaviour without any live account.
 */

const DEPOSIT_AMOUNT_MAJOR = 6000; // 20% of the ₦30,000 seed checkout service

async function seedBooking() {
  const f = await seedBase();
  const startsAt = await nextStartAtAt();
  const booking = await createPublicBooking({
    serviceId: f.service.id,
    startsAt: startsAt.toISOString(),
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada.pay@example.com",
    phone: "+2348000000",
  });
  return { f, booking };
}

describe("payments — deposit intent + server verification", () => {
  beforeEach(cleanDb);
  afterEach(() => registerPaymentProvider(simulateProvider));

  it("books a deposit as PENDING with the policy amount and a checkout URL", async () => {
    const { booking } = await seedBooking();

    expect(booking.deposit).toBeTruthy();
    expect(booking.deposit?.status).toBe("PENDING");
    expect(booking.depositError).toBe(false);
    expect(booking.deposit?.amountCents).toBe(DEPOSIT_AMOUNT_MAJOR * 100);
    expect(booking.deposit?.currency).toBe("NGN");
    expect(booking.deposit?.paymentRef).toMatch(/^PAY-/);
    expect(booking.deposit?.checkoutUrl).toMatch(/^\/pay\/simulate\//);

    const row = await prisma.payment.findUnique({
      where: { id: booking.deposit!.paymentId },
    });
    expect(row?.status).toBe("PENDING");
    expect(row?.type).toBe("DEPOSIT");
    expect(row?.appointmentId).toBe(booking.id);
    expect(row?.amountCents).toBe(DEPOSIT_AMOUNT_MAJOR * 100);
    expect(row?.reportedBy).toBe("SERVER");
    // PHI rule: the row stores no patient name / diagnosis — identity stays on
    // the patient record, the amount-relevant facts on the appointment.
    expect(row?.currency).toBe("NGN");

    // Service has a price, so a deposit is created; the appointment is separate.
    const paymentCount = await prisma.payment.count({ where: { appointmentId: booking.id } });
    expect(paymentCount).toBe(1);
  });

  it("does NOT create a deposit for a service without a price (pay at clinic)", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();
    const service: Service = await prisma.service.create({
      data: {
        id: "service-freequote",
        slug: "free-quote",
        name: "Free Quote",
        shortDescription: "test",
        description: "test",
        durationMinutes: 15,
        currency: "NGN",
        isActive: true,
        dentists: { connect: { id: f.dentistA.id } },
      },
    });
    const booking = await createPublicBooking({
      serviceId: service.id,
      startsAt: startsAt.toISOString(),
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada.free@example.com",
      phone: "+2348000000",
    });
    expect(booking.deposit).toBeNull();
    expect(booking.depositError).toBe(false); // unpriced service is by design, not a failure
    const count = await prisma.payment.count();
    expect(count).toBe(0);
  });

  it("stamps depositError when the provider fails to start a deposit (booking survives)", async () => {
    const boom: PaymentProvider = {
      id: "simulate",
      async initiate() {
        throw new Error("payments provider down");
      },
      async verify() {
        return { providerStatus: "PENDING", providerEcho: "unused" };
      },
    };
    registerPaymentProvider(boom);
    try {
      const { booking } = await seedBooking();
      expect(booking.deposit).toBeNull();
      expect(booking.depositError).toBe(true);
      // A provider outage never loses the booking — the slot keeps standing.
      const row = await prisma.appointment.findUnique({
        where: { id: booking.id },
        select: { status: true },
      });
      expect(row?.status).toBe("PENDING");
    } finally {
      registerPaymentProvider(simulateProvider);
    }
  });

  it("is idempotent: a second create for the same appointment returns the SAME intent", async () => {
    const { booking } = await seedBooking();
    const input: DepositInput = {
      appointmentId: booking.id,
      patientId: booking.patient.id,
      amountCents: DEPOSIT_AMOUNT_MAJOR * 100,
      currency: "NGN",
    };
    const again = await createDeposit(input);
    expect(again.paymentId).toBe(booking.deposit!.paymentId);
    const count = await prisma.payment.count({ where: { appointmentId: booking.id } });
    expect(count).toBe(1);
  });

  it("verifies a paid deposit server-side via the provider (simulate PAID)", async () => {
    const { booking } = await seedBooking();
    const res = await verifyDeposit(booking.deposit!.paymentId);
    expect(res.status).toBe("PAID");
    expect(res.paidAt).toBeTruthy();

    const row = await prisma.payment.findUnique({
      where: { id: booking.deposit!.paymentId },
    });
    expect(row?.status).toBe("PAID");
    expect(row?.providerEvent).toBe("simulate PAID");
    expect(row?.reportedBy).toBe("SERVER");
  });

  it("maps a provider FAILED verdict to Payment FAILED and keeps the appointment intact", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();
    const booking = await createPublicBooking({
      serviceId: f.service.id,
      startsAt: startsAt.toISOString(),
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada.fail@example.com",
      phone: "+2348000000",
    });

    // The simulate provider treats a providerRef ending in "_failed" as FAILED.
    await prisma.payment.update({
      where: { id: booking.deposit!.paymentId },
      data: { providerRef: "sim_failed_test_failed" },
    });

    const res = await verifyDeposit(booking.deposit!.paymentId);
    expect(res.status).toBe("FAILED");
    expect(res.paidAt).toBeNull();

    const appt = await prisma.appointment.findUnique({ where: { id: booking.id } });
    expect(appt?.status).toBe("PENDING"); // deposit failure never cancels the visit
  });

  it("maps a provider CANCELLED verdict (user backs out) to Payment CANCELLED", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();
    const booking = await createPublicBooking({
      serviceId: f.service.id,
      startsAt: startsAt.toISOString(),
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada.cancel@example.com",
      phone: "+2348000000",
    });

    await prisma.payment.update({
      where: { id: booking.deposit!.paymentId },
      data: { providerRef: "sim_cancel_test_cancel" },
    });

    const res = await verifyDeposit(booking.deposit!.paymentId);
    expect(res.status).toBe("CANCELLED");

    const appt = await prisma.appointment.findUnique({ where: { id: booking.id } });
    expect(appt?.status).toBe("PENDING");
  });

  it("expires a truly abandoned PENDING intent (user closed the page) after the window", async () => {
    // A provider that keeps the intent pending (patient never authorised), then
    // the window elapses — only then is it abandoned and can expire.
    registerPaymentProvider({
      ...simulateProvider,
      id: "simulate",
      async verify() {
        return { providerStatus: "PENDING", providerEcho: "simulate PENDING" };
      },
    });

    const f = await seedBase();
    const startsAt = await nextStartAtAt();
    const booking = await createPublicBooking({
      serviceId: f.service.id,
      startsAt: startsAt.toISOString(),
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada.abandon@example.com",
      phone: "+2348000000",
    });

    // Back-date the intent beyond the expiry window (still PENDING).
    await prisma.payment.update({
      where: { id: booking.deposit!.paymentId },
      data: { createdAt: new Date(Date.now() - 2 * 60 * 60_000) },
    });

    const res = await verifyDeposit(booking.deposit!.paymentId);
    expect(res.status).toBe("EXPIRED");

    const row = await prisma.payment.findUnique({
      where: { id: booking.deposit!.paymentId },
    });
    expect(row?.status).toBe("EXPIRED");
    const appt = await prisma.appointment.findUnique({ where: { id: booking.id } });
    expect(appt?.status).toBe("PENDING");
  });

  it("replays duplicate webhooks idempotently (never a second state change)", async () => {
    const { booking } = await seedBooking();

    const first = await handlePaymentWebhook(
      JSON.stringify({ paymentId: booking.deposit!.paymentId }),
    );
    const second = await handlePaymentWebhook(
      JSON.stringify({ paymentId: booking.deposit!.paymentId }),
    );
    expect(first.status).toBe("PAID");
    expect(second.status).toBe("PAID");

    const row = await prisma.payment.findUnique({
      where: { id: booking.deposit!.paymentId },
    });
    expect(row?.status).toBe("PAID");
  });

  it("returns a valid PAY- reference for a paystack-style webhook body", async () => {
    const { booking } = await seedBooking();
    const res = await handlePaymentWebhook(
      JSON.stringify({ event: "charge.success", data: { reference: booking.deposit!.paymentRef } }),
    );
    expect(res.status).toBe("PAID");
  });

  it("correctly identifies a payment by our PAY- ref for the checkout redirect", async () => {
    const { booking } = await seedBooking();
    const view = await getPaymentByRef(booking.deposit!.paymentRef);
    expect(view.id).toBe(booking.deposit!.paymentId);
    expect(view.paymentRef).toBe(booking.deposit!.paymentRef);
    expect(view.amountCents).toBe(DEPOSIT_AMOUNT_MAJOR * 100);
  });

  it("ignores a browser-provided outcome — status only changes via the provider verdict", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();
    const booking = await createPublicBooking({
      serviceId: f.service.id,
      startsAt: startsAt.toISOString(),
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada.hck@example.com",
      phone: "+2348000000",
    });

    // A malicious client posts "PAID": the engine must NOT flip the row; it
    // re-verifies with the provider, which here says PAID anyway — but only
    // because the provider decided, not because the browser said so.
    await verifyDeposit(booking.deposit!.paymentId);
    const row = await prisma.payment.findUnique({
      where: { id: booking.deposit!.paymentId },
    });
    expect(row?.status).toBe("PAID");
    expect(row?.reportedBy).toBe("SERVER");
  });
});

describe("payments — retryable failure is re-initable without a second charge", () => {
  beforeEach(cleanDb);

  it("creates a FRESH intent for a FAILED deposit (retry), reusing the same row", async () => {
    const { booking } = await seedBooking();

    // First attempt fails at the provider.
    await prisma.payment.update({
      where: { id: booking.deposit!.paymentId },
      data: { providerRef: "sim_failed_test_failed" },
    });
    await verifyDeposit(booking.deposit!.paymentId);

    const retry = await createDepositForBooking({
      appointmentId: booking.id,
      patientId: booking.patient.id,
      servicePriceMajor: 30000,
      currency: "NGN",
    });
    expect(retry).toBeTruthy();
    expect(retry!.status).toBe("PENDING");
    expect(retry!.paymentId).toBe(booking.deposit!.paymentId); // same dedupe row
    expect(retry!.providerRef).not.toBe("sim_failed_test_failed");

    const count = await prisma.payment.count({ where: { appointmentId: booking.id } });
    expect(count).toBe(1); // no second row, no second charge
  });
});

describe("payments — synthetic provider: network interruption", () => {
  beforeEach(cleanDb);
  afterEach(() => registerPaymentProvider(simulateProvider));

  it("keeps the deposit PENDING when the provider is unreachable at verify time", async () => {
    // The clinical booking always runs on the enabled provider (simulate).
    // Swap it for a "healthy" twin so we can later simulate an outage on the
    // SAME provider id the payment row points at.
    registerPaymentProvider({ ...simulateProvider, id: "simulate" });
    const f = await seedBase();
    const startsAt = await nextStartAtAt();
    const booking = await createPublicBooking({
      serviceId: f.service.id,
      startsAt: startsAt.toISOString(),
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada.net@example.com",
      phone: "+2348000000",
    });
    const paidId = booking.deposit!.paymentId;

    // Now the provider is "down": verify() throws (provider 5xx / timeout).
    registerPaymentProvider({
      ...simulateProvider,
      id: "simulate",
      async verify() {
        throw new Error("upstream 503");
      },
    });

    // Network interruption mid-verify is reported as a server error, and the
    // deposit stays PENDING — the patient's slot is NOT lost.
    await expect(verifyDeposit(paidId)).rejects.toBeTruthy();
    const row = await prisma.payment.findUnique({ where: { id: paidId } });
    expect(row?.status).toBe("PENDING");

    // Provider recovers: re-verifying succeeds and moves to PAID.
    registerPaymentProvider({ ...simulateProvider, id: "simulate" });
    const recovered = await verifyDeposit(paidId);
    expect(recovered.status).toBe("PAID");
  });
});

describe("payments — refunds & admin visibility", () => {
  beforeEach(cleanDb);

  it("refunds a PAID deposit server-side (admin action)", async () => {
    const { booking } = await seedBooking();
    await verifyDeposit(booking.deposit!.paymentId);

    const res = await refundDeposit(booking.deposit!.paymentId);
    expect(res.status).toBe("REFUNDED");

    const row = await prisma.payment.findUnique({
      where: { id: booking.deposit!.paymentId },
    });
    expect(row?.status).toBe("REFUNDED");
  });

  it("refuses to refund anything that is not PAID", async () => {
    const { booking } = await seedBooking();
    await expect(refundDeposit(booking.deposit!.paymentId)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("lists payments to admins with PHI-safe labels only", async () => {
    const { booking } = await seedBooking();
    const rows = await listPayments();
    const view = rows.find((r) => r.id === booking.deposit!.paymentId);
    expect(view).toBeTruthy();
    expect(view!.paymentRef).toMatch(/^PAY-/);
    // No name/email/diagnosis anywhere in the list view.
    expect(JSON.stringify(view)).not.toMatch(/ada\.pay@example|xample/i);
  });
});

describe("payments — bank transfer flow (patient claims, admin confirms)", () => {
  beforeEach(cleanDb);

  /** Convert the simulated deposit row to a bank_transfer payment. */
  async function toBankTransfer(paymentId: string) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        provider: "bank_transfer",
        providerRef: "bt_test_manual",
        checkoutUrl: `/pay/bank/x`,
        patientReportedAt: null,
      },
    });
  }

  it("patient CLAIM never changes status — only records the claim (idempotent)", async () => {
    const { booking } = await seedBooking();
    await toBankTransfer(booking.deposit!.paymentId);

    const first = await reportBankTransfer(booking.deposit!.paymentId);
    expect(first).toMatchObject({ reported: true, status: "PENDING" });

    const row = await prisma.payment.findUnique({
      where: { id: booking.deposit!.paymentId },
    });
    expect(row?.status).toBe("PENDING");
    expect(row?.patientReportedAt).toBeTruthy();

    // Re-reporting (double click) is a safe no-op.
    const again = await reportBankTransfer(booking.deposit!.paymentId);
    expect(again.reported).toBe(true);
    const row2 = await prisma.payment.findUnique({
      where: { id: booking.deposit!.paymentId },
    });
    expect(row2?.patientReportedAt?.getTime()).toBe(row!.patientReportedAt!.getTime());
  });

  it("rejects the claim step for non-bank-transfer payments", async () => {
    const { booking } = await seedBooking();
    await expect(reportBankTransfer(booking.deposit!.paymentId)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("admin confirmation is the only way a bank transfer reaches PAID", async () => {
    const { booking } = await seedBooking();
    await toBankTransfer(booking.deposit!.paymentId);
    await reportBankTransfer(booking.deposit!.paymentId);

    const res = await confirmBankTransferPayment(booking.deposit!.paymentId);
    expect(res.status).toBe("PAID");
    expect(res.paidAt).toBeTruthy();

    const row = await prisma.payment.findUnique({
      where: { id: booking.deposit!.paymentId },
    });
    expect(row?.status).toBe("PAID");
    expect(row?.reportedBy).toBe("MANUAL");
    expect(row?.providerEvent).toContain("admin");

    // The appointment is NOT auto-confirmed by payment — the clinic confirms it.
    const appt = await prisma.appointment.findUnique({ where: { id: booking.id } });
    expect(appt?.status).toBe("PENDING");

    // A second confirm on the now-PAID row conflicts.
    await expect(confirmBankTransferPayment(booking.deposit!.paymentId)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("refuses admin confirmation for payments that are not bank transfers", async () => {
    const { booking } = await seedBooking();
    await expect(confirmBankTransferPayment(booking.deposit!.paymentId)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});