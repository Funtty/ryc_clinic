import { test, expect } from "@playwright/test";

// Phase 10 security & privacy — verifies the deployment-level headers and the
// robots contract that unit tests cannot reach. Run against the dev server on
// :3101 (dev profile: HSTS and upgrade-insecure-requests are production-only,
// so they are deliberately NOT asserted here).
test.describe("security headers", () => {
  const headerCases = [
    ["Content-Security-Policy", /frame-ancestors 'none'/],
    ["X-Frame-Options", "DENY"],
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Permissions-Policy", /geolocation=\(\)/],
  ] as const;

  for (const [name, expectValue] of headerCases) {
    test(`sends ${name} on the home page`, async ({ request }) => {
      const res = await request.get("/");
      expect(res.status()).toBe(200);
      const header = res.headers()[name.toLowerCase()];
      expect(header).toBeTruthy();
      if (expectValue instanceof RegExp) {
        expect(header).toMatch(expectValue);
      } else {
        expect(header).toBe(expectValue);
      }
    });
  }

  test("sends the security headers on authenticated routes too", async ({
    request,
  }) => {
    const res = await request.get("/ryc_login");
    expect(res.status()).toBe(200);
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["content-security-policy"]).toMatch(/frame-ancestors 'none'/);
  });
});

test.describe("robots policy", () => {
  test("disallows admin, payment and login surfaces from search engines", async ({
    request,
  }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Disallow: /pay");
    expect(body).toContain("Disallow: /ryc_login");
  });
});