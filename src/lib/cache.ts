import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { PresentableHours } from "@/lib/availability";

/**
 * Read-mostly reference data is queried on every public page (layout, home,
 * services, team, booking, contact, footer). Wrapping those reads in
 * `unstable_cache` lets the Next.js data cache serve them without a DB round
 * trip on each request, while `revalidate: 60` keeps them fresh within a
 * minute of any change.
 *
 * The clinic-hours read is also React-cached so the layout, footer and any
 * page that asks for the same data share one DB read per request.
 */

const HOURS_REVALIDATE = 60; // seconds
const REFERENCE_REVALIDATE = 300; // seconds

export const getCachedClinicHours = unstable_cache(
  async (): Promise<PresentableHours[]> => {
    const rows = await prisma.clinicHours.findMany({ orderBy: { dayOfWeek: "asc" } });
    return rows.map((r) => ({
      dayOfWeek: r.dayOfWeek,
      dayLabel: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][r.dayOfWeek],
      open: r.isClosed ? null : `${String(Math.floor(r.openMinutes / 60)).padStart(2, "0")}:${String(r.openMinutes % 60).padStart(2, "0")}`,
      close: r.isClosed ? null : `${String(Math.floor(r.closeMinutes / 60)).padStart(2, "0")}:${String(r.closeMinutes % 60).padStart(2, "0")}`,
      isClosed: r.isClosed,
    }));
  },
  ["clinic-hours"],
  { revalidate: HOURS_REVALIDATE, tags: ["clinic-hours"] },
);

export const getCachedServices = unstable_cache(
  async () => {
    return prisma.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  },
  ["services"],
  { revalidate: REFERENCE_REVALIDATE, tags: ["services"] },
);

export const getCachedDentists = unstable_cache(
  async () => {
    return prisma.dentist.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  },
  ["dentists"],
  { revalidate: REFERENCE_REVALIDATE, tags: ["dentists"] },
);

/** React `cache` wrapper — shares one read across the layout + footer + page
 *  within a single request. Independent of the data cache above. */
export const getSharedPresentableHours = cache(getCachedClinicHours);