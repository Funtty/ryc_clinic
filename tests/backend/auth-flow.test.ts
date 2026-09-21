import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/server/password";
import { loginWithPassword } from "@/lib/server/auth";
import {
  createSession,
  destroySession,
  resolveSession,
} from "@/lib/server/session";
import { createService } from "@/lib/server/services";
import { createDentist } from "@/lib/server/dentists";
import { updateClinicHours, listAuditLogs } from "@/lib/server/admin";
import { AppError } from "@/lib/server/errors";
import { cleanDb, staffUser, adminUser } from "../helpers/backend";

const ADMIN_EMAIL = "admin@ryc.example";
const ADMIN_PW = "Correct-Horse-1234";

async function seedUsers() {
  const passHash = await hashPassword(ADMIN_PW);
  await prisma.user.createMany({
    data: [
      {
        id: adminUser.id,
        email: ADMIN_EMAIL,
        name: "Admin Tester",
        passwordHash: passHash,
        role: "ADMIN",
      },
      {
        id: staffUser.id,
        email: "staff@ryc.example",
        name: "Staff Tester",
        passwordHash: passHash,
        role: "STAFF",
      },
    ],
  });
}

async function expectAppError(promise: Promise<unknown>, status: number, code: string) {
  try {
    await promise;
    throw new Error("Expected an AppError to be thrown");
  } catch (e) {
    const err = e as AppError;
    if (!(err instanceof AppError) || err.status !== status || err.code !== code) {
      throw e;
    }
  }
}

async function captureError(promise: Promise<unknown>): Promise<AppError | null> {
  try {
    await promise;
    return null;
  } catch (e) {
    return e as AppError;
  }
}

describe("authentication", () => {
  beforeEach(async () => {
    await cleanDb();
    await seedUsers();
  });

  it("rejects an unknown email and a wrong password identically (401, same message)", async () => {
    const wrong = await captureError(
      loginWithPassword(ADMIN_EMAIL, "nope-nope"),
    );
    const unknown = await captureError(
      loginWithPassword("ghost@ryc.example", "whatever"),
    );

    expect(wrong).toBeInstanceOf(AppError);
    expect(unknown).toBeInstanceOf(AppError);
    expect(wrong?.status).toBe(401);
    expect(unknown?.status).toBe(401);
    expect(wrong?.message).toBe(unknown?.message);
    expect(wrong?.message).toContain("Incorrect email or password");
  });

  it("rejects a disabled account with 403", async () => {
    await prisma.user.update({
      where: { id: staffUser.id },
      data: { isActive: false },
    });
    await expectAppError(
      loginWithPassword("staff@ryc.example", ADMIN_PW),
      403,
      "FORBIDDEN",
    );
  });

  it("signs in an active admin, starts a session, stamps lastLoginAt and audits", async () => {
    const { token, user } = await loginWithPassword(
      ADMIN_EMAIL,
      ADMIN_PW,
      { userAgent: "vitest" },
    );

    expect(user.email).toBe(ADMIN_EMAIL);
    expect(user.role).toBe("ADMIN");

    const resolved = await resolveSession(token);
    expect(resolved.id).toBe(adminUser.id);

    const stored = await prisma.user.findUnique({ where: { id: adminUser.id } });
    expect(stored?.lastLoginAt).toBeInstanceOf(Date);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "auth.login", entityType: "user" },
    });
    expect(audit?.entityId).toBe(adminUser.id);
  });

  it("is case/whitespace insensitive on email and rejects empty input", async () => {
    const { user } = await loginWithPassword("  ADMIN@Ryc.Example ", ADMIN_PW);
    expect(user.email).toBe(ADMIN_EMAIL);

    await expectAppError(loginWithPassword("", "x"), 422, "VALIDATION");
    await expectAppError(loginWithPassword(undefined, undefined), 422, "VALIDATION");
  });

  it("destroys a session token so it can no longer resolve", async () => {
    const token = await createSession(adminUser.id);
    expect((await resolveSession(token)).id).toBe(adminUser.id);

    await destroySession(token);
    await expectAppError(resolveSession(token), 401, "UNAUTHORIZED");
  });
});

describe("role-based authorization", () => {
  beforeEach(async () => {
    await cleanDb();
    // Audit writes carry a userId; create matching user rows so FK holds.
    await prisma.user.createMany({
      data: [
        {
          id: adminUser.id,
          email: "admin@ryc.example",
          name: "Admin Tester",
          passwordHash: "x",
          role: "ADMIN",
        },
        {
          id: staffUser.id,
          email: "staff@ryc.example",
          name: "Staff Tester",
          passwordHash: "x",
          role: "STAFF",
        },
      ],
    });
  });

  it("blocks staff from creating services (config is admin-only)", async () => {
    await expectAppError(
      createService(staffUser, {
        name: "Teeth whitening",
        shortDescription: "test",
        description: "A longer description for the test service",
        durationMinutes: 60,
      }),
      403,
      "FORBIDDEN",
    );
  });

  it("allows admin to create a service and then staff to list it", async () => {
    const service = await createService(adminUser, {
      name: "Teeth whitening",
      shortDescription: "Test",
      description: "A longer description for the test service",
      durationMinutes: 60,
      price: 80000,
    });
    expect(service.slug).toBe("teeth-whitening");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "service.create" },
    });
    expect(audit?.entityId).toBe(service.id);
  });

  it("blocks staff from creating dentists", async () => {
    await expectAppError(
      createDentist(staffUser, {
        name: "Dr. New",
        title: "General Dentist",
        bio: "A valid bio long enough to pass validation.",
      }),
      403,
      "FORBIDDEN",
    );
  });

  it("blocks staff from editing clinic hours", async () => {
    const hours = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      openMinutes: 480,
      closeMinutes: 1020,
      isClosed: false,
    }));
    await expectAppError(updateClinicHours(staffUser, hours), 403, "FORBIDDEN");
  });

  it("blocks staff from reading the audit log", async () => {
    await expectAppError(listAuditLogs(staffUser, {}), 403, "FORBIDDEN");
  });

  it("allows an admin to read the audit log", async () => {
    await createService(adminUser, {
      name: "Whitening",
      shortDescription: "Test",
      description: "A longer description for the test service",
      durationMinutes: 30,
    });
    const { rows, total } = await listAuditLogs(adminUser, { action: "service.create" });
    expect(total).toBe(1);
    expect(rows[0]?.user?.id).toBe(adminUser.id);
  });
});