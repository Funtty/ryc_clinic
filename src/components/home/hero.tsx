import Image from "next/image";
import { BadgeCheck, Sparkles, ShieldCheck } from "lucide-react";
import { slotLabel } from "@/lib/datetime";
import type { SlotWithDentist } from "@/lib/availability";
import { clinicImages } from "@/lib/images";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

type HeroProps = {
  nextSlot: SlotWithDentist | null;
  serviceCount: number;
};

export function Hero({ nextSlot, serviceCount }: HeroProps) {
  const trust = [
    `${serviceCount}+ specialist services`,
    "Same-day emergencies",
    "Gentle, modern techniques",
  ];
  return (
    <section className="relative overflow-hidden bg-pine-950 text-cream">
      <div className="absolute inset-0 bg-grid-faint opacity-40" aria-hidden="true" />
      <div
        className="absolute -left-40 top-0 size-[34rem] rounded-full bg-pine-700/30 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -right-24 bottom-[-10rem] size-[30rem] rounded-full bg-gold-500/10 blur-3xl"
        aria-hidden="true"
      />

      <Container className="relative grid items-center gap-14 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div className="animate-fade-up">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-gold-300">
            <Sparkles className="size-3.5" aria-hidden="true" />
            RYC Dental Service · Abeokuta
          </p>

          <h1 className="font-display text-4xl font-medium leading-[1.08] sm:text-5xl lg:text-[3.6rem]">
            Modern dentistry,{" "}
            <span className="font-light italic text-gold-400">gentle care</span>{" "}
            for every smile.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-cream/70 sm:text-lg">
            From routine check-ups to complete smile makeovers, we blend
            precise technique with genuine warmth — so every visit feels calm,
            comfortable and cared for.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button href="/booking" variant="gold" size="lg" showArrow>
              Book an Appointment
            </Button>
            <Button href="/contact" variant="ghostLight" size="lg">
              Contact us
            </Button>
          </div>

          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-cream/80">
            {trust.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-gold-400" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Visual */}
        <div className="relative mx-auto w-full max-w-md animate-fade-up [animation-delay:150ms] lg:max-w-none">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-lift">
            <Image
              src={clinicImages.heroMain}
              alt="A calm, modern treatment room at RYC Dental Service"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="animate-slow-zoom object-cover"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-pine-950/40 to-transparent"
              aria-hidden="true"
            />
          </div>

          <div className="absolute -bottom-6 -left-6 hidden w-40 overflow-hidden rounded-2xl border-4 border-pine-950 shadow-lift sm:block">
            <Image
              src={clinicImages.heroInset}
              alt=""
              aria-hidden
              width={320}
              height={400}
              sizes="160px"
              className="aspect-[4/5] object-cover"
            />
          </div>

          {nextSlot && (
            <div className="absolute -right-2 top-6 w-52 rounded-2xl bg-cream p-4 text-ink shadow-card sm:-right-6">
              <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-gold-700">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Next available
              </p>
              <p className="mt-2 font-display text-sm font-semibold leading-snug">
                {slotLabel(nextSlot.start)}
              </p>
              <p className="mt-1 text-xs text-ink-sub">
                with {nextSlot.dentist.name}
              </p>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}