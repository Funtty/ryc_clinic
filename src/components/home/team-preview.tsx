import type { Dentist } from "@prisma/client";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { TeamCard } from "@/components/cards/team-card";

type TeamPreviewProps = {
  dentists: Pick<
    Dentist,
    "slug" | "name" | "title" | "bio" | "specialties" | "photoUrl"
  >[];
};

export function TeamPreview({ dentists }: TeamPreviewProps) {
  return (
    <section className="section-pad">
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="Meet the team"
            title="Experienced dentists, steady hands"
            lede="Every member of our clinical team brings specialist training, continuing education and a genuinely friendly chairside manner."
          />
          <Button href="/team" variant="outline" className="shrink-0" showArrow>
            Meet the full team
          </Button>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {dentists.map((d) => (
            <TeamCard key={d.slug} dentist={d} />
          ))}
        </div>
      </Container>
    </section>
  );
}