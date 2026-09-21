import Link from "next/link";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { site } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { getPresentableHours } from "@/lib/availability";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/container";

export async function Footer() {
  const [services, hours] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true },
      take: 6,
    }),
    getPresentableHours(),
  ]);

  const socials = (
    Object.entries(site.socials) as [string, string | null][]
  )
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => [label, value as string] as const);

  return (
    <footer className="bg-pine-950 text-cream/70">
      <Container className="section-pad grid gap-12 pb-14 pt-16 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div className="max-w-xs">
          <Logo dark />
          <p className="mt-5 text-sm leading-relaxed">
            Modern, gentle dental care in the heart of{" "}
            {site.address.city}. Your smile, our craft.
          </p>
          {socials.length > 0 && (
            <div className="mt-5 flex gap-3">
              {socials.map(([label, url]) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid size-9 place-items-center rounded-full bg-white/5 text-sm transition-colors hover:bg-gold-500 hover:text-ink"
                >
                  {label[0].toUpperCase()}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Explore */}
        <nav aria-label="Footer — Explore">
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-cream">
            Explore
          </h3>
          <ul className="mt-5 space-y-3 text-sm">
            {[
              { href: "/", label: "Home" },
              { href: "/services", label: "Services" },
              { href: "/team", label: "Our Team" },
              { href: "/about", label: "About the Clinic" },
              { href: "/faq", label: "FAQ" },
              { href: "/booking", label: "Book an Appointment" },
              { href: "/contact", label: "Contact" },
              { href: "/ryc_login", label: "Staff sign in" },
            ].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="transition-colors hover:text-gold-400"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Services */}
        <nav aria-label="Footer — Services">
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-cream">
            Services
          </h3>
          <ul className="mt-5 space-y-3 text-sm">
            {services.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/services/${s.slug}`}
                  className="transition-colors hover:text-gold-400"
                >
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contact */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-cream">
            Visit us
          </h3>
          <address className="mt-5 space-y-3 text-sm not-italic">
            <p className="flex gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-gold-400" aria-hidden="true" />
              <span>
                {site.address.line1}
                <br />
                {site.address.line2}
                <br />
                {site.address.city}, {site.address.region} {site.address.postalCode}, {site.address.country}
              </span>
            </p>
            <p>
              <a
                href={`tel:${site.phone.replace(/\s/g, "")}`}
                className="flex items-center gap-3 transition-colors hover:text-gold-400"
              >
                <Phone className="size-4 shrink-0 text-gold-400" aria-hidden="true" />
                {site.phoneDisplay}
              </a>
            </p>
            <p>
              <a
                href={`mailto:${site.email}`}
                className="flex items-center gap-3 transition-colors hover:text-gold-400"
              >
                <Mail className="size-4 shrink-0 text-gold-400" aria-hidden="true" />
                {site.email}
              </a>
            </p>
            <p className="flex items-start gap-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-gold-400" aria-hidden="true" />
              <span>
                {hours
                  .filter((h) => !h.isClosed)
                  .slice(0, 3)
                  .map((h) => `${h.dayLabel} ${h.open}–${h.close}`)
                  .join(" · ")}
              </span>
            </p>
          </address>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col items-center justify-between gap-2 py-6 text-xs sm:flex-row">
          <p>
            © {new Date().getFullYear()} {site.legalName}. All rights reserved.
          </p>
          <p className="text-cream/50">
            BDS · Gentle · Trusted
          </p>
        </Container>
      </div>
    </footer>
  );
}