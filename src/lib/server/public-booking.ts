import "server-only";
import { prisma } from "@/lib/prisma";
import { site, formatDate, formatTime } from "@/lib/site";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/constants";
import { checkSlot } from "@/lib/availability";
import { errors, toAppError, AppError } from "./errors";
import { recordAudit } from "./audit";
import { generateReference } from "./reference";
import { createBookingSchema } from "./validators";
import { createDepositForBooking } from "./payments/engine";
import { bankAccountDetails } from "./payments/bank-account";
import { notifyClinic } from "./email/clinic-alerts";
import { formatMoney } from "@/lib/utils";

export type PublicBookingResult = {
  id: string;
  reference: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  service: { id: string; name: string };
  dentist: { id: string; name: string } | null;
  patient: { id: string; email: string };
  /** Deposit intent created for this visit, when the service has a price. */
  deposit: {
    paymentId: string;
    paymentRef: string;
    checkoutUrl: string;
    status: string;
    amountCents: number;
    currency: string;
    /** Bank account shown for the bank_transfer provider, else null. */
    bankAccount: {
      accountName: string | null;
      accountNumber: string | null;
      bankName: string | null;
    } | null;
  } | null;
};

/**
 * Patient-facing self-service booking. Public (no `withAuth`):
 * - Validates the payload, service and (optional) dentist.
 * - Runs the shared availability engine (`checkSlot`) as a fast pre-check.
 * - Re-checks the exact dentist's calendar inside a write transaction so two
 *   patients grabbing the same slot at the same time cannot both succeed.
 * - When no dentist was chosen, pins the dentist the engine returned so the
 *   per-dentist re-check stays exact.
 * - Finds or creates a patient by email (contact details are snapshotted onto
 *   the appointment, so later edits to the patient record don't rewrite history).
 */
export async function createPublicBooking(raw: unknown): Promise<PublicBookingResult> {
  const parsed = createBookingSchema.safeParse(raw);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());

  const { serviceId, dentistId, startsAt, email, firstName, lastName, phone, dateOfBirth, notes } =
    parsed.data;
  const emailNorm = email.toLowerCase();

  const [service, dentist] = await Promise.all([
    prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        price: true,
        currency: true,
        isActive: true,
      },
    }),
    dentistId
      ? prisma.dentist.findUnique({
          where: { id: dentistId },
          select: { id: true, name: true, isActive: true },
        })
      : null,
  ]);
  if (!service || !service.isActive) throw errors.notFound("Service");
  if (dentistId && (!dentist || !dentist.isActive)) throw errors.notFound("Dentist");

  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
  const slot = await checkSlot({
    dentistId,
    startsAt,
    endsAt,
    serviceId,
    durationMinutes: service.durationMinutes,
    timeZone: site.timeZone,
  });
  if (!slot.ok) throw errors.conflict(slot.reason);

  // When "no preference", commit to the dentist the engine picked.
  const pinnedDentistId = dentistId ?? slot.slot.dentist.id;
  const pinnedDentistName = dentist?.name ?? slot.slot.dentist.name;

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const clash = await tx.appointment.findFirst({
          where: {
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
            status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
            dentistId: pinnedDentistId,
          },
          select: { id: true },
        });
        if (clash) {
          throw errors.conflict(
            "That time was just booked by someone else — please pick another slot.",
          );
        }

        let patient = await tx.patient.findUnique({ where: { email: emailNorm } });
        if (!patient) {
          patient = await tx.patient.create({
            data: {
              email: emailNorm,
              firstName,
              lastName,
              phone,
              dateOfBirth: dateOfBirth ?? null,
              notes,
            },
          });
        }

        const appointment = await tx.appointment.create({
          data: {
            reference: generateReference(),
            patientId: patient.id,
            serviceId: service.id,
            dentistId: pinnedDentistId,
            startsAt,
            endsAt,
            durationMinutes: service.durationMinutes,
            contactName: `${firstName} ${lastName}`.trim(),
            contactEmail: emailNorm,
            contactPhone: phone,
            notes,
          },
        });

        await recordAudit(
          {
            action: "appointment.create",
            entityType: "appointment",
            entityId: appointment.id,
            meta: {
              reference: appointment.reference,
              startsAt,
              serviceId: service.id,
              dentistId: pinnedDentistId,
              source: "public_booking",
            },
          },
          tx,
        );

        return {
          id: appointment.id,
          reference: appointment.reference,
          status: appointment.status,
          startsAt: appointment.startsAt,
          endsAt: appointment.endsAt,
          durationMinutes: appointment.durationMinutes,
          service: { id: service.id, name: service.name },
          dentist: { id: pinnedDentistId, name: pinnedDentistName },
          patient: { id: patient.id, email: patient.email },
        };
      },
      {
        maxWait: 5000,
        timeout: 10000,
      },
    );

    // Phase 8 — deposit intent. Created AFTER the appointment so a payment
    // provider outage never loses a booking: the appointment already stands
    // as PENDING and the deposit can be initiated again. A stored deposit is
    // returned so the patient can complete checkout immediately.
    let deposit: {
      paymentId: string;
      paymentRef: string;
      checkoutUrl: string;
      status: string;
      amountCents: number;
      currency: string;
      bankAccount: {
        accountName: string | null;
        accountNumber: string | null;
        bankName: string | null;
      } | null;
    } | null = null;
    try {
      const intent = await createDepositForBooking({
        appointmentId: created.id,
        patientId: created.patient.id,
        servicePriceMajor: service.price,
        currency: service.currency,
      });
      if (intent) {
        deposit = {
          paymentId: intent.paymentId,
          paymentRef: intent.paymentRef,
          checkoutUrl: intent.checkoutUrl,
          status: intent.status,
          amountCents: intent.amountCents,
          currency: intent.currency,
          bankAccount:
            intent.provider === "bank_transfer" ? bankAccountDetails() : null,
        };
      }
    } catch {
      // Deposit initiation failure is NOT fatal: patient can pay at the
      // clinic or retry. Appointment remains PENDING & slot held.
      deposit = null;
    }

    void notifyClinic(
      "New appointment booking",
      [
        { label: "Patient", value: `${firstName} ${lastName}`.trim() },
        { label: "Phone", value: phone ?? "—" },
        { label: "Email", value: emailNorm },
        { label: "Service", value: created.service.name },
        { label: "Technologist", value: created.dentist?.name ?? "—" },
        {
          label: "Date & time",
          value: `${formatDate(created.startsAt)} at ${formatTime(created.startsAt)}–${formatTime(created.endsAt)}`,
        },
        { label: "Reference", value: created.reference },
        {
          label: "Deposit",
          value: deposit
            ? `${formatMoney(deposit.amountCents / 100, deposit.currency)} (${deposit.status})`
            : "None — pay at clinic",
        },
      ],
      created.reference,
    );

    return { ...created, deposit };
  } catch (e) {
    if (e instanceof AppError) throw e;
    const mapped = toAppError(e);
    if (mapped.code === "DUPLICATE_RECORD") {
      throw new AppError(
        "REFERENCE_COLLISION",
        "Could not allocate a unique booking reference — please try again.",
        409,
      );
    }
    throw mapped;
  }
}