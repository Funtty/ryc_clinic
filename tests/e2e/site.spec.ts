import { test, expect } from "@playwright/test";

const ROUTES = [
  "/",
  "/services",
"/services/dentures",
  "/team",
  "/about",
  "/contact",
  "/booking",
  "/faq",
];

test.describe("site health", () => {
  test("every internal link on major routes returns a working page", async ({
    request,
    page,
  }) => {
    const links = new Set<string>();

    for (const path of ROUTES) {
      await page.goto(path, { waitUntil: "load" });
      const found = await page.locator("a[href]").evaluateAll((anchors) =>
        anchors
          .map((a) => a.getAttribute("href") ?? "")
          .filter((href) => href.startsWith("/"))
          .map((href) => href.split("#")[0].split("?")[0])
          .filter(Boolean),
      );
      for (const link of found) links.add(link);
    }

    expect(links.size).toBeGreaterThan(5);
    for (const link of links) {
      const res = await request.get(link);
      expect(
        res.status(),
        `internal link "${link}" (status ${res.status()})`,
      ).toBeLessThan(400);
    }
  });

  test("no console errors or page errors on any route", async ({ page }) => {
    for (const path of ROUTES) {
      const consoleErrors: string[] = [];
      const pageErrors: Error[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => pageErrors.push(err));

      await page.goto(path, { waitUntil: "load" });
      const pageAlreadyLoaded = await page.evaluate(() => document.title);
      expect(pageAlreadyLoaded.length).toBeGreaterThan(0);
      expect(pageErrors, `${path} page errors`).toEqual([]);
      expect(consoleErrors, `${path} console errors`).toEqual([]);
    }
  });

  test("every route links to a booking call to action", async ({ page }) => {
    for (const path of ROUTES) {
      await page.goto(path, { waitUntil: "load" });
      const count = await page.locator('a[href="/booking"]').count();
      expect(count, `${path} booking CTA`).toBeGreaterThanOrEqual(1);
    }
  });
});

test.describe("keyboard accessibility", () => {
  test("skip link is first in tab order and jumps to main content", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBe("A");
    const label = await page.evaluate(() => document.activeElement?.textContent);
    expect(label).toBe("Skip to main content");

    await page.keyboard.press("Enter");
    await page.waitForURL(/main-content/);
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe("#main-content");
  });

  test("header tab order reaches the logo then primary navigation", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const focused: (string | null)[] = [];
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press("Tab");
      focused.push(
        await page.evaluate(() => document.activeElement?.getAttribute("href") ?? document.activeElement?.textContent?.trim() ?? null),
      );
    }
    expect(focused[0], `first tab stop ${JSON.stringify(focused)}`).toBe("#main-content");
    const logoIndex = focused.findIndex((href) => href === "/");
    expect(logoIndex, `logo in tab order ${JSON.stringify(focused)}`).toBeGreaterThan(0);
    const navAfterLogo = focused.slice(logoIndex + 1);
    const expectedNav = ["/", "/services", "/team", "/about", "/faq", "/contact"];
    for (const [i, href] of expectedNav.entries()) {
      expect(navAfterLogo[i], `${href} nav link tab order ${JSON.stringify(focused)}`).toBe(href);
    }
  });

  test("FAQ items open and close with the keyboard", async ({ page }) => {
    await page.goto("/faq", { waitUntil: "load" });
    const first = page.locator("details summary").first();
    await first.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("details").first()).toHaveAttribute("open", /.*/);
    await page.keyboard.press("Enter");
    await expect(page.locator("details").first()).not.toHaveAttribute("open", /.*/);
  });
});

test.describe("contact form", () => {
  test("shows validation errors for an empty submission", async ({ page }) => {
    await page.goto("/contact", { waitUntil: "load" });
    await page.getByRole("button", { name: /send message/i }).click();
    await expect(page.locator(".field-error-text")).toHaveCount(4);
    await expect(page.locator(".field-error-text").first()).toBeVisible();
  });

  test("accepts a valid message and shows the clearly-marked placeholder response", async ({
    page,
  }) => {
    await page.goto("/contact", { waitUntil: "load" });
    await page.locator("#contact-name").fill("Ada Johnson");
    await page.locator("#contact-email").fill("ada@example.com");
    await page.locator("#contact-topic").selectOption({ label: "A treatment question" });
    await page.locator("#contact-message").fill("I would like to understand more about whitening.");
    await page.getByRole("button", { name: /send message/i }).click();
    await expect(page.getByText("Message received — thank you")).toBeVisible();
    await expect(page.getByText(/next build phase/i)).toBeVisible();
    await expect(page.getByRole("status").getByRole("link", { name: /234/ })).toBeVisible();
  });

  test("rejects an invalid email", async ({ page }) => {
    await page.goto("/contact", { waitUntil: "load" });
    await page.locator("#contact-name").fill("Ada Johnson");
    await page.locator("#contact-email").fill("not-an-email");
    await page.locator("#contact-topic").selectOption({ label: "Something else" });
    await page.locator("#contact-message").fill("A long enough message to pass validation here.");
    await page.getByRole("button", { name: /send message/i }).click();
    await expect(page.getByText("Please enter a valid email address")).toBeVisible();
  });
});

test.describe("mobile navigation", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("mobile menu shows FAQ link and closes on selection", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await page.getByRole("button", { name: /menu/i }).click();
    const menu = page.locator("#mobile-menu");
    await expect(menu).toBeVisible();
    await expect(menu.locator("a[href='/faq']")).toBeVisible();
    await menu.locator("a[href='/services']").click();
    await expect(page).toHaveURL(/\/services$/);
  });
});

test.describe("structured data", () => {
  test("home declares MedicalClinic structured data with phone and address", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toContain("MedicalClinic");
    expect(ld).toContain("PostalAddress");
  });

  test("service detail declares a Service offer", async ({ page }) => {
    await page.goto("/services/dentures", { waitUntil: "load" });
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toContain('"@type":"Service"');
    expect(ld).toContain("InStock");
  });

  test("faq page declares FAQPage schema", async ({ page }) => {
    await page.goto("/faq", { waitUntil: "load" });
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toContain("FAQPage");
  });
});