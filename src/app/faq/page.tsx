import type { Metadata } from "next";
import { PhoneCall } from "lucide-react";
import { site } from "@/lib/site";
import { faqs } from "@/lib/faqs";
import { buildFaqLd } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { FaqAccordion } from "@/components/faq/faq-accordion";
import { JsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Answers to common questions about booking, pricing, opening hours and dental care at RYC Dental Service in Abeokuta.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <>
      <JsonLd data={buildFaqLd(faqs)} />

      <section className="bg-pine-950 text-cream">
        <Container className="section-pad pt-14 sm:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-400">
            Help &amp; answers
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-medium leading-tight sm:text-5xl">
            Frequently asked questions
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-cream/70">
            Everything patients ask us most — booking, prices, hours and what to
            expect. If your question isn&rsquo;t here, we&rsquo;re only a call away.
          </p>
        </Container>
      </section>

      <section className="section-pad">
        <Container>
          <FaqAccordion items={faqs} />

          <div className="mx-auto mt-14 max-w-3xl rounded-3xl bg-pine-950 p-8 text-center text-cream sm:p-10">
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">
              Still have a question?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-cream/70">
              Call our front desk during opening hours and we&rsquo;ll be happy to
              help with bookings, prices or anything else.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <a
                href={`tel:${site.phone.replace(/\s/g, "")}`}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-gold-500 px-7 text-base font-bold text-ink transition-colors hover:bg-gold-400"
              >
                <PhoneCall className="size-4" aria-hidden="true" />
                {site.phoneDisplay}
              </a>
              <Button href="/booking" variant="outlineLight" size="lg">
                Book online
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}