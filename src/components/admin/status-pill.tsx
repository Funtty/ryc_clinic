import { Badge, type BadgeTone } from "@/components/ui/badge";

const TONES: Record<string, BadgeTone> = {
  PENDING: "warning",
  CONFIRMED: "info",
  RESCHEDULED: "deep",
  CANCELLED: "error",
  COMPLETED: "success",
  NO_SHOW: "muted",
};

const LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  RESCHEDULED: "Rescheduled",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  NO_SHOW: "No show",
};

/** Appointment status chip, built on the shared Badge system. */
export function StatusPill({ status }: { status: string }) {
  return (
    <Badge tone={TONES[status] ?? "soft"} className="uppercase">
      {LABELS[status] ?? status}
    </Badge>
  );
}