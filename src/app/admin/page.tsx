import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { requireStaffPage } from "@/lib/server/access";
import { getAdminOverview } from "@/lib/server/stats";
import { AdminPageHeader, StatCard } from "@/components/admin/admin-ui";
import { StatusPill } from "@/components/admin/status-pill";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatTime } from "@/lib/site";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/constants";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const user = await requireStaffPage();
  const { counts, cohort, today, upcoming, todayKey } = await getAdminOverview(user);

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description={`Welcome back. Here is what is happening today (${formatDate(new Date(), { weekday: "long", month: "long", day: "numeric" })}).`}
        actions={
          <Button href="/admin/appointments/new">
            <CalendarPlus className="size-4" aria-hidden="true" />
            Book an appointment
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Appointments today"
          value={counts.todayActive}
          hint={
            counts.todayBooked === counts.todayActive
              ? `${counts.todayBooked} booked · no outcomes recorded yet`
              : `${counts.todayBooked} booked · ${counts.todayBooked - counts.todayActive} already resolved`
          }
        />
        <StatCard
          label="Pending confirmation"
          value={counts.pendingCount}
          hint="Awaiting confirmation"
        />
        <StatCard
          label="Next 7 days"
          value={counts.next7Days}
          hint="Live/booked visits"
        />
        <StatCard
          label="No-shows · last 30 days"
          value={cohort.noShow}
          hint={`${cohort.noShowRate}% of visits faced (completed + no-shows)`}
        />
        <StatCard
          label="Cancellations · last 30 days"
          value={cohort.cancelled}
          hint={`${cohort.cancellationRate}% of the 30-day cohort (${cohort.total} scheduled)`}
        />
        <StatCard label="Patients on file" value={counts.patientsTotal} hint="All patients" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatCard label="Active services" value={counts.servicesActive} hint="Bookable on public site" />
        <StatCard label="Active dentists" value={counts.dentistsActive} hint="In clinic" />
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-2">
        <TodaySection today={today} todayKey={todayKey} />
        <UpcomingSection upcoming={upcoming} />
      </div>
    </>
  );
}

function TodaySection({
  today,
  todayKey,
}: {
  today: Awaited<ReturnType<typeof getAdminOverview>>["today"];
  todayKey: string;
}) {
  const live = today.filter((a) =>
    [...ACTIVE_APPOINTMENT_STATUSES].includes(a.status as never),
  );

  return (
    <section aria-labelledby="today-heading">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2
          id="today-heading"
          className="text-lg font-bold tracking-tight text-ink"
        >
          Today&apos;s schedule
        </h2>
        <Link
          href={`/admin/calendar?view=day&date=${todayKey}`}
          className="text-sm font-bold text-pine-800 underline-offset-4 hover:underline"
        >
          Open calendar
        </Link>
      </div>

      {live.length === 0 ? (
        <EmptyState compact title="No visits on the books today" />
      ) : (
        <Card as="ul" variant="table" aria-label="Today's appointments">
          {live.map((a) => (
            <li key={a.id}>
              <Link
                href={`/admin/appointments/${a.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-pine-900/5"
              >
                <span className="min-w-20 text-sm font-bold tabular-nums text-ink">
                  {formatTime(a.startsAt)}
                </span>
                <span className="flex-1 min-w-48">
                  <span className="block text-sm font-semibold text-ink">
                    {a.patient.firstName} {a.patient.lastName}
                  </span>
                  <span className="block text-xs text-ink-faint">
                    {a.service.name}
                    {a.dentist ? ` · ${a.dentist.name}` : ""}
                  </span>
                </span>
                <StatusPill status={a.status} />
              </Link>
            </li>
          ))}
        </Card>
      )}
    </section>
  );
}

function UpcomingSection({
  upcoming,
}: {
  upcoming: Awaited<ReturnType<typeof getAdminOverview>>["upcoming"];
}) {
  return (
    <section aria-labelledby="upcoming-heading">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2
          id="upcoming-heading"
          className="text-lg font-bold tracking-tight text-ink"
        >
          Upcoming appointments
        </h2>
        <Link
          href="/admin/appointments?period=upcoming"
          className="text-sm font-bold text-pine-800 underline-offset-4 hover:underline"
        >
          View all
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <EmptyState compact title="No upcoming appointments right now" />
      ) : (
        <Card as="ul" variant="table" aria-label="Upcoming appointments">
          {upcoming.map((a) => (
            <li key={a.id}>
              <Link
                href={`/admin/appointments/${a.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-pine-900/5"
              >
                <span className="min-w-28 text-sm font-bold tabular-nums text-ink">
                  {formatDate(a.startsAt, { weekday: "short", month: "short", day: "numeric" })}{" "}
                  · {formatTime(a.startsAt)}
                </span>
                <span className="flex-1 min-w-48">
                  <span className="block text-sm font-semibold text-ink">
                    {a.patient.firstName} {a.patient.lastName}
                  </span>
                  <span className="block text-xs text-ink-faint">
                    {a.service.name}
                    {a.dentist ? ` · ${a.dentist.name}` : ""}
                  </span>
                </span>
                <StatusPill status={a.status} />
              </Link>
            </li>
          ))}
        </Card>
      )}
    </section>
  );
}