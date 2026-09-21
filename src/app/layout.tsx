import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SkipLink } from "@/components/layout/skip-link";
import { JsonLd } from "@/components/seo/json-ld";
import { site } from "@/lib/site";
import { getSharedPresentableHours } from "@/lib/availability";
import { buildOrganizationLd } from "@/lib/seo";
import { getSessionUserSafe } from "@/lib/server/session-cookie";

export const metadata: Metadata = {
  metadataBase: new URL(site.siteUrl),
  title: {
    default: `${site.name} — Modern Dentistry in Abeokuta`,
    template: `%s · ${site.name}`,
  },
  description:
    "RYC Dental Service offers modern, gentle dental care in Abeokuta — dentures, scaling & polishing, teeth whitening, orthodontics, crowns & bridges. Book online in under a minute.",
  keywords: [
    "dentist Abeokuta",
    "dental clinic Ogun State",
    "teeth whitening Nigeria",
    "dentures Abeokuta",
    "scaling and polishing",
    "crowns and bridges",
    site.name,
  ],
  openGraph: {
    title: `${site.name} — Modern Dentistry in Abeokuta`,
    description:
      "Modern, gentle dental care in Abeokuta. Book online in under a minute.",
    type: "website",
    locale: site.locale,
    url: site.siteUrl,
    siteName: site.name,
    images: [{ url: "/images/home/hero-main.jpg", width: 1600, height: 900, alt: site.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — Modern Dentistry in Abeokuta`,
    description:
      "Modern, gentle dental care in Abeokuta. Book online in under a minute.",
    images: ["/images/home/hero-main.jpg"],
  },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#102825",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const hours = await getSharedPresentableHours();
  const summary = hours
    .filter((h) => !h.isClosed && h.open)
    .map((h) => `${h.dayLabel} ${h.open}–${h.close}`)
    .join(" · ");
  const user = await getSessionUserSafe();
  const isStaff = user?.role === "ADMIN" || user?.role === "STAFF";

  return (
    <html lang="en">
      <head>
        {/* Preload the two primary woff2 faces so the browser can discover them
         * before the bundled CSS is parsed. Subsets are Latin-only; the
         * unicode-range @font-face rules still cover Latin-Ext for the few
         * characters the clinic actually uses. */}
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/inter-latin-wght-normal.woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/fraunces-latin-standard-normal.woff2"
          crossOrigin="anonymous"
        />
        <JsonLd data={buildOrganizationLd()} />
      </head>
      <body className="flex min-h-screen flex-col">
        <SkipLink />
        <Header hoursSummary={summary} isStaff={isStaff} />
        <main id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}