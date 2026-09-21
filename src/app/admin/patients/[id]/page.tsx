import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Cake, Mail, Phone, StickyNote } from "lucide-react";
import { requireStaffPage } from "@/lib/server/access";
import { getPatient } from "@/lib/server/patients";
import { prisma } from "@/lib/prisma";
import { StatusPill } from "@/components/admin/status-pill";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatTime } from "@/lib/site";

export const metadata: Metadata = { title: "Patient" };

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStaffPage();
  const { id } = await params;
  const patient = await getPatient(user, id);

  const history = await prisma.appointment.findMany({
    where: { patientId: patient.id },
    orderBy: { startsAt: "desc" },
    include: {
      service: { select: { name: true } },
      dentist: { select: { name: true } },
    },
  });

  return (
    <>
      <div className="mb-6">
        <Link
          href="/admin/patients"
          className="inline-flex items-center gap-2 text-sm font-bold text-pine-800 underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to patients
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Card as="section" aria-label="Patient details" variant="table">
            <div className="border-b border-pine-900/8 px-6 py-5">
              <h1 className="text-2xl font-bold tracking-tight text-ink">
                {patient.firstName} {patient.lastName}
              </h1>
            </div>
            <dl className="divide-y divide-pine-900/8">
              <div className="px-6 py-4">
                <dt className="flex items-center gap-2 text-sm font-semibold text-ink-faint">
                  <Mail className="size-4" aria-hidden="true" /> Email
                </dt>
                <dd className="mt-1 text-sm font-medium text-ink">
                  <a className="underline-offset-4 hover:underline" href={`mailto:${patient.email}`}>
                    {patient.email}
                  </a>
                </dd>
              </div>
              <div className="px-6 py-4">
                <dt className="flex items-center gap-2 text-sm font-semibold text-ink-faint">
                  <Phone className="size-4" aria-hidden="true" /> Phone
                </dt>
                <dd className="mt-1 text-sm font-medium text-ink">{patient.phone}</dd>
              </div>
              {patient.dateOfBirth && (
                <div className="px-6 py-4">
                  <dt className="flex items-center gap-2 text-sm font-semibold text-ink-faint">
                    <Cake className="size-4" aria-hidden="true" /> Date of birth
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-ink">
                    {formatDate(patient.dateOfBirth, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </dd>
                </div>
              )}
              <div className="px-6 py-4">
                <dt className="flex items-center gap-2 text-sm font-semibold text-ink-faint">
                  <StickyNote className="size-4" aria-hidden="true" /> Notes
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm font-medium text-ink">
                  {patient.notes || "—"}
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        <section
          aria-labelledby="history-heading"
          className="lg:col-span-3"
        >
          <h2
            id="history-heading"
            className="mb-4 text-lg font-bold tracking-tight text-ink"
          >
            Visit history
          </h2>
          {history.length === 0 ? (
            <EmptyState compact title="No visits recorded yet" />
          ) : (
            <Card as="ul" variant="table">
              {history.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/admin/appointments/${a.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-pine-900/5"
                  >
                    <span className="min-w-36 text-sm font-bold tabular-nums text-ink">
                      {formatDate(a.startsAt, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}{" "}
                      · {formatTime(a.startsAt)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {a.service.name}
                      </span>
                      <span className="block text-xs text-ink-faint">
                        {a.dentist ? a.dentist.name : "Flexible"} · {a.reference}
                      </span>
                    </span>
                    <StatusPill status={a.status} />
                  </Link>
                </li>
              ))}
            </Card>
          )}
        </section>
      </div>
    </>
  );
}