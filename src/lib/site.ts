// ─────────────────────────────────────────────────────────────────────────────
// RYC Dental Service — public site configuration
//
// ⚠  EDIT THESE VALUES to match the real clinic before launch. Contact details
//    shown on the public site and used for booking confirmations are derived
//    from this file (plus OperatingHours + Dentist + Service rows in the DB).
// ─────────────────────────────────────────────────────────────────────────────

/** Public origin (canonical URLs / metadata). Set NEXT_PUBLIC_SITE_URL. */
function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL;
  if (!raw) return "http://localhost:3000";
  const trimmed = raw.replace(/\/+$/, "");
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const site = {
  name: "RYC Dental Service",
  legalName: "RYC Dental Service",
  tagline: "Modern dentistry, gentle care.",
  timeZone: "Africa/Lagos", // clinic local timezone — all schedules are expressed here
  locale: "en-NG",

  siteUrl: resolveSiteUrl(),

  address: {
    line1: "samfiget bus stop",
    line2: "3 okiki alayo Street, odo-eran, opposite Aminat College",
    city: "Abeokuta",
    region: "Ogun State",
    postalCode: "110121",
    country: "Nigeria",
    // Search term used for the contact-page map embed and its "open in map"
    // link. Searching by the clinic name keeps both pointing at the real
    // listing rather than an address string.
    mapsQuery: "Ryc dental service",
  },

  phone: "+234 814 167 5948",
  phoneDisplay: "+234 814 167 5948",
  phoneAlt: "+234 811 442 0543", // alternate line
  phoneAltDisplay: "+234 811 442 0543",
  whatsapp: "2348141675948", // digits only (with country code), used for WhatsApp deep links
  email: "Funtty57@gmail.com",

  currency: "NGN",
  currencySymbol: "₦",

  socials: {
    instagram: null, // e.g. "https://instagram.com/rycdental"
    facebook: null,
    x: null,
  },
} as const;

export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/team", label: "Our Team" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
] as const;

/** Round-trip formatting helpers for clinic-local dates (used across the app). */
export function formatDate(date: Date | string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(site.locale, {
    timeZone: site.timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts,
  }).format(new Date(date));
}

export function formatTime(date: Date | string) {
  return new Intl.DateTimeFormat(site.locale, {
    timeZone: site.timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}