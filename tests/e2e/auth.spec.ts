import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@ryc-dental.example";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMe-1234";
const STAFF_EMAIL = process.env.STAFF_EMAIL ?? "staff@ryc-dental.example";
const STAFF_PASSWORD = process.env.STAFF_PASSWORD ?? "ChangeMe-4567";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/ryc_login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({
    timeout: 60_000,
  });
}

test.describe("authentication", () => {
  test("login page shows the restricted sign-in card", async ({ page }) => {
    await page.goto("/ryc_login");
    await expect(page).toHaveTitle(/Staff sign in/);
    await expect(
      page.getByRole("heading", { name: "Staff sign in" }),
    ).toBeVisible();
    await expect(page.locator("#login-email")).toBeVisible();
  });

  test("wrong credentials show a clear error and stay on /ryc_login", async ({ page }) => {
    await page.goto("/ryc_login");
    await page.locator("#login-email").fill("admin@ryc-dental.example");
    await page.locator("#login-password").fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Incorrect email or password")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/\/ryc_login$/);
  });

  test("unauthenticated admin pages redirect to the login page", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL("**/ryc_login");
  });

  test("unauthenticated API requests are rejected with 401", async ({ request }) => {
    const me = await request.get("/api/auth/me");
    expect(me.status()).toBe(401);
    const services = await request.get("/api/admin/services");
    expect(services.status()).toBe(401);
  });
});

test.describe("receptionist access", () => {
  test("receptionist sign-in works and dashboard is reachable", async ({ page }) => {
    await signIn(page, STAFF_EMAIL, STAFF_PASSWORD);

    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Appointments" }),
    ).toBeVisible();
    // Config + audit are admin-only and must not leak into the staff nav.
    await expect(page.getByRole("link", { name: "Staff users" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);
  });

  test("receptionist cannot open admin-only pages (server-enforced)", async ({ page }) => {
    await signIn(page, STAFF_EMAIL, STAFF_PASSWORD);

    for (const path of [
      "/admin/services",
      "/admin/dentists",
      "/admin/schedule",
      "/admin/users",
      "/admin/audit",
    ]) {
      await page.goto(path);
      await expect(
        page.getByText("You don't have access to this area"),
      ).toBeVisible();
    }
  });

  test("receptionist is forbidden from admin-only APIs (403)", async ({ page }) => {
    await signIn(page, STAFF_EMAIL, STAFF_PASSWORD);
    const api = page.context().request;

    const users = await api.get("/api/admin/users");
    expect(users.status()).toBe(403);
    const audit = await api.get("/api/admin/audit");
    expect(audit.status()).toBe(403);
    const createService = await api.post("/api/admin/services", {
      data: {},
    });
    expect(createService.status()).toBe(403);
    const createDentist = await api.post("/api/admin/dentists", {
      data: {},
    });
    expect(createDentist.status()).toBe(403);
  });
});

test.describe("administrator access", () => {
  test("administrator reaches config pages and the audit log", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    for (const [path, heading] of [
      ["/admin/appointments", "Appointments"],
      ["/admin/patients", "Patients"],
      ["/admin/services", "Services"],
      ["/admin/dentists", "Dentists"],
      ["/admin/schedule", "Schedule"],
      ["/admin/users", "Staff users"],
      ["/admin/audit", "Audit log"],
    ] as const) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: heading, level: 1 }),
      ).toBeVisible();
    }
  });

  test("sign out clears the session and returns to /ryc_login", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const signOut = page.getByRole("button", { name: "Sign out" });
    // Retry the click until the client component has hydrated and navigated.
    await expect(async () => {
      await signOut.click();
      await expect(page).toHaveURL(/\/ryc_login/, { timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    await expect(
      page.getByRole("heading", { name: "Staff sign in" }),
    ).toBeVisible({ timeout: 45_000 });

    await page.goto("/admin");
    await page.waitForURL("**/ryc_login");
    const me = await page.context().request.get("/api/auth/me");
    expect(me.status()).toBe(401);
  });
});