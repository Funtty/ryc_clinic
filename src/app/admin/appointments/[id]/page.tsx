import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, User } from "lucide-react";
import { requireStaffPage } from "@/lib/server/access";
import { getAppointment } from "@/lib/server/appointments";
import { listPaymentsForAppointment } from "@/lib/server/payments/engine";
import { AppointmentActions } from "@/components/admin/appointment-actions";
import { StatusPill } from "@/components/admin/status-pill";
import { PaymentStatusPill } from "@/components/admin/payment-status-pill";
import { PaymentConfirmButton } from "@/components/admin/payment-confirm-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime, site } from "@/lib/site";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Appointment" };

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStaffPage();
  const { id } = await params;
  const appointment = await getAppointment(user, id);
  const payments = await listPaymentsForAppointment(id);

  return (
    <>
      <div className="mb-6">
        <Link
          href="/admin/appointments"
          className="inline-flex items-center gap-2 text-sm font-bold text-pine-800 underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to appointments
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {appointment.patient.firstName} {appointment.patient.lastName}
        </h1>
        <StatusPill status={appointment.status} />
        <span className="rounded-full bg-pine-900/5 px-3 py-0.5 text-xs font-bold tracking-wide text-ink-faint">
          {appointment.reference}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card as="section" aria-label="Details" variant="table">
            <dl className="divide-y divide-pine-900/8">
              <Row label="Date">
                {formatDate(appointment.startsAt, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Row>
              <Row label="Time">
                {formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)} ({site.timeZone})
              </Row>
              <Row label="Service">{appointment.service.name}</Row>
              <Row label="Duration">{appointment.durationMinutes} minutes</Row>
              <Row label="Price">
                {appointment.service.price != null
                  ? formatMoney(appointment.service.price)
                  : "Price on consultation"}
              </Row>
              <Row label="Dentist">
                {appointment.dentist ? appointment.dentist.name : "Flexible (auto-assign)"}
              </Row>
              {appointment.cancellationReason && (
                <Row label="Cancellation reason">
                  {appointment.cancellationReason}
                </Row>
              )}
            </dl>
          </Card>

          {appointment.notes && (
            <Card as="section" aria-label="Staff notes" className="p-6">
              <h2 className="font-display text-lg font-semibold text-ink">
                Staff notes
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-sub">
                {appointment.notes}
              </p>
            </Card>
          )}
        </div>

        <aside className="space-y-6 lg:col-span-2">
          <Card as="section" aria-label="Actions" className="p-6">
            <h2 className="mb-4 font-display text-lg font-semibold text-ink">
              Manage visit
            </h2>
            <AppointmentActions
              appointmentId={appointment.id}
              status={appointment.status}
            />
          </Card>

          {payments.length > 0 && (
            <Card as="section" aria-label="Deposit" className="p-6">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-ink">
                Deposit
                <Link
                  href="/admin/payments"
                  className="ml-auto text-xs font-bold text-pine-800 underline-offset-4 hover:underline"
                >
                  View all
                </Link>
              </h2>
              <ul className="space-y-3">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-pine-900/5 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">
                        {p.paymentRef} · {formatMoney(p.amountCents / 100, p.currency)}
                      </span>
                      <span className="block text-xs text-ink-faint">
                        {p.provider}
                        {p.provider === "bank_transfer" && p.status === "PENDING" && (
                          <span className="ml-1 font-semibold text-gold-700">
                            · {p.patientReportedAt ? "client reports transfer made — check bank" : "awaiting transfer"}
                          </span>
                        )}
                      </span>
                    </span>
                    <PaymentStatusPill status={p.status} />
                    {p.provider === "bank_transfer" && p.status === "PENDING" && (
                      <PaymentConfirmButton paymentId={p.id} />
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card as="section" aria-label="Patient contact" className="p-6">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-ink">
              <User className="size-4 text-pine-800" aria-hidden="true" />
              Patient
            </h2>
            <p className="text-sm font-bold text-ink">
              {appointment.patient.firstName} {appointment.patient.lastName}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-ink-sub">
              <Mail className="size-4 text-pine-800" aria-hidden="true" />
              <a className="underline-offset-4 hover:underline" href={`mailto:${appointment.patient.email}`}>
                {appointment.patient.email}
              </a>
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-ink-sub">
              <Phone className="size-4 text-pine-800" aria-hidden="true" />
              {appointment.patient.phone}
            </p>
            <Button
              href={`/admin/patients/${appointment.patient.id}`}
              variant="outline"
              className="mt-4 h-10 px-5"
            >
              View patient history
            </Button>
          </Card>
        </aside>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 px-6 py-4">
      <dt className="text-sm font-semibold text-ink-faint">{label}</dt>
      <dd className="col-span-2 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}