import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPublicBooking } from "@/lib/server/public-booking";
import {
  seedBase,
  cleanDb,
  nextStartAtAt,
  DEFAULT_EMAIL,
} from "../helpers/backend";

/**
 * Patient-facing, credential-less booking. No session: the server runs the same
 * availability engine the staff do (schedules, clinic hours, blocked dates) and
 * re-checks the exact dentist + slot inside the save transaction, so two
 * patients who click at the same instant can never both win the same slot.
 */
function request(
  f: Awaited<ReturnType<typeof seedBase>>,
  startsAt: Date,
  overrides: Record<string, unknown> = {},
) {
  return {
    serviceId: f.service.id,
    startsAt: startsAt.toISOString(),
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: "+234 800 222 3333",
    ...overrides,
  };
}

describe("public booking — happy path", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it("books a PENDING appointment, generates a reference, pins the first free dentist and stores patient contact details", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();

    const created = await createPublicBooking(request(f, startsAt));

    expect(created.reference).toMatch(/^RYC-[0-9A-F]{6}$/);
    expect(created.status).toBe("PENDING");
    expect(created.dentist?.id).toBe(f.dentistA.id);
    expect(created.service.id).toBe(f.service.id);
    expect(created.durationMinutes).toBe(f.service.durationMinutes);
    expect(
      new Date(created.endsAt).getTime() -
        new Date(created.startsAt).getTime(),
    ).toBe(f.service.durationMinutes * 60_000);
    expect(created.patient.email).toBe("ada@example.com");

    const row = await prisma.appointment.findUnique({
      where: { reference: created.reference },
      select: {
        status: true,
        dentistId: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
      },
    });
    expect(row?.status).toBe("PENDING");
    expect(row?.dentistId).toBe(f.dentistA.id);
    expect(row?.contactName).toBe("Ada Lovelace");
    expect(row?.contactEmail).toBe("ada@example.com");
  });

  it("reuses the same patient by email instead of creating a duplicate", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();

    await createPublicBooking(request(f, startsAt, { email: DEFAULT_EMAIL }));

    const count = await prisma.patient.count({
      where: { email: DEFAULT_EMAIL },
    });
    expect(count).toBe(1);
  });
});

describe("public booking — slot protection", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it("rejects a second patient taking the same dentist + slot", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();

    await createPublicBooking(
      request(f, startsAt, { dentistId: f.dentistA.id }),
    );

    await expect(
      createPublicBooking(
        request(f, startsAt, { dentistId: f.dentistA.id }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("allows the same clock time on a different dentist", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();

    await createPublicBooking(
      request(f, startsAt, { dentistId: f.dentistA.id }),
    );

    await expect(
      createPublicBooking(
        request(f, startsAt, { dentistId: f.dentistB.id }),
      ),
    ).resolves.toBeTruthy();
  });

  it("rejects a service the dentist does not offer", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();

    const otherService = await prisma.service.create({
      data: {
        id: "service-crown",
        slug: "crown",
        name: "Crown Fitting",
        shortDescription: "test",
        description: "test",
        durationMinutes: 90,
        price: 120000,
        isActive: true,
      },
    });

    await expect(
      createPublicBooking(
        request(f, startsAt, {
          serviceId: otherService.id,
          dentistId: f.dentistA.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects a start time in the past", async () => {
    const f = await seedBase();
    const past = new Date(Date.now() - 60 * 60_000);

    await expect(
      createPublicBooking(request(f, past)),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
