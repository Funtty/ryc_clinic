import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@ryc-dental.example";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMe-1234";

const VIEWPORTS = [
  { name: "320", width: 320, height: 800 },
  { name: "375", width: 375, height: 812 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
];

const ADMIN_ROUTES = [
  { path: "/admin", label: "overview" },
  { path: "/admin/calendar", label: "calendar" },
  { path: "/admin/appointments", label: "appointments" },
  { path: "/admin/patients", label: "patients" },
  { path: "/admin/services", label: "services" },
  { path: "/admin/dentists", label: "dentists" },
  { path: "/admin/schedule", label: "schedule" },
  { path: "/admin/users", label: "users" },
  { path: "/admin/audit", label: "audit" },
  { path: "/admin/appointments/new", label: "new-appointment" },
];

async function signIn(page: Page) {
  await page.goto("/ryc_login");
  await page.locator("#login-email").fill(ADMIN_EMAIL);
  await page.locator("#login-password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({
    timeout: 60_000,
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow, `horizontal overflow of ${overflow}px`).toBeLessThanOrEqual(0);
}

async function expectNoBrokenImages(page: Page) {
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll("img")]
      .filter((img) => !img.src.endsWith(".svg"))
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => img.getAttribute("src") ?? "(no src)"),
  );
  expect(broken, `broken images: ${broken.join(", ")}`).toEqual([]);
}

test.describe("admin console responsive design", () => {
  for (const vp of VIEWPORTS) {
    test.describe(`viewport ${vp.name}px`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("all console pages render without overflow or broken images", async ({ page }) => {
        await signIn(page);
        for (const route of ADMIN_ROUTES) {
          await page.goto(route.path, { waitUntil: "load" });
          await expectNoHorizontalOverflow(page);
          await expectNoBrokenImages(page);
          await page
            .locator("html")
            .screenshot({ path: `tests/e2e/screens/admin/${vp.name}/${route.label}.png` });
        }
      });
    });
  }
});

test.describe("admin console accessibility", () => {
  test("key text has WCAG AA contrast on its background", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/appointments");

    const samples = await page.evaluate(() => {
      const num = (v: string) => (v.match(/[\d.]+/g) ?? []).map(Number);
      const lum = (c: string) => {
        const [r, g, b] = num(c);
        const lin = [r, g, b]
          .map((v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : Math.pow((v / 255 + 0.055) / 1.055, 2.4)));
        return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
      };
      const ratio = (bg: string, fg: string) => {
        const l1 = Math.max(lum(bg), lum(fg));
        const l2 = Math.min(lum(bg), lum(fg));
        return (l1 + 0.05) / (l2 + 0.05);
      };
const probe = (sel: string) => {
          const node: Element | null = document.querySelector(sel);
        if (!node) return null;
        const sx = getComputedStyle(node);
        const isSolid = (bg: string) =>
          /^rgb\(/.test(bg) ||
          (/^rgba\(/.test(bg) && bg !== "rgba(0, 0, 0, 0)");
        let bg = sx.backgroundColor;
        let parent: Element | null = node.parentElement;
        while (parent && !isSolid(bg)) {
          bg = getComputedStyle(parent).backgroundColor;
          parent = parent.parentElement;
        }
        if (!isSolid(bg)) return null;
        return Number(ratio(bg, sx.color).toFixed(2));
      };
      return {
        body: probe("body"),
        heading: probe("h1"),
        appointmentLink: probe('a[href^="/admin/appointments/"]'),
      };
    });

    for (const [label, value] of Object.entries(samples)) {
      expect(value, `${label} has evaluable contrast`).not.toBeNull();
      expect(value!, `${label} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("reduced motion disables smooth scrolling and fast-forwards animations", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });

    const scrollBehavior = await page.evaluate(() =>
      getComputedStyle(document.documentElement).scrollBehavior,
    );
    expect(scrollBehavior).toBe("auto");

    const animationMs = await page.evaluate(() => {
      const el = document.querySelector('[class*="animate-fade-up"]');
      if (!el) return null;
      const d = getComputedStyle(el).animationDuration;
      return parseFloat(d) * 1000;
    });
    if (animationMs !== null) {
      expect(animationMs).toBeLessThan(1);
    }
  });
});