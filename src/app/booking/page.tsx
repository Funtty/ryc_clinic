import type { Metadata } from "next";
import { Clock, Layers, CalendarPlus, PhoneCall } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { site } from "@/lib/site";
import { getPresentableHours } from "@/lib/availability";
import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookingWizard,
  type WizardDentist,
  type WizardService,
} from "@/components/booking/booking-wizard";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Book an Appointment",
  description:
    "Check live availability and book your dental appointment at RYC Dental Service in Abeokuta.",
  alternates: { canonical: "/booking" },
};

export const dynamic = "force-dynamic";

const steps = [
  {
    icon: Layers,
    title: "Choose your service",
    body: "Pick the treatment you need, or ask us at the front desk.",
  },
  {
    icon: CalendarPlus,
    title: "Pick a day and time",
    body: "See live free slots computed from the clinic's real schedule.",
  },
  {
    icon: Clock,
    title: "Confirm in seconds",
    body: "Give us your details, get an instant reference, done.",
  },
];

export default async function BookingPage() {
  const [services, dentists, hours] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        shortDescription: true,
        durationMinutes: true,
        price: true,
        priceLabel: true,
      },
    }),
    prisma.dentist.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        title: true,
        slug: true,
        services: { select: { slug: true } },
      },
    }),
    getPresentableHours(),
  ]);

  const wizardServices = services as WizardService[];
  const wizardDentists = dentists.map((d) => ({
    id: d.id,
    name: d.name,
    title: d.title,
    slug: d.slug,
    services: d.services.map((s) => s.slug),
  })) as WizardDentist[];

  return (
    <>
      <JsonLd
        data={buildBreadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Book an Appointment", path: "/booking" },
        ])}
      />
      <section className="bg-pine-950 text-cream">
        <Container className="section-pad pt-14 sm:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-400">
            Book online
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-medium leading-tight sm:text-5xl">
            Your appointment, three easy steps
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-cream/70">
            Choose a service, see real availability, and book in under a minute.
            Need help? Call us any time during opening hours.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-gold-400/15 text-gold-400">
                    <s.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-display text-3xl font-light text-cream/50">
                    0{i + 1}
                  </span>
                </div>
                <h2 className="mt-4 font-display text-lg font-semibold">
                  {s.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-cream/65">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="section-pad">
        <Container className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <h2 className="sr-only">Online booking</h2>
            <BookingWizard services={wizardServices} dentists={wizardDentists} />
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <Card variant="panel-lg" className="p-6">
              <h2 className="font-display text-lg font-semibold text-ink">
                Opening hours
              </h2>
              <ul className="mt-4 space-y-2 text-sm">
                {hours.map((h) => (
                  <li
                    key={h.dayOfWeek}
                    className="flex items-center justify-between border-b border-pine-900/5 pb-2 last:border-0"
                  >
                    <span className="font-medium text-ink">{h.dayLabel}</span>
                    <span className="text-ink-sub">
                      {h.isClosed ? "Closed" : `${h.open}–${h.close}`}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card variant="panel-lg" className="mt-6 overflow-hidden">
              <div className="bg-pine-900 p-6 text-cream">
                <p className="font-display text-lg font-semibold">
                  Prefer to book by phone?
                </p>
                <p className="mt-1 text-sm text-cream/70">
                  Our front desk handles bookings, rescheduling and same-day
                  emergency slots.
                </p>
                <a
                  href={`tel:${site.phone.replace(/\s/g, "")}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-gold-400"
                >
                  <PhoneCall className="size-4" aria-hidden="true" />
                  {site.phoneDisplay}
                </a>
              </div>
              <div className="p-6">
                <p className="text-sm leading-relaxed text-ink-sub">
                  Need to ask something first? Get in touch and we&rsquo;ll point
                  you in the right direction.
                </p>
                <Button
                  href="/contact"
                  variant="outline"
                  showArrow
                  className="mt-4 w-full"
                >
                  Ask us first
                </Button>
              </div>
            </Card>
          </div>
        </Container>
      </section>
    </>
  );
}