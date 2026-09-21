import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getNextAvailableSlots, getPresentableHours } from "@/lib/availability";
import { buildMedicalClinicLd } from "@/lib/seo";
import { Hero } from "@/components/home/hero";
import { Features } from "@/components/home/features";
import { ServicesPreview } from "@/components/home/services-preview";
import { AboutPreview } from "@/components/home/about-preview";
import { PatientExperience } from "@/components/home/patient-experience";
import { AvailabilityPreview } from "@/components/home/availability-preview";
import { TeamPreview } from "@/components/home/team-preview";
import { CtaBand } from "@/components/home/cta-band";
import { JsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  description:
    "Modern, gentle dental care in Abeokuta — dentures, scaling & polishing, teeth whitening, orthodontics, crowns & bridges.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [services, dentists, slots, hours, serviceCount] = await Promise.all([
      prisma.service.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        take: 6,
      }),
      prisma.dentist.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        take: 4,
      }),
      getNextAvailableSlots({ limit: 6, days: 14 }),
      getPresentableHours(),
      prisma.service.count({ where: { isActive: true } }),
    ]);

  return (
    <>
      <JsonLd data={buildMedicalClinicLd({ dentists, hours, services })} />
      <Hero nextSlot={slots[0] ?? null} serviceCount={serviceCount} />
      <Features />
      <ServicesPreview services={services} />
      <AboutPreview serviceCount={serviceCount} />
      <PatientExperience />
      <AvailabilityPreview slots={slots.slice(0, 5)} />
      <TeamPreview dentists={dentists} />
      <CtaBand />
    </>
  );
}