import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/server/access";
import { listPayments } from "@/lib/server/payments/engine";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { PaymentStatusPill } from "@/components/admin/payment-status-pill";
import { PaymentRefundButton } from "@/components/admin/payment-refund-button";
import { PaymentConfirmButton } from "@/components/admin/payment-confirm-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatTime } from "@/lib/site";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

type SearchParams = Promise<{ status?: string }>;

const PAYMENT_STATUSES = [
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
];

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminPage();
  const params = await searchParams;
  const status = params.status && PAYMENT_STATUSES.includes(params.status) ? params.status : undefined;
  const payments = await listPayments({ status });

  return (
    <>
      <AdminPageHeader
        title="Payments"
        description="Appointment deposits. Bank-transfer payments need you to check the clinic bank and confirm receipt."
      />

      <Card as="form" method="get" className="mb-6 flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-faint">
            Status
          </span>
          <select name="status" defaultValue={params.status ?? ""} className="input-field">
            <option value="">All statuses</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-full bg-pine-900 px-6 text-sm font-bold text-cream transition-colors hover:bg-pine-700"
        >
          Filter
        </button>
      </Card>

      {payments.length === 0 ? (
        <EmptyState compact title="No payments match this view" />
      ) : (
        <Card as="ul" variant="table">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
              <span className="min-w-36 text-sm font-bold tabular-nums text-ink">
                {formatDate(p.createdAt, { month: "short", day: "numeric" })} ·{" "}
                {formatTime(p.createdAt)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {p.paymentRef} · {formatMoney(p.amountCents / 100, p.currency)}
                </span>
                <span className="block text-xs text-ink-faint">
                  {p.serviceName ?? "—"} · {p.appointmentReference ?? "No appointment"} ·{" "}
                  {p.provider}
                  {p.provider === "bank_transfer" && p.status === "PENDING" && (
                    <span className="ml-2 font-semibold text-gold-700">
                      {p.patientReportedAt
                        ? "· client reports transfer made — check bank"
                        : "· awaiting transfer"}
                    </span>
                  )}
                </span>
              </span>
              {p.paidAt && (
                <span className="text-xs tabular-nums text-ink-faint">
                  {formatDate(p.paidAt)} {formatTime(p.paidAt)}
                </span>
              )}
              <PaymentStatusPill status={p.status} />
              {p.provider === "bank_transfer" && p.status === "PENDING" && (
                <>
                  <Link href={`/admin/appointments/${p.appointmentId}`} className="text-sm font-semibold text-pine-800 hover:underline">
                    View visit
                  </Link>
                  <PaymentConfirmButton paymentId={p.id} />
                </>
              )}
              {p.status === "PAID" && (
                <Link href={`/admin/appointments/${p.appointmentId}`} className="text-sm font-semibold text-pine-800 hover:underline">
                  View visit
                </Link>
              )}
              {p.status === "PAID" && (
                <PaymentRefundButton paymentId={p.id} />
              )}
            </li>
          ))}
        </Card>
      )}
    </>
  );
}