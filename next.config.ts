import type { NextConfig } from "next";

/**
 * Content-Security-Policy.
 *
 * Production uses the strictest profile the App Router allows: Next.js ships
 * inline bootstrap/RSC-payload scripts, so `script-src` keeps `'unsafe-inline'`
 * (it still blocks script injection from any remote origin — the primary XSS
 * mitigation). Development additionally needs `'unsafe-eval'` and websockets
 * for the React Fast-Refresh overlay.
 *
 * A Strict-Transport-Security header is emitted only when NODE_ENV is
 * "production" (the app may run behind plain HTTP during local development;
 * browser-cached HSTS would then break the site).
 */
function securityHeaders() {
  const isProduction = process.env.NODE_ENV === "production";

  const scriptSrc = isProduction
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' 'unsafe-eval'";
  const connectSrc = isProduction ? "'self'" : "'self' ws:";

  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    // Tailwind/Next inject <style> tags at build time.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src ${connectSrc}`,
    // The contact page embeds a Google Maps iframe (`www.google.com/maps`).
    `frame-src https://www.google.com https://maps.google.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isProduction ? [`upgrade-insecure-requests`] : []),
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    // frame-ancestors 'none' covers modern browsers; X-Frame-Options backs it
    // up for the legacy callers that ignore CSP.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // PHI-heavy /admin URLs must not leak referrers cross-origin.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    ...(isProduction
      ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
      : []),
  ];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * Image pipeline.
   *
   * Dentist/service photography is uploaded to Supabase Storage and served from
   * the project's public bucket, so remote images must be allowlisted here.
   * `formats` prefers AVIF then WebP so the browser never pays for JPEG/PNG
   * when a smaller alternative is available. `deviceSizes` is bounded to the
   * breakpoints the design actually uses (the widest container is 76 rem), so
   * the optimizer never generates 20+ responsive widths for a 320-px screen.
   * `minimumCacheTTL` keeps optimized images in the CDN for a week, avoiding
   * re-optimization on every request.
   */
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [320, 375, 390, 768, 1024, 1440],
    imageSizes: [16, 32, 64, 128, 256, 384, 512, 768],
    minimumCacheTTL: 604800,
    qualities: [75, 80],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "nzflofkccvwbonvfvdfg.supabase.co",
        pathname: "/storage/v1/**",
      },
    ],
  },

  async headers() {
    const headers = securityHeaders();
    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;