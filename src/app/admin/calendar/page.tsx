import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { requireStaffPage } from "@/lib/server/access";
import {
  getMonthCalendar,
  getDayAppointments,
  getWeekCalendar,
} from "@/lib/server/calendar";
import { listDentistsAdmin } from "@/lib/server/dentists";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { StatusPill } from "@/components/admin/status-pill";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { site, formatTime } from "@/lib/site";
import { addDaysToKey, dayKeyLocal, weekdayOfDateKey } from "@/lib/datetime";
import { DAY_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

type SearchParams = Promise<{
  view?: string;
  date?: string;
  dentist?: string;
}>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value?: string): string {
  return value && DATE_RE.test(value) ? value : dayKeyLocal(new Date(), site.timeZone);
}

function monthParam(anchor: string, delta: number): string {
  const [y, m] = anchor.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  dt.setUTCMonth(dt.getUTCMonth() + delta);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function withParams(base: string, extra: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(extra)) {
    if (v && v !== "") params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireStaffPage();
  const params = await searchParams;
  const view = params.view === "day" || params.view === "week" ? params.view : "month";
  const anchor = parseDate(params.date);
  const dentistId = params.dentist && params.dentist !== "" ? params.dentist : undefined;
  const [dentists] = await Promise.all([listDentistsAdmin(user)]);

  return (
    <>
      <AdminPageHeader
        title="Clinic calendar"
        description="Month, week and daily schedules. Use the dentist filter to focus one provider."
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full bg-pine-900/5 p-1">
          {(["month", "week", "day"] as const).map((v) => (
            <Link
              key={v}
              href={withParams("/admin/calendar", {
                view: v,
                date: v === "month" ? monthParam(anchor, 0) : anchor,
                dentist: dentistId,
              })}
              aria-current={view === v ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-bold capitalize transition-colors",
                view === v
                  ? "bg-pine-900 text-cream"
                  : "text-ink-faint hover:text-ink",
              )}
            >
              {v}
            </Link>
          ))}
        </div>

        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="date" value={anchor} />
          <label className="sr-only" htmlFor="dentist-filter">
            Filter by dentist
          </label>
          <select
            id="dentist-filter"
            name="dentist"
            defaultValue={dentistId ?? ""}
            onChange={(e) => {
              const url = new URL(window.location.href);
              if (e.target.value) url.searchParams.set("dentist", e.target.value);
              else url.searchParams.delete("dentist");
              window.location.href = url.toString();
            }}
            className="input-field h-11 w-full sm:w-64"
          >
            <option value="">All dentists</option>
            {dentists.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </form>
      </div>

      <CalendarTools view={view} anchor={anchor} dentistId={dentistId} />

      {view === "month" && <MonthView anchor={anchor} dentistId={dentistId} />}
      {view === "week" && <WeekView anchor={anchor} dentistId={dentistId} />}
      {view === "day" && <DayView anchor={anchor} dentistId={dentistId} />}
    </>
  );
}

function CalendarTools({
  view,
  anchor,
  dentistId,
}: {
  view: string;
  anchor: string;
  dentistId?: string;
}) {
  const [y, m] = anchor.split("-").map(Number);
  const monthLabel = new Intl.DateTimeFormat(site.locale, {
    timeZone: site.timeZone,
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, 1)));

  let prevDate = "";
  let nextDate = "";
  let label = monthLabel;

  if (view === "month") {
    prevDate = monthParam(anchor, -1);
    nextDate = monthParam(anchor, 1);
  } else {
    prevDate = addDaysToKey(anchor, view === "week" ? -7 : -1);
    nextDate = addDaysToKey(anchor, view === "week" ? 7 : 1);
    const weekday = weekdayOfDateKey(anchor, site.timeZone);
    label = new Intl.DateTimeFormat(site.locale, {
      timeZone: site.timeZone,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(Date.UTC(y, m - 1, Number(anchor.split("-")[2]))));
    void weekday;
  }

  const today = dayKeyLocal(new Date(), site.timeZone);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Link
          href={withParams("/admin/calendar", { view, date: prevDate, dentist: dentistId })}
          className="grid size-9 place-items-center rounded-full border border-pine-900/15 text-ink-faint hover:bg-pine-900/5 hover:text-ink"
          aria-label="Previous"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
        <Link
          href={withParams("/admin/calendar", { view, date: nextDate, dentist: dentistId })}
          className="grid size-9 place-items-center rounded-full border border-pine-900/15 text-ink-faint hover:bg-pine-900/5 hover:text-ink"
          aria-label="Next"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
        <span className="text-lg font-bold tracking-tight text-ink">{label}</span>
      </div>
      <Button
        href={withParams("/admin/calendar", { view, date: today, dentist: dentistId })}
        variant="outline"
        className="h-9 px-4 text-sm"
      >
        Today
      </Button>
    </div>
  );
}

async function MonthView({ anchor, dentistId }: { anchor: string; dentistId?: string }) {
  const user = await requireStaffPage();
  const [y, m] = anchor.split("-").map(Number);
  const cells = await getMonthCalendar(user, { year: y, month: m, dentistId });

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-pine-900/8 bg-pine-900/5 text-center text-xs font-bold uppercase tracking-wide text-ink-faint">
        {DAY_LABELS.slice(1).concat(DAY_LABELS.slice(0, 1)).map((d) => (
          <div key={d} className="px-2 py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => (
          <Link
            key={cell.dateKey}
            href={withParams("/admin/calendar", {
              view: "day",
              date: cell.dateKey,
              dentist: dentistId,
            })}
            className={cn(
              "min-h-24 border-b border-r border-pine-900/8 p-2 text-left transition-colors last:border-r-0 hover:bg-pine-900/5",
              !cell.inMonth && "bg-pine-50/60 text-ink-faint",
              cell.isToday && "ring-2 ring-inset ring-pine-500",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold tabular-nums text-ink">
                {Number(cell.dateKey.slice(8, 10))}
              </span>
              {cell.total > 0 && (
                <span className="rounded-full bg-pine-900/10 px-2 py-0.5 text-xs font-bold text-pine-900">
                  {cell.total}
                </span>
              )}
            </div>
            {cell.clinicWideBlocked ? (
              <p className="mt-1 text-[11px] font-bold text-ink-faint">
                {cell.isOpenDay ? "Closure" : "Closed"}
              </p>
            ) : !cell.isOpenDay ? (
              <p className="mt-1 text-[11px] font-bold text-ink-faint">Closed</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1">
                {cell.counts.active > 0 && (
                  <LegendDot tone="active" label={`${cell.counts.active} booked`} />
                )}
                {cell.counts.completed > 0 && (
                  <LegendDot tone="completed" label={`${cell.counts.completed} done`} />
                )}
                {cell.counts.cancelled > 0 && (
                  <LegendDot tone="cancelled" label={`${cell.counts.cancelled} cancelled`} />
                )}
                {cell.counts.noShow > 0 && (
                  <LegendDot tone="noShow" label={`${cell.counts.noShow} no-show`} />
                )}
              </div>
            )}
          </Link>
        ))}
      </div>
    </Card>
  );
}

function LegendDot({ tone, label }: { tone: string; label: string }) {
  const tones: Record<string, string> = {
    active: "bg-pine-600",
    completed: "bg-emerald-600",
    cancelled: "bg-amber-600",
    noShow: "bg-rose-600",
  };
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-faint">
      <span aria-hidden="true" className={cn("size-2 rounded-full", tones[tone])} />
      {label}
    </span>
  );
}

async function WeekView({ anchor, dentistId }: { anchor: string; dentistId?: string }) {
  const user = await requireStaffPage();
  const { week, rows, appointments } = await getWeekCalendar(user, {
    startDateKey: anchor,
    dentistId,
  });

  const byDentistDay = new Map<string, (typeof appointments)[number][]>();
  for (const a of appointments) {
    const day = dayKeyLocal(a.startsAt, site.timeZone);
    const key = `${a.dentist?.id ?? "flexible"}:${day}`;
    const list = byDentistDay.get(key) ?? [];
    list.push(a);
    byDentistDay.set(key, list);
  }

  const displayRows = dentistId ? rows.filter((r) => r.id === dentistId) : rows;

  return (
    <Card className="overflow-hidden">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-pine-900/5 text-xs font-bold uppercase tracking-wide text-ink-faint">
            <th className="px-3 py-2 text-left">Dentist</th>
            {week.map((dateKey) => (
              <th key={dateKey} className="px-2 py-2 text-center">
                <Link
                  href={withParams("/admin/calendar", { view: "day", date: dateKey, dentist: dentistId })}
                  className="inline-flex flex-col items-center hover:text-pine-900"
                >
                  <span>{DAY_LABELS[weekdayOfDateKey(dateKey, site.timeZone)]}</span>
                  <span className="tabular-nums">{Number(dateKey.slice(8, 10))}</span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-8">
                <EmptyState compact title="No active dentists" />
              </td>
            </tr>
          ) : (
            displayRows.map((row) => (
              <tr key={row.id} className="border-t border-pine-900/8">
                <td className="px-3 py-2 align-top font-semibold text-ink">
                  <Link
                    href={withParams("/admin/calendar", {
                      view: "week",
                      date: anchor,
                      dentist: row.id,
                    })}
                    className="hover:text-pine-800 hover:underline"
                  >
                    {row.name}
                  </Link>
                </td>
                {week.map((dateKey) => {
                  const dow = weekdayOfDateKey(dateKey, site.timeZone);
                  const working = row.workingDays.includes(dow);
                  const list = byDentistDay.get(`${row.id}:${dateKey}`) ?? [];
                  return (
                    <td key={dateKey} className="border-l border-pine-900/8 px-1.5 py-1 align-top">
                      {!working ? (
                        <span className="text-xs text-ink-faint">—</span>
                      ) : list.length === 0 ? (
                        <span className="text-xs text-ink-faint">Free</span>
                      ) : (
                        <ul className="space-y-1">
                          {list.map((a) => (
                            <li key={a.id}>
                              <Link
                                href={`/admin/appointments/${a.id}`}
                                className="block rounded-md bg-pine-900/8 px-1.5 py-1 text-[11px] font-semibold text-ink hover:bg-pine-900/15"
                              >
                                {formatTime(a.startsAt)} · {a.patient.lastName} ·{" "}
                                <span className="font-normal text-ink-faint">{a.service.name}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

async function DayView({ anchor, dentistId }: { anchor: string; dentistId?: string }) {
  const user = await requireStaffPage();
  const { appointments, blocked } = await getDayAppointments(user, {
    dateKey: anchor,
    dentistId,
  });

  return (
    <div className="space-y-4">
      {blocked.clinicWideKeys.size > 0 && (
        <Card className="flex items-center gap-3 border-amber-300 bg-amber-50 p-4">
          <CalendarRange className="size-5 text-amber-700" aria-hidden="true" />
          <p className="text-sm font-semibold text-amber-900">
            Clinic is closed this day{blocked.reasons.get(anchor) ? ` — ${blocked.reasons.get(anchor)}` : ""}.
          </p>
        </Card>
      )}

      {appointments.length === 0 ? (
        <EmptyState
          compact
          icon={CalendarRange}
          title="No appointments this day"
          message={
            blocked.clinicWideKeys.size > 0
              ? "The clinic is closed, so nothing was booked."
              : "Nothing is scheduled. Use the day navigation or book manually."
          }
          action={
            <Button href={`/admin/appointments/new?date=${anchor}`}>
              Book an appointment
            </Button>
          }
        />
      ) : (
        <Card as="ul" variant="table" aria-label={`Appointments on ${anchor}`}>
          {appointments.map((a) => (
            <li key={a.id}>
              <Link
                href={`/admin/appointments/${a.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-pine-900/5"
              >
                <span className="min-w-20 text-sm font-bold tabular-nums text-ink">
                  {formatTime(a.startsAt)}–{formatTime(a.endsAt)}
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

      <div>
        <Button href={`/admin/appointments/new?date=${anchor}`}>
          Book on this day
        </Button>
      </div>
    </div>
  );
}