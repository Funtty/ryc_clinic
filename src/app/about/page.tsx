import type { Metadata } from "next";
import Image from "next/image";
import { ShieldCheck, Clock3, HeartHandshake, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { clinicImages } from "@/lib/images";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About the Clinic",
  description:
    "Learn about RYC Dental Service in Abeokuta — our story, our standards, and what to expect at your first visit. Find us at samfiget bus stop, 3 okiki alayo Street, odo-eran, opposite Aminat College, gbonogun, Abeokuta 110121, Ogun State, Nigeria.",
  alternates: { canonical: "/about" },
};

export const dynamic = "force-dynamic";

const values = [
  {
    icon: ShieldCheck,
    title: "Safety first, always",
    body: "Strict sterilisation, single-use disposables and rigorous infection control at every step — because your health is non-negotiable.",
  },
  {
    icon: Clock3,
    title: "Your time is respected",
    body: "We run the day on schedule. Your appointment starts on time, and you're never left waiting without explanation.",
  },
  {
    icon: HeartHandshake,
    title: "Comfort as clinical duty",
    body: "Friendly reassurance, local anaesthesia done with care, and a warm team that genuinely listens to your worries.",
  },
  {
    icon: Sparkles,
    title: "Beautiful results, honestly",
    body: "We show you before-and-after reasoning, never oversell, and only recommend treatment you actually need.",
  },
];

const expectations = [
  "A friendly welcome at reception and a short medical history form",
  "A conversation about what brought you in — no pain, no judgement",
  "A gentle full examination, with X-rays only where necessary",
  "A clear, plain-language treatment plan with upfront costs",
  "Options, not pressure — you decide, in your own time",
];

export default async function AboutPage() {
  const dentistCount = await prisma.dentist.count({
    where: { isActive: true },
  });

  return (
    <>
      <JsonLd
        data={buildBreadcrumbLd([
          { name: "Home", path: "/" },
          { name: "About", path: "/about" },
        ])}
      />
      <section className="bg-pine-950 text-cream">
        <Container className="section-pad pt-14 sm:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-400">
            About the clinic
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-medium leading-tight sm:text-5xl">
            A local clinic with a patient-first philosophy
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-cream/70">
            RYC Dental Service was founded on a simple belief: going to the
            dentist should feel safe, straightforward and — as much as possible
            — comfortable.
          </p>
        </Container>
      </section>

      {/* Our story */}
      <section className="section-pad bg-white">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Our story" title="Built on trust, one smile at a time" />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-ink-sub">
              <p>
                What started as a single-surgery practice has grown into a
                modern, multi-chair clinic at samfiget bus stop, 3 okiki alayo
                Street, odo-eran, opposite Aminat College, gbonogun, Abeokuta
                110121, Ogun State — yet we&rsquo;ve kept the feel of a
                private family dentist: no rush, no jargon, no pressure.
              </p>
              <p>
                Today our team spans general, restorative, orthodontic and
                surgical dentistry. We invested in digital diagnostics and
                sterilisation equipment that equals international standards,
                because quality care benefits everyone — especially the people
                we treat.
              </p>
              <p>
                Whether it&rsquo;s your child&rsquo;s first check-up, a painful
                tooth, or a smile you&rsquo;ve always wanted to change — you&rsquo;ll
                find patient people and a plan that makes sense.
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-[2rem] shadow-card">
              <Image
                src={clinicImages.about}
                alt="The RYC Dental treatment area"
                width={1200}
                height={900}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-4 rounded-2xl bg-white px-5 py-4 shadow-card sm:-left-6">
              <p className="font-display text-2xl font-semibold text-pine-900">
                {dentistCount} specialists
              </p>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">
                Under one roof
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Values */}
      <section className="section-pad">
        <Container>
          <SectionHeading
            eyebrow="What we stand for"
            title="The standards behind every visit"
            align="center"
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <Card
                key={v.title}
                variant="panel-lg"
                className="p-6"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine-800">
                  <v.icon className="size-6" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold text-ink">
                  {v.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-sub">
                  {v.body}
                </p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* Your first visit */}
      <section className="section-pad bg-white">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div className="order-2 rounded-3xl bg-pine-950 p-8 text-cream sm:p-10 lg:order-1">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-400">
              Your first visit
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
              What to expect
            </h2>
            <ol className="mt-6 space-y-4">
              {expectations.map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold-400/15 font-display text-sm font-semibold text-gold-400">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-cream/80">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="order-1 lg:order-2">
            <SectionHeading
              eyebrow="Ready when you are"
              title="Take the first step — it's easy"
              lede="No referral needed. Book online in under a minute, or simply call and we'll take care of the rest."
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/booking" variant="primary" size="lg" showArrow>
                Book an appointment
              </Button>
              <Button href="/contact" variant="outline" size="lg">
                Find us &amp; hours
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}