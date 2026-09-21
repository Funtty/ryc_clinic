import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";
export const revalidate = 86400; // revalidate sitemap hourly

const staticRoutes = [
  "",
  "/services",
  "/team",
  "/about",
  "/faq",
  "/contact",
  "/booking",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [services, dentists] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.dentist.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  return [
    ...staticRoutes.map((route) => ({
      url: `${site.siteUrl}${route}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.8,
    })),
    ...services.map((s) => ({
      url: `${site.siteUrl}/services/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...dentists.map((d) => ({
      url: `${site.siteUrl}/team#${d.slug}`,
      lastModified: d.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}