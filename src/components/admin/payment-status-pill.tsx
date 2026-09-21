import { Badge, type BadgeTone } from "@/components/ui/badge";

const TONES: Record<string, BadgeTone> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "error",
  CANCELLED: "muted",
  EXPIRED: "muted",
  REFUNDED: "deep",
};

const LABELS: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  REFUNDED: "Refunded",
};

/** Payment status chip — PHI-safe labels only (no patient identity). */
export function PaymentStatusPill({ status }: { status: string }) {
  return (
    <Badge tone={TONES[status] ?? "soft"} className="uppercase">
      {LABELS[status] ?? status}
    </Badge>
  );
}