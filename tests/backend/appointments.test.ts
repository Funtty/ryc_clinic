import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createAppointment,
  listAppointments,
  getAppointment,
  transitionAppointment,
  rescheduleAppointment,
  APPOINTMENT_TRANSITIONS,
} from "@/lib/server/appointments";
import { cleanDb, seedBase, staffUser, nextStartAtAt } from "../helpers/backend";

beforeEach(cleanDb);

describe("appointment creation", () => {
  it("creates a PENDING appointment on a bookable slot with a unique reference", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();

    const appointment = await createAppointment(staffUser, {
      patientId: f.patient.id,
      serviceId: f.service.id,
      dentistId: f.dentistA.id,
      startsAt: startsAt.toISOString(),
      notes: "Please translate what the dentist says",
    });

    expect(appointment).toBeTruthy();
    expect(appointment!.reference).toMatch(/^RYC-[0-9A-F]{6}$/);
    expect(appointment!.status).toBe("PENDING");
    expect(appointment!.durationMinutes).toBe(f.service.durationMinutes);
    expect(appointment!.contactName).toBe("Ada Johnson");
    expect(appointment!.contactEmail).toBe(f.patient.email);
    expect(appointment!.createdAt).toBeInstanceOf(Date);

    const read = await getAppointment(staffUser, appointment!.id);
    expect(read?.dentist?.slug).toBe(f.dentistA.slug);

    const audit = await prisma.auditLog.count({
      where: { entityType: "appointment", entityId: appointment!.id, action: "appointment.create" },
    });
    expect(audit).toBe(1);
  });

  it("prevents double-booking the same dentist+slot", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();

    await createAppointment(staffUser, {
      patientId: f.patient.id,
      serviceId: f.service.id,
      dentistId: f.dentistA.id,
      startsAt: startsAt.toISOString(),
    });

    await expect(
      createAppointment(staffUser, {
        patientId: f.patient.id,
        serviceId: f.service.id,
        dentistId: f.dentistA.id,
        startsAt: startsAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("allows a second dentist to take the same clock time", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();

    await createAppointment(staffUser, {
      patientId: f.patient.id,
      serviceId: f.service.id,
      dentistId: f.dentistA.id,
      startsAt: startsAt.toISOString(),
    });
    await expect(
      createAppointment(staffUser, {
        patientId: f.patient.id,
        serviceId: f.service.id,
        dentistId: f.dentistB.id,
        startsAt: startsAt.toISOString(),
      }),
    ).resolves.toBeTruthy();
  });

  it("rejects times outside clinic hours and past start times", async () => {
    const f = await seedBase();
    const { dayKeyFromNow } = await import("@/lib/datetime");
    const { localTimeToUTC } = await import("@/lib/datetime");
    const { site } = await import("@/lib/site");

    const late = localTimeToUTC(dayKeyFromNow(1, site.timeZone), 23 * 60, site.timeZone);
    await expect(
      createAppointment(staffUser, {
        patientId: f.patient.id,
        serviceId: f.service.id,
        dentistId: f.dentistA.id,
        startsAt: late.toISOString(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const past = new Date(Date.now() - 60 * 60_000).toISOString();
    await expect(
      createAppointment(staffUser, {
        patientId: f.patient.id,
        serviceId: f.service.id,
        dentistId: f.dentistA.id,
        startsAt: past,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("appointment status lifecycle", () => {
  it("only permits the documented transitions", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();
    const appointment = await createAppointment(staffUser, {
      patientId: f.patient.id,
      serviceId: f.service.id,
      dentistId: f.dentistA.id,
      startsAt: startsAt.toISOString(),
    });
    expect(appointment!.status).toBe("PENDING");
    expect(APPOINTMENT_TRANSITIONS.PENDING).toEqual(["CONFIRMED", "RESCHEDULED", "CANCELLED"]);
    expect(APPOINTMENT_TRANSITIONS.CANCELLED).toEqual([]);
    expect(APPOINTMENT_TRANSITIONS.COMPLETED).toEqual([]);
  });

  it("walks a valid lifecycle PENDING → CONFIRMED → COMPLETED", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();
    const appointment = await createAppointment(staffUser, {
      patientId: f.patient.id,
      serviceId: f.service.id,
      dentistId: f.dentistA.id,
      startsAt: startsAt.toISOString(),
    });

    const confirmed = await transitionAppointment(staffUser, appointment!.id, {
      status: "CONFIRMED",
    });
    expect(confirmed.status).toBe("CONFIRMED");

    const completed = await transitionAppointment(staffUser, appointment!.id, {
      status: "COMPLETED",
    });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).toBeInstanceOf(Date);

    const audit = await prisma.auditLog.findMany({
      where: { entityType: "appointment", entityId: appointment!.id },
      orderBy: { createdAt: "asc" },
      select: { action: true },
    });
    expect(audit.map((a) => a.action)).toEqual([
      "appointment.create",
      "appointment.confirmed",
      "appointment.completed",
    ]);
  });

  it("rejects invalid transitions and terminal states", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();
    const appointment = await createAppointment(staffUser, {
      patientId: f.patient.id,
      serviceId: f.service.id,
      dentistId: f.dentistA.id,
      startsAt: startsAt.toISOString(),
    });

    // Straight to NO_SHOW from PENDING is not allowed
    await expect(
      transitionAppointment(staffUser, appointment!.id, { status: "NO_SHOW" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await transitionAppointment(staffUser, appointment!.id, { status: "CONFIRMED" });
    await transitionAppointment(staffUser, appointment!.id, { status: "COMPLETED" });

    // COMPLETED is terminal
    await expect(
      transitionAppointment(staffUser, appointment!.id, { status: "CANCELLED" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("requires a reason when cancelling and stamps cancelledAt", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();
    const appointment = await createAppointment(staffUser, {
      patientId: f.patient.id,
      serviceId: f.service.id,
      dentistId: f.dentistA.id,
      startsAt: startsAt.toISOString(),
    });

    await expect(
      transitionAppointment(staffUser, appointment!.id, { status: "CANCELLED" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const cancelled = await transitionAppointment(staffUser, appointment!.id, {
      status: "CANCELLED",
      cancellationReason: "Patient had to travel",
    });
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).toBeInstanceOf(Date);
    expect(cancelled.cancellationReason).toBe("Patient had to travel");
  });
});

describe("rescheduling", () => {
  it("moves an appointment to a new bookable slot and marks it RESCHEDULED", async () => {
    const f = await seedBase();
    const first = await nextStartAtAt();
    const appointment = await createAppointment(staffUser, {
      patientId: f.patient.id,
      serviceId: f.service.id,
      dentistId: f.dentistA.id,
      startsAt: first.toISOString(),
    });

    const second = await nextStartAtAt({ minutesOfDay: 690 });
    const rescheduled = await rescheduleAppointment(staffUser, appointment!.id, {
      startsAt: second.toISOString(),
    });
    expect(rescheduled.status).toBe("RESCHEDULED");
    expect(rescheduled.startsAt.toISOString()).toBe(second.toISOString());
  });

  it("blocks rescheduling into an occupied slot or past a terminal state", async () => {
    const f = await seedBase();
    const t1 = await nextStartAtAt();
    const a1 = await createAppointment(staffUser, {
      patientId: f.patient.id,
      serviceId: f.service.id,
      dentistId: f.dentistA.id,
      startsAt: t1.toISOString(),
    });

    const t2 = await nextStartAtAt({ minutesOfDay: 690 });
    await createAppointment(staffUser, {
      patientId: f.patient.id,
      serviceId: f.service.id,
      dentistId: f.dentistA.id,
      startsAt: t2.toISOString(),
    });

    // a1 → try to move into a2's slot (occupied)
    await expect(
      rescheduleAppointment(staffUser, a1!.id, { startsAt: t2.toISOString() }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // CANCELLED appointments cannot be rescheduled
    await transitionAppointment(staffUser, a1!.id, {
      status: "CANCELLED",
      cancellationReason: "test",
    });
    await expect(
      rescheduleAppointment(staffUser, a1!.id, { startsAt: t1.toISOString() }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("appointment listing", () => {
  it("lists appointments with status and date filters", async () => {
    const f = await seedBase();
    const t = await nextStartAtAt();
    await createAppointment(staffUser, {
      patientId: f.patient.id,
      serviceId: f.service.id,
      dentistId: f.dentistA.id,
      startsAt: t.toISOString(),
    });

    const all = await listAppointments(staffUser, {});
    expect(all.length).toBe(1);

    const pending = await listAppointments(staffUser, { status: "PENDING" });
    expect(pending).toHaveLength(1);

    const cancelled = await listAppointments(staffUser, { status: "CANCELLED" });
    expect(cancelled).toHaveLength(0);

    const byDentist = await listAppointments(staffUser, { dentistId: f.dentistB.id });
    expect(byDentist).toHaveLength(0);

    const byPatient = await listAppointments(staffUser, { patientId: f.patient.id });
    expect(byPatient).toHaveLength(1);
  });
});