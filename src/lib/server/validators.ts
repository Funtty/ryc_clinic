import "server-only";
import { z } from "zod";
import { APPOINTMENT_STATUSES, ROLES } from "@/lib/constants";

const cuid = z.string().min(1).max(64);
const isoDate = z.coerce.date();
const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");
const minutes = z.number().int().min(0).max(1439);

export const createPatientSchema = z.object({
  email: z.string().trim().email("A valid email is required").max(254),
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  phone: z
    .string()
    .trim()
    .min(7, "A valid phone number is required")
    .max(20)
    .regex(/^\+?[0-9 ()-]+$/, "Phone may contain digits, spaces and +()-"),
  dateOfBirth: isoDate.optional(),
  notes: z.string().trim().max(2000).default(""),
});

export const updatePatientSchema = createPatientSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "Provide at least one field to update" },
);

export const createAppointmentSchema = z.object({
  patientId: cuid,
  serviceId: cuid,
  dentistId: cuid.optional(),
  startsAt: isoDate.refine((d) => d.getTime() > Date.now(), {
    message: "Appointment must start in the future",
  }),
  notes: z.string().trim().max(2000).default(""),
});

/** Patient-facing self-service booking payload (no auth). */
export const createBookingSchema = z.object({
  serviceId: cuid,
  dentistId: cuid.optional(),
  startsAt: isoDate.refine((d) => {
    const max = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    return d.getTime() > Date.now() && d.getTime() <= max.getTime();
  }, {
    message: "Booking must be scheduled within the next 90 days",
  }),
  email: z.string().trim().email("A valid email is required").max(254),
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  phone: z
    .string()
    .trim()
    .min(7, "A valid phone number is required")
    .max(20)
    .regex(/^\+?[0-9 ()-]+$/, "Phone may contain digits, spaces and +()-"),
  dateOfBirth: isoDate.optional(),
  notes: z.string().trim().max(2000).default(""),
});

export const transitionSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
  cancellationReason: z
    .string()
    .trim()
    .min(2, "A cancellation reason is required")
    .max(500)
    .optional(),
});

export const rescheduleSchema = z.object({
  startsAt: isoDate.refine((d) => d.getTime() > Date.now(), {
    message: "Appointment must start in the future",
  }),
});

export const createStaffSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().email("A valid email is required").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  role: z.enum(ROLES).default("STAFF"),
});

export const clinicHoursRowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    openMinutes: minutes,
    closeMinutes: z.number().int().min(0).max(1440),
    isClosed: z.boolean().default(false),
  })
  .refine((r) => r.isClosed || r.closeMinutes > r.openMinutes, {
    message: "Closing time must be after opening time",
  });

export const clinicHoursSchema = z
  .array(clinicHoursRowSchema)
  .length(7, "All seven days must be provided")
  .refine((rows) => new Set(rows.map((r) => r.dayOfWeek)).size === 7, {
    message: "Each weekday may appear only once",
  });

export const dentistScheduleSchema = z.object({
  dentistId: cuid,
  dayOfWeek: z.number().int().min(0).max(6),
  startMinutes: minutes,
  endMinutes: z.number().int().min(0).max(1440),
  isClosed: z.boolean().default(false),
});

export const createBlockedDateSchema = z.object({
  date: dateKey,
  dentistId: cuid.optional(),
  reason: z.string().trim().max(200).optional(),
});

export const updateStaffUserSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128)
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.password !== undefined || v.isActive !== undefined, {
    message: "Provide a password change or an active/inactive change",
  });

export const createServiceSchema = z.object({
  name: z.string().trim().min(1, "Service name is required").max(120),
  shortDescription: z.string().trim().min(1, "A short description is required").max(240),
  description: z.string().trim().min(10, "Describe the service in a bit more detail").max(4000),
  durationMinutes: z.number().int().min(15, "Minimum 15 minutes").max(480),
  price: z.number().int().min(0).max(50_000_000).nullable().optional(),
  priceLabel: z.string().trim().max(60).optional(),
  imageUrl: z.string().trim().max(300).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export const updateServiceSchema = createServiceSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "Provide at least one field to update" },
);

export const createDentistSchema = z.object({
  name: z.string().trim().min(1, "Dentist name is required").max(120),
  title: z.string().trim().min(1, "Title is required").max(120),
  bio: z.string().trim().min(10, "A short bio is required").max(2000),
  specialties: z.string().trim().max(200).default(""),
  photoUrl: z.string().trim().max(300).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export const updateDentistSchema = createDentistSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "Provide at least one field to update" },
);

export const auditLogQuerySchema = z.object({
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(80).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const listAppointmentsQuerySchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  dentistId: cuid.optional(),
  serviceId: cuid.optional(),
  patientId: cuid.optional(),
  q: z.string().trim().max(120).optional(),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export const paymentListQuerySchema = z.object({
  status: z.string().trim().max(20).optional(),
});

export const schedulingQuerySchema = z.object({
  dentistId: cuid.optional(),
  date: dateKey.optional(),
});