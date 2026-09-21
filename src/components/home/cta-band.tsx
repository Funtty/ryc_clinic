import { PhoneCall } from "lucide-react";
import { site } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export function CtaBand() {
  return (
    <section className="section-pad bg-white">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] bg-pine-900 px-6 py-14 text-center text-cream shadow-lift sm:px-12 sm:py-16">
          <div
            className="absolute inset-0 bg-grid-faint opacity-30"
            aria-hidden="true"
          />
          <div
            className="absolute -right-20 -top-20 size-72 rounded-full bg-gold-500/15 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="font-display text-3xl font-medium leading-tight sm:text-4xl">
              Ready to smile with confidence?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-cream/70">
              Book your visit online today, or call us — we&rsquo;ll find a time
              that suits you and answer any question you have.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button href="/booking" variant="gold" size="lg" showArrow>
                Book an Appointment
              </Button>
              <a
                href={`tel:${site.phone.replace(/\s/g, "")}`}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 px-7 text-base font-semibold text-cream transition-colors hover:border-gold-400 hover:text-gold-300"
              >
                <PhoneCall className="size-4" aria-hidden="true" />
                {site.phoneDisplay}
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}