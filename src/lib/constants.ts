export const APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "RESCHEDULED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "RESCHEDULED",
];

export const ROLES = ["ADMIN", "STAFF"] as const;
export type Role = (typeof ROLES)[number];

export const ENQUIRY_STATUSES = ["NEW", "READ", "ARCHIVED"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

/** Weekday labels, Sunday→Saturday. Pure/client-safe so components can use it. */
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;