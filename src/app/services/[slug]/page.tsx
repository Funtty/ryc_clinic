import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Clock, ArrowRight, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getNextAvailableSlots } from "@/lib/availability";
import { formatMoney } from "@/lib/utils";
import { slotLabel } from "@/lib/datetime";
import { site } from "@/lib/site";
import { buildBreadcrumbLd, buildServiceLd } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { JsonLd } from "@/components/seo/json-ld";
import { ServiceCard } from "@/components/cards/service-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await prisma.service.findUnique({
    where: { slug },
    select: { name: true, shortDescription: true },
  });
  if (!service) return { title: "Service not found" };
  return {
    title: service.name,
    description: service.shortDescription,
    alternates: { canonical: `/services/${slug}` },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [service, related, nextSlots] = await Promise.all([
    prisma.service.findUnique({
      where: { slug },
      include: {
        dentists: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, slug: true, title: true },
        },
      },
    }),
    prisma.service.findMany({
      where: { isActive: true, NOT: { slug } },
      orderBy: { sortOrder: "asc" },
      take: 3,
    }),
    getNextAvailableSlots({ limit: 4, days: 14, serviceId: undefined }),
  ]);

  if (!service) notFound();

  const price =
    service.priceLabel ??
    (service.price != null
      ? `from ${formatMoney(service.price, service.currency)}`
      : "Priced at consultation");

  return (
    <>
      <JsonLd
        data={buildServiceLd({
          slug: service.slug,
          name: service.name,
          description: service.shortDescription,
          price: service.price,
          currency: service.currency,
        })}
      />
      <JsonLd
        data={buildBreadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
          { name: service.name, path: `/services/${service.slug}` },
        ])}
      />
      <section className="bg-pine-950 text-cream">
        <Container className="section-pad pt-14 sm:pt-16">
          <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <Badge tone="cream">{service.durationMinutes} minutes</Badge>
              <h1 className="mt-4 font-display text-4xl font-medium leading-tight sm:text-5xl">
                {service.name}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-cream/70">
                {service.shortDescription}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button href="/booking" variant="gold" size="lg" showArrow>
                  Book this service
                </Button>
                <a
                  href={`tel:${site.phone.replace(/\s/g, "")}`}
                  className="text-sm font-semibold text-cream/80 underline-offset-4 hover:underline"
                >
                  Or call to ask a question
                </a>
              </div>
            </div>

            {service.imageUrl && (
              <div className="overflow-hidden rounded-[2rem] shadow-lift">
                <Image
                  src={service.imageUrl}
                  alt={service.name}
                  width={1000}
                  height={750}
                  priority
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="aspect-[4/3] w-full object-cover"
                />
              </div>
            )}
          </div>
        </Container>
      </section>

      <section className="section-pad">
        <Container className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
              About this treatment
            </h2>
            <div className="mt-4 max-w-2xl space-y-4 text-base leading-relaxed text-ink-sub">
              {service.description
                .split(/\n{2,}/)
                .map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
            </div>

            {service.dentists.length > 0 && (
              <div className="mt-10">
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-ink-faint">
                  Performed by
                </h3>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {service.dentists.map((d) => (
                    <li key={d.id}>
                      <Card
                        as="a"
                        href={`/team#${d.slug}`}
                        className="flex items-center gap-3 p-4 transition-colors hover:border-pine-800"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-pine-100 font-display font-semibold text-pine-800">
                          {d.name.replace("Dr. ", "").charAt(0)}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-ink">
                            {d.name}
                          </span>
                          <span className="block text-xs text-ink-sub">
                            {d.title}
                          </span>
                        </span>
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card variant="panel-lg" className="p-6 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-700">
                Price &amp; duration
              </p>
              <p className="mt-3 font-display text-3xl font-semibold text-ink">
                {price}
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm text-ink-sub">
                <Clock className="size-4 text-pine-700" aria-hidden="true" />
                Around {service.durationMinutes} minutes in the chair
              </p>

              <div className="mt-6 rounded-2xl bg-pine-50 p-4 text-sm leading-relaxed text-pine-900">
                <p className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  Final pricing may be clarified at consultation after a full
                  examination.
                </p>
              </div>

              <Button
                href="/booking"
                variant="primary"
                className="mt-6 w-full"
                size="lg"
                showArrow
              >
                Book an appointment
              </Button>
              <Button
                href="/contact"
                variant="ghost"
                className="mt-2 w-full"
              >
                Ask us a question
              </Button>
            </Card>

            {nextSlots.length > 0 && (
              <Card variant="panel-lg" className="mt-6 p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-faint">
                  Next available times
                </p>
                <ul className="mt-3 space-y-2">
                  {nextSlots.map((s) => (
                    <li
                      key={`${s.dateKey}-${s.start.getTime()}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-medium text-ink">
                        {slotLabel(s.start)}
                      </span>
                      <ArrowRight className="size-4 text-ink-faint" aria-hidden="true" />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </aside>
        </Container>
      </section>

      {related.length > 0 && (
        <section className="section-pad border-t border-pine-900/5 bg-white">
          <Container>
            <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
              You might also need
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((s) => (
                <ServiceCard key={s.slug} service={s} />
              ))}
            </div>
          </Container>
        </section>
      )}
    </>
  );
}