import type { Metadata } from "next";
import { authorizeAdminPage } from "@/lib/server/access";
import { listAuditLogs } from "@/lib/server/admin";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { NotAuthorized } from "@/components/admin/not-authorized";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Audit log" };

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Sign in",
  "appointment.create": "Appointment booked",
  "appointment.pending": "Marked pending",
  "appointment.confirmed": "Confirmed",
  "appointment.rescheduled": "Rescheduled",
  "appointment.cancelled": "Cancelled",
  "appointment.completed": "Completed",
  "appointment.no_show": "No show",
  "patient.create": "Patient created",
  "patient.update": "Patient updated",
  "service.create": "Service created",
  "service.update": "Service updated",
  "dentist.create": "Dentist added",
  "dentist.update": "Dentist updated",
  "user.create": "Staff user created",
  "user.update": "Staff user updated",
  "clinic_hours.update": "Opening hours updated",
  "schedule.upsert": "Dentist schedule set",
  "schedule.delete": "Dentist schedule removed",
  "blocked_date.create": "Closure added",
  "blocked_date.delete": "Closure removed",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

type SearchParams = Promise<{
  action?: string;
  entityType?: string;
}>;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await authorizeAdminPage();
  if (!user) return <NotAuthorized />;
  const params = await searchParams;
  const { rows, total } = await listAuditLogs(user, {
    action: params.action || undefined,
    entityType: params.entityType || undefined,
    limit: 100,
  });

  return (
    <>
      <AdminPageHeader
        title="Audit log"
        description="An immutable trail of sensitive actions. Shown newest first (up to 100)."
      />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-faint">Action</span>
          <input
            type="text"
            name="action"
            defaultValue={params.action ?? ""}
            placeholder="e.g. appointment.confirmed"
            className="input-field h-12 w-64"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-faint">Entity type</span>
          <input
            type="text"
            name="entityType"
            defaultValue={params.entityType ?? ""}
            placeholder="e.g. patient"
            className="input-field h-12 w-64"
          />
        </label>
        <Button type="submit" className="h-12 px-6">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState compact title={params.action || params.entityType ? "No log entries match this filter" : "No log entries yet"} />
      ) : (
        <Card variant="table">
          <ul className="divide-y divide-pine-900/8">
            {rows.map((row) => (
              <li key={row.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs font-bold tabular-nums text-ink-faint">
                    {new Date(row.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  <Badge tone="info" className="capitalize">
                    {actionLabel(row.action)}
                  </Badge>
                  <span className="text-sm text-ink-sub">
                    {row.user ? row.user.name : "System"}
                  </span>
                </div>
                {(row.entityType || row.meta) && (
                  <p className="mt-1 truncate font-mono text-xs text-ink-faint">
                    {row.entityType && (
                      <>
                        {row.entityType}
                        {row.entityId ? `:${row.entityId.slice(0, 10)}` : ""}
                      </>
                    )}
                    {row.meta ? ` · ${row.meta}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {total > rows.length && (
        <p className="mt-4 text-sm text-ink-faint">
          Showing {rows.length} of {total} matching entries. Refine the filters to narrow results.
        </p>
      )}
    </>
  );
}