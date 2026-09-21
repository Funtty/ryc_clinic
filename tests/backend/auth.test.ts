import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import {
  createSession,
  resolveSession,
  destroySession,
  tokenMatches,
} from "@/lib/server/session";
import { assertRole, isRole, requireAdmin, requireStaff } from "@/lib/server/guards";
import { errors } from "@/lib/server/errors";
import { cleanDb } from "../helpers/backend";

beforeEach(cleanDb);

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("server sessions", () => {
  it("creates a session whose token resolves to the user, and destroys it", async () => {
    const user = await prisma.user.create({
      data: {
        email: "a@ryc.example",
        name: "A",
        passwordHash: "x",
        role: "STAFF",
      },
    });
    const token = await createSession(user.id);
    const resolved = await resolveSession(token);
    expect(resolved.email).toBe("a@ryc.example");
    expect(resolved.role).toBe("STAFF");
    expect(resolved).not.toHaveProperty("passwordHash");

    await destroySession(token);
    await expect(resolveSession(token)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unknown and expired tokens", async () => {
    await expect(resolveSession("not-a-real-token")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects sessions for disabled users", async () => {
    const user = await prisma.user.create({
      data: {
        email: "off@ryc.example",
        name: "Off",
        passwordHash: "x",
        role: "STAFF",
        isActive: false,
      },
    });
    const token = await createSession(user.id);
    await expect(resolveSession(token)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("compares tokens in constant time", () => {
    expect(tokenMatches("abcdef", "abcdef")).toBe(true);
    expect(tokenMatches("abcdef", "abcdeg")).toBe(false);
    expect(tokenMatches("abcdef", "abc")).toBe(false);
  });
});

describe("authorization guards", () => {
  const staff = { id: "s", email: "s@x", name: "S", role: "STAFF", isActive: true };
  const admin = { id: "a", email: "a@x", name: "A", role: "ADMIN", isActive: true };

  it("grants staff to staff endpoints and blocks admin-only", () => {
    expect(isRole(staff, ["ADMIN", "STAFF"])).toBe(true);
    expect(() => requireStaff(staff)).not.toThrow();
    expect(() => requireAdmin(staff)).toThrowError(errors.forbidden());
  });

  it("allows admins everywhere", () => {
    expect(() => requireStaff(admin)).not.toThrow();
    expect(() => requireAdmin(admin)).not.toThrow();
  });

  it("assertRole rejects users outside the allowed set", () => {
    expect(() => assertRole(staff, ["ADMIN"])).toThrowError(errors.forbidden());
  });
});