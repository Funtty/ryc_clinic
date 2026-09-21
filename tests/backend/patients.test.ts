import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
} from "@/lib/server/patients";
import { cleanDb, seedBase, staffUser } from "../helpers/backend";

beforeEach(cleanDb);

describe("patient data access (staff-only)", () => {
  it("creates, reads and updates a patient with audit trail", async () => {
    await seedBase();
    const created = await createPatient(staffUser, {
      email: "new.patient@ryc.example",
      firstName: "Chike",
      lastName: "Okafor",
      phone: "+234 811 111 1111",
      notes: "Mild anxiety",
    });
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    const stored = await getPatient(staffUser, created.id);
    expect(stored.firstName).toBe("Chike");

    const firstUpdated = stored.updatedAt;
    const updated = await updatePatient(staffUser, created.id, {
      lastName: "Okafor-Obi",
    });
    expect(updated.lastName).toBe("Okafor-Obi");
    expect(updated.updatedAt.getTime()).toBeGreaterThan(firstUpdated.getTime());

    const audit = await prisma.auditLog.count({
      where: { entityType: "patient", entityId: created.id },
    });
    expect(audit).toBe(2);
  });

  it("enforces validation and blocks duplicate emails", async () => {
    await seedBase();
    await expect(
      createPatient(staffUser, {
        email: "oops",
        firstName: "A",
        lastName: "B",
        phone: "123",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const payload = {
      email: "dup@ryc.example",
      firstName: "A",
      lastName: "B",
      phone: "+234 800 000 0001",
    };
    await createPatient(staffUser, payload);
    await expect(createPatient(staffUser, payload)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("searches patients by name, email or phone", async () => {
    await seedBase();
    await createPatient(staffUser, {
      email: "bola@ryc.example",
      firstName: "Bola",
      lastName: "Dare",
      phone: "+234 800 000 0002",
    });

    const byName = await listPatients(staffUser, "Dare");
    expect(byName.some((p) => p.email === "bola@ryc.example")).toBe(true);

    const byEmail = await listPatients(staffUser, "bola@ryc.example");
    expect(byEmail).toHaveLength(1);

    const all = await listPatients(staffUser);
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects patient access from unauthenticated/non-staff callers", async () => {
    await expect(
      listPatients({ ...staffUser, role: "PATIENT" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});