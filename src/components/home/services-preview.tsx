import type { Service } from "@prisma/client";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { ServiceCard } from "@/components/cards/service-card";

type ServicesPreviewProps = {
  services: Pick<
    Service,
    | "slug"
    | "name"
    | "shortDescription"
    | "durationMinutes"
    | "price"
    | "currency"
    | "priceLabel"
    | "imageUrl"
  >[];
};

export function ServicesPreview({ services }: ServicesPreviewProps) {
  return (
    <section className="section-pad">
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="What we do"
            title="Dental care for the whole family"
            lede="Preventive, restorative and cosmetic treatments delivered with modern equipment and a gentle touch."
          />
          <Button href="/services" variant="outline" className="shrink-0" showArrow>
            View all services
          </Button>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.slug} service={s} />
          ))}
        </div>
      </Container>
    </section>
  );
}