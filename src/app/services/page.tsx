import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ServiceCard } from "@/components/cards/service-card";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Dental Services",
  description:
    "Explore RYC Dental Service treatments — dentures, scaling & polishing, teeth whitening, orthodontics and crowns & bridges in Abeokuta.",
  alternates: { canonical: "/services" },
};

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { dentists: true } } },
  });

  return (
    <>
      <JsonLd
        data={buildBreadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
        ])}
      />
      <section className="bg-pine-950 text-cream">
        <Container className="section-pad pt-14 sm:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-400">
            Our treatments
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-medium leading-tight sm:text-5xl">
            Every service under one roof
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-cream/70">
            From everyday check-ups to advanced cosmetic and surgical care — all
            delivered with modern equipment, clear pricing and a gentle hand.
          </p>
        </Container>
      </section>

      <section className="section-pad">
        <Container>
          <h2 className="sr-only">All treatments</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <ServiceCard key={s.slug} service={s} />
            ))}
          </div>

          <Card variant="panel-lg" className="mt-16 flex flex-col items-center gap-4 p-8 text-center">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Not sure what you need?
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-ink-sub">
              Book a general consultation and one of our dentists will assess
              your oral health and recommend the right care — with a clear,
              honest plan.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Button href="/booking" variant="primary" showArrow>
                Book a consultation
              </Button>
              <Button href="/team" variant="outline">
                Meet our dentists
              </Button>
            </div>
          </Card>
        </Container>
      </section>
    </>
  );
}