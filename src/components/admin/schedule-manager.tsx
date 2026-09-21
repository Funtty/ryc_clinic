"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { DAY_LABELS } from "@/lib/constants";
import { minutesToClock } from "@/lib/datetime";

type ClinicHoursRow = {
  id: string;
  dayOfWeek: number;
  openMinutes: number;
  closeMinutes: number;
  isClosed: boolean;
};

type ScheduleRow = {
  id: string;
  dentistId: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  isClosed: boolean;
  dentist?: { id: string; name: string; slug: string };
};

type BlockedDate = {
  id: string;
  date: string;
  dentist?: { id: string; name: string } | null;
  reason: string | null;
};

type DentistLike = { id: string; name: string };

const TIME_OPTIONS = (() => {
  const out: { value: number; label: string }[] = [];
  for (let m = 0; m < 1440; m += 30) out.push({ value: m, label: minutesToClock(m) });
  return out;
})();

export function ScheduleManager({
  clinicHours,
  schedules,
  blockedDates,
  dentists,
}: {
  clinicHours: ClinicHoursRow[];
  schedules: ScheduleRow[];
  blockedDates: BlockedDate[];
  dentists: DentistLike[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [hours, setHours] = useState<ClinicHoursRow[]>(
    clinicHours.map((h) => ({ ...h })),
  );
  const [sch, setSch] = useState<ScheduleRow[]>(schedules.map((s) => ({ ...s })));
  const [newBlocked, setNewBlocked] = useState({
    date: "",
    dentistId: "",
    reason: "",
  });

  const api = async (path: string, init?: RequestInit) => {
    const res = await fetch(path, init);
    const data = (await res.json()) as { error?: { message?: string } };
    if (!res.ok) throw new Error(data.error?.message ?? "Request failed.");
    return data;
  };

  const setGlobalError = (e: unknown) => {
    setError(e instanceof Error ? e.message : "Request failed.");
  };

  const saveHours = async () => {
    setError(null);
    setSaveMsg(null);
    try {
      await api("/api/admin/clinic-hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          hours.map((h) => ({
            dayOfWeek: h.dayOfWeek,
            openMinutes: h.isClosed ? 0 : h.openMinutes,
            closeMinutes: h.isClosed ? 0 : h.closeMinutes,
            isClosed: h.isClosed,
          })),
        ),
      });
      setSaveMsg("Opening hours saved.");
      router.refresh();
    } catch (e) {
      setGlobalError(e);
    }
  };

  const patchHours = (
    dayOfWeek: number,
    field: keyof Omit<ClinicHoursRow, "id" | "dayOfWeek">,
    value: string | number | boolean,
  ) => {
    setHours((rows) =>
      rows.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, [field]: value } : r)),
    );
  };

  const upsertScheduleRow = async (row: ScheduleRow) => {
    setError(null);
    try {
      await api("/api/admin/scheduling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "schedule",
          dentistId: row.dentistId,
          dayOfWeek: row.dayOfWeek,
          startMinutes: row.isClosed ? 0 : row.startMinutes,
          endMinutes: row.isClosed ? 0 : row.endMinutes,
          isClosed: row.isClosed,
        }),
      });
      router.refresh();
    } catch (e) {
      setGlobalError(e);
    }
  };

  const patchDentistSchedule = (dentistId: string, dayOfWeek: number, patch: Partial<ScheduleRow>) => {
    const existing = sch.find((s) => s.dentistId === dentistId && s.dayOfWeek === dayOfWeek);
    if (existing) {
      setSch((rows) => rows.map((r) => (r === existing ? { ...r, ...patch } : r)));
      void upsertScheduleRow({ ...existing, ...patch });
    } else {
      const fresh: ScheduleRow = {
        id: "new",
        dentistId,
        dayOfWeek,
        startMinutes: 480,
        endMinutes: 1020,
        isClosed: false,
        ...patch,
      };
      setSch((rows) => [...rows, fresh]);
      void upsertScheduleRow(fresh);
    }
  };

  const createBlocked = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaveMsg(null);
    try {
      await api("/api/admin/scheduling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "blocked-date",
          date: newBlocked.date,
          dentistId: newBlocked.dentistId || undefined,
          reason: newBlocked.reason || undefined,
        }),
      });
      setNewBlocked({ date: "", dentistId: "", reason: "" });
      setSaveMsg("Blocked date added.");
      router.refresh();
    } catch (err) {
      setGlobalError(err);
    }
  };

  const deleteBlocked = async (id: string) => {
    setError(null);
    try {
      await api(`/api/admin/scheduling?kind=blocked-date&id=${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setGlobalError(e);
    }
  };

  return (
    <div className="space-y-8">
      {error && <Alert tone="error" title={error} />}
      {saveMsg && !error && <Alert tone="success" title={saveMsg} />}

      <Section title="Clinic opening hours" subtitle="Applies to all dentists; individual schedules can tighten these further.">
        <div className="space-y-2">
          {hours
            .slice()
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            .map((row) => (
              <div key={row.dayOfWeek} className="grid grid-cols-[5rem_1fr_1fr] items-center gap-3">
                <span className="text-sm font-bold text-ink">{DAY_LABELS[row.dayOfWeek]}</span>
                <label className="flex items-center gap-2 text-sm font-semibold text-ink-sub">
                  <input
                    type="checkbox"
                    checked={row.isClosed}
                    onChange={(e) => patchHours(row.dayOfWeek, "isClosed", e.target.checked)}
                    className="size-4 accent-pine-900"
                  />
                  Closed
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={row.openMinutes}
                    disabled={row.isClosed}
                    onChange={(e) => patchHours(row.dayOfWeek, "openMinutes", Number(e.target.value))}
                    className="input-field flex-1 disabled:opacity-50"
                    aria-label={`${DAY_LABELS[row.dayOfWeek]} opening time`}
                  >
                    {TIME_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span className="text-xs text-ink-faint">–</span>
                  <select
                    value={row.closeMinutes}
                    disabled={row.isClosed}
                    onChange={(e) => patchHours(row.dayOfWeek, "closeMinutes", Number(e.target.value))}
                    className="input-field flex-1 disabled:opacity-50"
                    aria-label={`${DAY_LABELS[row.dayOfWeek]} closing time`}
                  >
                    {TIME_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
        </div>
        <Button type="button" className="mt-4" onClick={() => void saveHours()}>
          Save opening hours
        </Button>
      </Section>

      <Section title="Dentist availability" subtitle="Per-dentist weekly hours. Times are stored in the clinic timezone.">
        {dentists.length === 0 ? (
          <p className="text-sm text-ink-faint">Add dentists first to configure their hours.</p>
        ) : (
          <div className="space-y-6">
            {dentists.map((d) => (
              <div key={d.id}>
                <h3 className="mb-2 text-sm font-bold text-ink">{d.name}</h3>
                <div className="space-y-2">
                  {DAY_LABELS.map((label, day) => {
                    const row = sch.find((s) => s.dentistId === d.id && s.dayOfWeek === day);
                    return (
                      <div key={day} className="grid grid-cols-[5rem_1fr_1fr] items-center gap-3">
                        <span className="text-sm font-semibold text-ink-sub">{label}</span>
                        <label className="flex items-center gap-2 text-sm text-ink-sub">
                          <input
                            type="checkbox"
                            checked={!!row?.isClosed}
                            onChange={(e) =>
                              patchDentistSchedule(d.id, day, { isClosed: e.target.checked })
                            }
                            className="size-4 accent-pine-900"
                          />
                          Off
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={row ? row.startMinutes : 480}
                            disabled={!!row?.isClosed}
                            onChange={(e) =>
                              patchDentistSchedule(d.id, day, { startMinutes: Number(e.target.value) })
                            }
                            className="input-field flex-1 disabled:opacity-50"
                            aria-label={`${d.name} ${label} start`}
                          >
                            {TIME_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <span className="text-xs text-ink-faint">–</span>
                          <select
                            value={row ? row.endMinutes : 1020}
                            disabled={!!row?.isClosed}
                            onChange={(e) =>
                              patchDentistSchedule(d.id, day, { endMinutes: Number(e.target.value) })
                            }
                            className="input-field flex-1 disabled:opacity-50"
                            aria-label={`${d.name} ${label} end`}
                          >
                            {TIME_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Blocked dates & holidays" subtitle="Clinic-wide closure if no dentist is chosen, otherwise just that dentist.">
        <form onSubmit={createBlocked} className="grid gap-4 sm:grid-cols-3">
          <Field label="Date" htmlFor="bd-date" required>
            <Input id="bd-date" type="date" required value={newBlocked.date} onChange={(e) => setNewBlocked((v) => ({ ...v, date: e.target.value }))} />
          </Field>
          <Field label="Dentist" htmlFor="bd-dentist" hint="Leave blank for a clinic-wide closure.">
            <Select id="bd-dentist" value={newBlocked.dentistId} onChange={(e) => setNewBlocked((v) => ({ ...v, dentistId: e.target.value }))}>
              <option value="">Whole clinic</option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Reason (optional)" htmlFor="bd-reason">
            <Input id="bd-reason" value={newBlocked.reason} onChange={(e) => setNewBlocked((v) => ({ ...v, reason: e.target.value }))} placeholder="e.g. Public holiday" />
          </Field>
          <Button type="submit" className="sm:col-start-3">
            <Plus className="size-4" aria-hidden="true" />
            Add blocked date
          </Button>
        </form>

        {blockedDates.length === 0 ? (
          <EmptyState compact className="mt-4" title="No closures recorded" />
        ) : (
          <ul className="mt-4 space-y-2">
            {blockedDates.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-pine-900/8 bg-cream px-4 py-3 text-sm">
                <span className="font-bold tabular-nums text-ink">{b.date}</span>
                <span className="flex-1 text-ink-sub">
                  {b.dentist ? b.dentist.name : "Whole clinic"}
                  {b.reason ? ` · ${b.reason}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => void deleteBlocked(b.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-error/30 px-3 text-xs font-bold text-error transition-colors hover:bg-error hover:text-cream"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card as="section" className="p-6">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      {subtitle && <p className="mb-4 mt-1 text-sm text-ink-faint">{subtitle}</p>}
      {children}
    </Card>
  );
}