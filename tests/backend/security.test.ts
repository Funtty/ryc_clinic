import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { loginWithPassword } from "@/lib/server/auth";
import { hashPassword } from "@/lib/server/password";
import { toAppError, errors } from "@/lib/server/errors";
import { checkRateLimit, resetRateLimiter, clientIp } from "@/lib/server/rate-limit";
import {
  enabledProviderId,
  assertProviderUsable,
} from "@/lib/server/payments/config";
import { createPublicBooking } from "@/lib/server/public-booking";
import { createBookingSchema } from "@/lib/server/validators";
import { createSession, resolveSession } from "@/lib/server/session";
import { toEmbeddedJson } from "@/lib/utils";
import { cleanDb, seedBase, nextStartAtAt } from "../helpers/backend";

beforeEach(async () => {
  await cleanDb();
  resetRateLimiter();
});

describe("internal error handling", () => {
  it("never leaks raw internal error messages to clients", () => {
    const translated = toAppError(new Error("db password is k3yboard-cat"));
    expect(translated.code).toBe("INTERNAL");
    expect(translated.status).toBe(500);
    expect(translated.message).not.toContain("k3yboard-cat");
    expect(translated.message).toContain("Something went wrong");
  });

  it("maps known AppError codes without rewriting them", () => {
    const auth = errors.unauthorized("Incorrect email or password.");
    expect(toAppError(auth)).toBe(auth);
    expect(toAppError(errors.tooManyRequests()).status).toBe(429);
  });
});

describe("embedding safe JSON for JSON-LD", () => {
  it("escapes the HTML-significant characters and line/paragraph separators", () => {
    const html = "<script>alert('x')</script> & \"quotes\"";
    const out = toEmbeddedJson({ a: html });
    expect(out).not.toContain("<script>");
    // Escaper emits lower-case hex escapes (\u003c, \u002f …).
    expect(out).toContain("\\u003cscript\\u003e");
    expect(out).toContain("\\u0026");
    expect(toEmbeddedJson({ s: "\u2028\u2029" })).toContain("\\u2028\\u2029");
  });

  it("passes harmless JSON through unchanged (except HTML entities)", () => {
    const out = toEmbeddedJson({ name: "RYC Dental", visits: 42 });
    expect(JSON.parse(out)).toMatchObject({ name: "RYC Dental", visits: 42 });
  });
});

describe("rate limiting", () => {
  it("rejects once the window limit is exceeded and resets", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("ip:1.2.3.4", { limit: 3, windowMs: 60_000 });
    }
    expect(() =>
      checkRateLimit("ip:1.2.3.4", { limit: 3, windowMs: 60_000 }),
    ).toThrowError(
      expect.objectContaining({ code: "RATE_LIMITED", status: 429 }),
    );
    resetRateLimiter();
    expect(() =>
      checkRateLimit("ip:1.2.3.4", { limit: 3, windowMs: 60_000 }),
    ).not.toThrow();
  });

  it("keeps separate windows per key", () => {
    checkRateLimit("a", { limit: 1, windowMs: 60_000 });
    expect(() =>
      checkRateLimit("b", { limit: 1, windowMs: 60_000 }),
    ).not.toThrow();
  });

  it("extracts the first hop of x-forwarded-for", () => {
    const req = { headers: new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }) };
    expect(clientIp(req)).toBe("203.0.113.5");
    expect(clientIp({ headers: new Headers() })).toBe("unknown");
  });
});

describe("payment provider selection", () => {
  it("refuses the simulate provider in production", () => {
    expect(() => assertProviderUsable("simulate", "production")).toThrowError(
      expect.objectContaining({ code: "INTERNAL" }),
    );
    expect(() => assertProviderUsable("paystack", "production")).not.toThrow();
  });

  it("allows simulate outside production", () => {
    expect(() => assertProviderUsable("simulate", "development")).not.toThrow();
    expect(enabledProviderId()).toBe("simulate");
  });
});

describe("deposit creation", () => {
  it("stamps a CSPRNG payment reference and an expiry on every deposit", async () => {
    const f = await seedBase();
    const startsAt = await nextStartAtAt();
    const booking = await createPublicBooking({
      serviceId: f.service.id,
      startsAt: startsAt.toISOString(),
      firstName: "Bea",
      lastName: "Safe",
      email: "bea.safe@example.com",
      phone: "+2348090000000",
    });
    expect(booking.deposit?.paymentRef).toMatch(/^PAY-[0-9A-F]{12}$/);
    // Two distinct bookings never share a payment reference (CSPRNG, not time).
    const startsAt2 = await nextStartAtAt();
    const booking2 = await createPublicBooking({
      serviceId: f.service.id,
      startsAt: startsAt2.toISOString(),
      firstName: "Cal",
      lastName: "Safe",
      email: "cal.safe@example.com",
      phone: "+2348090000001",
    });
    expect(booking2.deposit?.paymentRef).toMatch(/^PAY-[0-9A-F]{12}$/);
    expect(booking2.deposit?.paymentRef).not.toBe(booking.deposit?.paymentRef);

    const row = await prisma.payment.findUnique({
      where: { id: booking.deposit!.paymentId },
    });
    expect(row?.expiresAt).toBeInstanceOf(Date);
    expect(row!.expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("booking horizon", () => {
  it("rejects a booking more than 90 days out", () => {
    const far = new Date(Date.now() + 91 * 24 * 60 * 60 * 1000);
    const result = createBookingSchema.safeParse({
      serviceId: "service_1",
      startsAt: far,
      email: "a@b.com",
      firstName: "A",
      lastName: "B",
      phone: "+2348000000000",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.flatten())).toContain("90 days");
    }
  });

  it("accepts a booking within 90 days and rejects past times", () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    const ok = createBookingSchema.safeParse({
      serviceId: "service_1",
      startsAt: soon,
      email: "a@b.com",
      firstName: "A",
      lastName: "B",
      phone: "+2348000000000",
    });
    expect(ok.success).toBe(true);
    const past = createBookingSchema.safeParse({
      serviceId: "service_1",
      startsAt: new Date(Date.now() - 1000),
      email: "a@b.com",
      firstName: "A",
      lastName: "B",
      phone: "+2348000000000",
    });
    expect(past.success).toBe(false);
  });
});

describe("session idle timeout", () => {
  it("rejects a session idle past the inactivity bound", async () => {
    const user = await prisma.user.create({
      data: {
        email: "idle@ryc.example",
        name: "Idle",
        passwordHash: "x",
        role: "STAFF",
      },
    });
    const token = await createSession(user.id);
    /* Simulate long inactivity: session opened 20h ago, last seen 13h ago —
       past the 12h idle bound but inside the 30d absolute lifetime. */
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: {
        createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
        lastSeenAt: new Date(Date.now() - 13 * 60 * 60 * 1000),
      },
    });
    await expect(resolveSession(token)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("refreshes activity for a recently seen session and keeps it alive", async () => {
    const user = await prisma.user.create({
      data: {
        email: "active@ryc.example",
        name: "Active",
        passwordHash: "x",
        role: "STAFF",
      },
    });
    const token = await createSession(user.id);
    /* 10 min idle — under the 12h idle max, so it must still resolve. */
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { lastSeenAt: new Date(Date.now() - 10 * 60 * 1000) },
    });
    const resolved = await resolveSession(token);
    expect(resolved.email).toBe("active@ryc.example");
  });
});

describe("failed login auditing", () => {
  it("audits failed attempts with the identifier and a client IP", async () => {
    await prisma.user.create({
      data: {
        email: "victim@ryc.example",
        name: "Victim",
        passwordHash: await hashPassword("correct-password"),
        role: "STAFF",
      },
    });
    await expect(
      loginWithPassword("victim@ryc.example", "wrong-password", {
        ip: "198.51.100.7",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const log = await prisma.auditLog.findFirst({
      where: { action: "auth.login.failed" },
    });
    expect(log).not.toBeNull();
    expect(log!.ip).toBe("198.51.100.7");
    expect(JSON.parse(log!.meta)).toEqual({ email: "victim@ryc.example" });
  });

  it("does not audit password hashes or secrets anywhere", async () => {
    await expect(
      loginWithPassword("nonexistent@ryc.example", "secret-value", {
        ip: "198.51.100.8",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const logs = await prisma.auditLog.findMany();
    for (const l of logs) {
      expect(l.meta).not.toContain("secret-value");
    }
  });
});