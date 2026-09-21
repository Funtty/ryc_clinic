import { z } from "zod";
import { withAuth, ok, readJson } from "@/lib/server/route-helpers";
import { createAppointment } from "@/lib/server/appointments";
import { errors } from "@/lib/server/errors";
import { site } from "@/lib/site";
import { localTimeToUTC } from "@/lib/datetime";

export const runtime = "nodejs";

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export const POST = withAuth(async (user, req, _ctx) => {
  const payload = await readJson(req);
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());

  const { date, time, patientId, serviceId, dentistId, notes } = parsed.data;
  const [, hh, mm] = TIME_RE.exec(time)!;
  const startsAt = localTimeToUTC(
    date,
    Number(hh) * 60 + Number(mm),
    site.timeZone,
  );
  if (startsAt.getTime() <= Date.now()) {
    throw errors.validation({
      time: ["Pick a time in the future"],
    });
  }

  const appointment = await createAppointment(user, {
    patientId,
    serviceId,
    dentistId,
    startsAt,
    notes,
  });
  return ok({ appointment }, 201);
});

const createSchema = z.object({
  patientId: z.string().min(1).max(64),
  serviceId: z.string().min(1).max(64),
  dentistId: z.string().min(1).max(64).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date"),
  time: z.string().regex(TIME_RE, "Use a HH:MM time"),
  notes: z.string().trim().max(2000).default(""),
});