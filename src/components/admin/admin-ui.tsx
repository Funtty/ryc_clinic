import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-faint">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card className="bg-cream p-5">
      <p className="text-sm font-semibold text-ink-faint">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-pine-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </Card>
  );
}