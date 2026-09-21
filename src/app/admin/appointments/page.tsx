import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, ArrowUpDown } from "lucide-react";
import { requireStaffPage } from "@/lib/server/access";
import { listAppointments } from "@/lib/server/appointments";
import { listDentistsAdmin } from "@/lib/server/dentists";
import { listServicesAdmin } from "@/lib/server/services";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { StatusPill } from "@/components/admin/status-pill";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { APPOINTMENT_STATUSES } from "@/lib/constants";
import { site, formatDate, formatTime } from "@/lib/site";
import { dayKeyFromNow, localMidnightUTC } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Appointments" };

type SearchParams = Promise<{
  q?: string;
  date?: string;
  dentist?: string;
  service?: string;
  status?: string;
  period?: string;
  order?: string;
}>;

const PERIODS = ["today", "upcoming", "past", "all"] as const;
type Period = (typeof PERIODS)[number];

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireStaffPage();
  const params = await searchParams;
  const [dentists, services] = await Promise.all([
    listDentistsAdmin(user),
    listServicesAdmin(user),
  ]);

  const dateKey =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : dayKeyFromNow(0, site.timeZone);
  const order = params.order === "desc" ? "desc" : "asc";
  const period = (PERIODS as readonly string[]).includes(params.period ?? "")
    ? (params.period as Period)
    : "upcoming";

  const todayStart = new Date(localMidnightUTC(dateKey, site.timeZone));
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 3600_000);
  const now = new Date();

  let from: Date | undefined;
  let to: Date | undefined;
  if (period === "today") {
    from = todayStart;
    to = tomorrowStart;
  } else if (period === "upcoming") {
    from = now;
    to = undefined;
  } else if (period === "past") {
    from = undefined;
    to = now;
  }

  const appointments = await listAppointments(user, {
    q: params.q,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(params.dentist ? { dentistId: params.dentist } : {}),
    ...(params.service ? { serviceId: params.service } : {}),
    ...(params.status ? { status: params.status } : {}),
    order,
  });

  const qs = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const entries: Array<[string, string | undefined]> = [
      ["q", params.q],
      ["dentist", params.dentist],
      ["service", params.service],
      ["status", params.status],
      ...Object.entries(overrides),
    ];
    for (const [k, v] of entries) {
      if (v) p.set(k, v);
    }
    const s = p.toString();
    return s ? `/admin/appointments?${s}` : "/admin/appointments";
  };

  return (
    <>
      <AdminPageHeader
        title="Appointments"
        description="Book (from the phone/desk), confirm, reschedule and complete visits."
        actions={
          <Button href="/admin/appointments/new">
            <CalendarPlus className="size-4" aria-hidden="true" />
            New appointment
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-1 rounded-full bg-pine-900/5 p-1 sm:w-fit">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={qs({ period: p === "today" ? "" : p })}
            aria-current={period === p ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-bold capitalize transition-colors",
              period === p ? "bg-pine-900 text-cream" : "text-ink-faint hover:text-ink",
            )}
          >
            {p}
          </Link>
        ))}
      </div>

      <Card
        as="form"
        method="get"
        className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-faint">Search</span>
          <input
            type="search"
            name="q"
            placeholder="Reference, patient, email, phone or service…"
            defaultValue={params.q ?? ""}
            className="input-field w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-faint">Date</span>
          <input
            type="date"
            name="date"
            defaultValue={params.date ?? dateKey}
            className="input-field w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-faint">Dentist</span>
          <select name="dentist" defaultValue={params.dentist ?? ""} className="input-field w-full">
            <option value="">All dentists</option>
            {dentists.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-faint">Service</span>
          <select name="service" defaultValue={params.service ?? ""} className="input-field w-full">
            <option value="">All services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-faint">Status</span>
          <select name="status" defaultValue={params.status ?? ""} className="input-field w-full">
            <option value="">All statuses</option>
            {APPOINTMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <input type="hidden" name="period" value={period} />
        <input type="hidden" name="order" value={order} />
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center self-end rounded-full bg-pine-900 px-6 text-sm font-bold text-cream transition-colors hover:bg-pine-700"
        >
          Filter
        </button>
      </Card>

      <div className="mb-4 flex items-center justify-end">
        <Link
          href={qs({ period: period === "today" ? "" : period, order: order === "asc" ? "desc" : "asc" })}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-pine-800 underline-offset-4 hover:underline"
        >
          <ArrowUpDown className="size-4" aria-hidden="true" />
          Earliest first{order === "desc" && " · latest first"}
        </Link>
      </div>

      {appointments.length === 0 ? (
        <EmptyState compact title="No appointments match this view" />
      ) : (
        <Card as="ul" variant="table">
          {appointments.map((a) => (
            <li key={a.id}>
              <Link
                href={`/admin/appointments/${a.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-pine-900/5"
              >
                <span className="min-w-36 text-sm font-bold tabular-nums text-ink">
                  {formatDate(a.startsAt, { month: "short", day: "numeric" })} ·{" "}
                  {formatTime(a.startsAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {a.patient.firstName} {a.patient.lastName} · {a.service.name}
                  </span>
                  <span className="block text-xs text-ink-faint">
                    {a.dentist ? a.dentist.name : "Flexible (auto-assign)"} ·{" "}
                    {a.reference}
                  </span>
                </span>
                <StatusPill status={a.status} />
              </Link>
            </li>
          ))}
        </Card>
      )}
    </>
  );
}