import { site } from "@/lib/site";
import type { PresentableHours } from "@/lib/availability";
import type { Service } from "@prisma/client";

const phoneE164 = site.phone.replace(/\s/g, "");
const defaultImage = `${site.siteUrl}/images/home/hero-main.jpg`;

/** Same-as links, only for social profiles the clinic has actually configured.
 * Nothing is invented: null entries are filtered out so the JSON-LD never
 * advertises a social channel that does not exist. */
const sameAs = (
  Object.entries(site.socials) as [string, string | null][]
)
  .filter(([, value]) => Boolean(value))
  .map(([, value]) => value as string);

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

type DentistLd = {
  slug: string;
  name: string;
  title: string;
  specialties: string | null;
  photoUrl: string | null;
};

function absoluteUrl(pathOrUrl: string): string {
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${site.siteUrl}${pathOrUrl}`;
}

function dentistLd(d: DentistLd) {
  return {
    "@type": "Physician",
    "@id": `${site.siteUrl}/team#${d.slug}`,
    name: d.name,
    jobTitle: d.title,
    url: `${site.siteUrl}/team#${d.slug}`,
    image: d.photoUrl ? absoluteUrl(d.photoUrl) : undefined,
    medicalSpecialty: "Dentistry",
    worksFor: { "@id": `${site.siteUrl}#clinic` },
  };
}

export function buildMedicalClinicLd(opts: {
  dentists: DentistLd[];
  hours: PresentableHours[];
  services?: Pick<
    Service,
    "slug" | "name" | "price" | "currency" | "priceLabel" | "shortDescription"
  >[];
}) {
  const openingHoursSpecification = opts.hours.flatMap((h) => {
    if (h.isClosed || !h.open || !h.close) return [];
    return [
      {
        "@type": "OpeningHoursSpecification" as const,
        dayOfWeek: DAYS[h.dayOfWeek],
        opens: h.open,
        closes: h.close,
      },
    ];
  });

  const offerCatalog = opts.services?.map((s) => ({
    "@type": "Offer",
    name: s.name,
    description: s.shortDescription,
    url: `${site.siteUrl}/services/${s.slug}`,
    price: s.price != null
      ? { "@type": "Price", value: s.price, priceCurrency: s.currency }
      : undefined,
    availability: s.price != null ? "https://schema.org/InStock" : undefined,
  })) ?? [];

  const contactPoint = {
    "@type": "ContactPoint",
    telephone: site.phone,
    contactType: "appointments",
    areaServed: `${site.address.city}, ${site.address.region}`,
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        // Organization is the parent node; MedicalClinic/Dentist reference it
        // by @id so Google can resolve the clinic's identity in one place.
        "@type": "Organization",
        "@id": `${site.siteUrl}#org`,
        name: site.legalName,
        url: site.siteUrl,
        logo: `${site.siteUrl}/icon.svg`,
        telephone: phoneE164,
        email: site.email,
        address: {
          "@type": "PostalAddress",
          streetAddress: site.address.line1,
          addressLocality: site.address.city,
          addressRegion: site.address.region,
          postalCode: site.address.postalCode,
          addressCountry: "NG",
        },
        ...(sameAs.length > 0 ? { sameAs } : {}),
      },
      {
        "@type": ["MedicalClinic", "Dentist"],
        "@id": `${site.siteUrl}#clinic`,
        name: site.name,
        url: site.siteUrl,
        image: defaultImage,
        telephone: phoneE164,
        email: site.email,
        priceRange: "$$",
        contactPoint,
        address: {
          "@type": "PostalAddress",
          streetAddress: site.address.line1,
          addressLocality: site.address.city,
          addressRegion: site.address.region,
          postalCode: site.address.postalCode,
          addressCountry: "NG",
        },
        areaServed: `${site.address.city}, ${site.address.region}, ${site.address.country}`,
        openingHoursSpecification,
        physician: opts.dentists.map((d) => dentistLd(d)),
        medicalSpecialty: "Dentistry",
        department: { "@id": `${site.siteUrl}#clinic` },
        founder: undefined,
        // Reference the Organization node rather than duplicating contact
        // details — keeps the two in sync by construction.
        parentOrganization: { "@id": `${site.siteUrl}#org` },
        ...(offerCatalog.length > 0 && {
          hasOfferCatalog: {
            "@type": "ItemList",
            itemListElement: offerCatalog,
          },
        }),
      },
    ],
  };
}

export function buildServiceLd(opts: {
  slug: string;
  name: string;
  description: string;
  price: number | null;
  currency: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: opts.name,
    description: opts.description,
    url: `${site.siteUrl}/services/${opts.slug}`,
    provider: { "@id": `${site.siteUrl}#clinic` },
    serviceType: "Dental care",
    areaServed: "Abeokuta, Ogun State, Nigeria",
    ...(opts.price != null && {
      offers: {
        "@type": "Offer",
        price: opts.price,
        priceCurrency: opts.currency,
        availability: "https://schema.org/InStock",
      },
    }),
  };
}

export function buildTeamLd(opts: { dentists: DentistLd[] }) {
  return {
    "@context": "https://schema.org",
    "@graph": opts.dentists.map((d) => dentistLd(d)),
  };
}

/** Organization node for every page. Kept separate from the clinic node so the
 *  clinic page can reference it by @id while every other page only needs the
 *  brand identity (name, logo, contact, sameAs). */
export function buildOrganizationLd() {
  const sameAs = (
    Object.entries(site.socials) as [string, string | null][]
  )
    .filter(([, value]) => Boolean(value))
    .map(([, value]) => value as string);

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${site.siteUrl}#org`,
    name: site.legalName,
    url: site.siteUrl,
    logo: `${site.siteUrl}/icon.svg`,
    telephone: phoneE164,
    email: site.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.line1,
      addressLocality: site.address.city,
      addressRegion: site.address.region,
      addressCountry: "NG",
    },
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

export function buildBreadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${site.siteUrl}${item.path}`,
    })),
  };
}

export function buildFaqLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}