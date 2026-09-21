import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { buildTeamLd, buildBreadcrumbLd } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/seo/json-ld";
import { TeamCard } from "@/components/cards/team-card";

export const metadata: Metadata = {
  title: "Our Team",
  description:
    "Meet the dentists behind RYC Dental Service in Abeokuta — experienced specialists in cosmetic, restorative, orthodontic and surgical dentistry.",
  alternates: { canonical: "/team" },
};

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const dentists = await prisma.dentist.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <>
      <JsonLd data={buildTeamLd({ dentists })} />
      <JsonLd
        data={buildBreadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Our Team", path: "/team" },
        ])}
      />
      <section className="bg-pine-950 text-cream">
        <Container className="section-pad pt-14 sm:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-400">
            The people who care for you
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-medium leading-tight sm:text-5xl">
            Meet the RYC dental team
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-cream/70">
            Qualified, approachable and dedicated to gentle dentistry — the
            clinicians you&rsquo;ll see at every visit.
          </p>
        </Container>
      </section>

      <section className="section-pad">
        <Container>
          <h2 className="sr-only">Our dentists</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {dentists.map((d) => (
              <div key={d.slug} id={d.slug} className="scroll-mt-28">
                <TeamCard dentist={d} />
              </div>
            ))}
          </div>

          <div className="mt-16 flex flex-col items-center gap-4 rounded-3xl bg-pine-950 p-10 text-center text-cream">
            <h2 className="font-display text-2xl font-semibold">
              Continuously learning, always improving
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-cream/70">
              Our team attends continuing education and follows international
              best practice, so you benefit from the latest techniques in
              dentistry.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Button href="/booking" variant="gold" showArrow size="lg">
                Book with us
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}