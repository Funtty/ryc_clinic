import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { site } from "@/lib/site";
import { getBookableSlotsForDay } from "@/lib/availability";
import { dayKeyFromNow, dayKeyLocal } from "@/lib/datetime";
import { errors } from "@/lib/server/errors";
import { ok, toErrorResponse } from "@/lib/server/route-helpers";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

const SLOTS_LIMIT = { limit: 240, windowMs: 60 * 1000 };

export async function GET(req: NextRequest) {
  try {
    checkRateLimit(`slots:ip:${clientIp(req)}`, SLOTS_LIMIT);
    const serviceId = req.nextUrl.searchParams.get("service");
    const dentistId = req.nextUrl.searchParams.get("dentist");
    const date = req.nextUrl.searchParams.get("date");

    if (!serviceId || !date || !dateKeyPattern.test(date)) {
      throw errors.validation({ message: "service and a YYYY-MM-DD date are required" });
    }

    const today = dayKeyLocal(new Date(), site.timeZone);
    const horizon = dayKeyFromNow(90, site.timeZone);
    if (date < today || date > horizon) {
      throw errors.validation({ message: "date must be between today and 90 days ahead" });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, durationMinutes: true, isActive: true },
    });
    if (!service || !service.isActive) throw errors.notFound("Service");

    if (dentistId) {
      const dentist = await prisma.dentist.findUnique({
        where: { id: dentistId },
        select: { id: true, isActive: true },
      });
      if (!dentist || !dentist.isActive) throw errors.notFound("Dentist");
    }

    const daySlots = await getBookableSlotsForDay(date, {
      durationMinutes: service.durationMinutes,
      serviceId,
      timeZone: site.timeZone,
    });

    const matches = dentistId ? daySlots.filter((s) => s.dentist.id === dentistId) : daySlots;

    // One entry per start instant. Dentists are in sortOrder, so the first
    // dentist for an instant is the one the booking server will pin.
    const seen = new Map<number, { startIso: string; endIso: string; dentist: { id: string; name: string } }>();
    for (const s of matches) {
      const key = s.start.getTime();
      if (seen.has(key)) continue;
      seen.set(key, {
        startIso: s.start.toISOString(),
        endIso: s.end.toISOString(),
        dentist: { id: s.dentist.id, name: s.dentist.name },
      });
    }

    const slots = [...seen.values()].sort((a, b) => a.startIso.localeCompare(b.startIso));

    return ok({ date, slots });
  } catch (e) {
    return toErrorResponse(e);
  }
}