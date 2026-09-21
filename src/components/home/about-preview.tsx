import Image from "next/image";
import { Check } from "lucide-react";
import { clinicImages } from "@/lib/images";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";

const points = [
  "A team-led approach — you'll understand your diagnosis and your options",
  "Sterilised instruments, strict infection control, every single visit",
  "Short waiting times and appointments that start on schedule",
  "Comfort-first care that works around your family's needs",
];

type AboutPreviewProps = {
  serviceCount: number;
};

export function AboutPreview({ serviceCount }: AboutPreviewProps) {
  return (
    <section className="section-pad bg-white">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div className="relative order-2 lg:order-1">
          <div className="overflow-hidden rounded-[2rem] shadow-card">
            <Image
              src={clinicImages.about}
              alt="Inside the modern RYC Dental clinic"
              width={1200}
              height={900}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          <div className="absolute -bottom-6 -right-4 rounded-2xl bg-pine-900 px-6 py-4 text-cream shadow-card sm:-right-6">
            <p className="font-display text-3xl font-semibold">{serviceCount}+</p>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-cream/70">
              Treatments &amp; services
            </p>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <SectionHeading
            eyebrow="Why RYC"
            title="A clinic built around your comfort"
            lede="We believe great dentistry starts with trust and listening. Every treatment plan is explained in plain language, priced transparently, and tailored to you."
          />
          <ul className="mt-8 space-y-4">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-sm leading-relaxed text-ink-sub sm:text-base">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-pine-100 text-pine-800">
                  <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-9">
            <Button href="/about" variant="outline" showArrow>
              More about the clinic
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}