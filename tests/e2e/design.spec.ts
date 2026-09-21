import { test, expect, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "320", width: 320, height: 800 },
  { name: "375", width: 375, height: 812 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
];

const ROUTES = [
  { path: "/", label: "home" },
  { path: "/services", label: "services" },
  { path: "/services/dentures", label: "service-detail" },
  { path: "/team", label: "team" },
  { path: "/about", label: "about" },
  { path: "/contact", label: "contact" },
  { path: "/booking", label: "booking" },
  { path: "/faq", label: "faq" },
  { path: "/ryc_login", label: "login" },
  { path: "/does-not-exist", label: "404" },
];

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

test.describe("responsive design", () => {
  for (const vp of VIEWPORTS) {
    test.describe(`viewport ${vp.name}px`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      for (const route of ROUTES) {
        test(`${route.label} renders without overflow or broken images`, async ({ page }) => {
          const response = await page.goto(route.path, { waitUntil: "load" });
          const status = response?.status() ?? 0;
          expect(
            status === 404 || status < 400,
            `${route.path} status ${status}`,
          ).toBe(true);
          await expectNoHorizontalOverflow(page);
          await expectNoBrokenImages(page);
          await page
            .locator("html")
            .screenshot({ path: `tests/e2e/screens/${vp.name}/${route.label}.png` });
        });
      }

      test("header collapses to mobile menu and opens", async ({ page }) => {
        await page.goto("/", { waitUntil: "load" });
        const isDesktop = vp.width >= 1024;
        const desktopNav = page.locator("nav[aria-label=Main]");
        const menuButton = page.locator('button[aria-label="Open menu"], button[aria-label="Close menu"]');

        if (isDesktop) {
          await expect(desktopNav).toBeVisible();
          await expect(menuButton).toBeHidden();
        } else {
          await expect(desktopNav).toBeHidden();
          await expect(menuButton).toBeVisible();
          await menuButton.click();
          const menu = page.locator("#mobile-menu");
          await expect(menu).toBeVisible();
          await expect(menu.locator("a[href='/services']")).toBeVisible();
          await expectNoHorizontalOverflow(page);
          await page.locator("html").screenshot({ path: `tests/e2e/screens/${vp.name}/menu-open.png` });
        }
      });
    });
  }
});

test("primary content is reachable via skip link", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  const skip = page.locator("a.skip-link");
  await expect(skip).toHaveAttribute("href", "#main-content");
  await skip.focus();
  const visible = await skip.evaluate((el) => getComputedStyle(el).transform !== "matrix(1, 0, 0, 1, 0, -1.5)");
  expect(visible).toBe(true);
});