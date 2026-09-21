"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  RotateCcw,
  UserX,
  XCircle,
} from "lucide-react";
import { Field, Input, Select } from "@/components/ui/form";
import { site } from "@/lib/site";
import { localTimeToUTC } from "@/lib/datetime";
import { Alert } from "@/components/ui/alert";

const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let h = 8; h <= 17; h += 1) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 17) slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
})();

type Props = {
  appointmentId: string;
  status: string;
};

function ActionButton({
  onClick,
  children,
  kind = "primary",
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  kind?: "primary" | "danger" | "ghost";
  disabled?: boolean;
}) {
  const styles = {
    primary:
      "bg-pine-900 text-cream hover:bg-pine-700",
    danger: "bg-error text-cream hover:bg-error/80",
    ghost:
      "border border-pine-900/20 text-pine-900 hover:bg-pine-900 hover:text-cream",
  }[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition-colors disabled:pointer-events-none disabled:opacity-60 ${styles}`}
    >
      {children}
    </button>
  );
}

export function AppointmentActions({ appointmentId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [rsDate, setRsDate] = useState("");
  const [rsTime, setRsTime] = useState("09:00");

  const canConfirm = status === "PENDING" || status === "RESCHEDULED";
  const canComplete = status === "CONFIRMED" || status === "RESCHEDULED";

  const call = async (body: Record<string, unknown>, actionLabel: string) => {
    setBusy(actionLabel);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "The request failed.");
        return;
      }
      setCancelling(false);
      setRescheduling(false);
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const confirm = () => call({ status: "CONFIRMED" }, "confirm");
  const complete = () => call({ status: "COMPLETED" }, "complete");
  const noShow = () => call({ status: "NO_SHOW" }, "no-show");
  const cancel = () =>
    call(
      {
        status: "CANCELLED",
        cancellationReason: cancellationReason.trim() || "Cancelled by staff",
      },
      "cancel",
    );
  const reschedule = () => {
    const [hh, mm] = rsTime.split(":").map(Number);
    const startsAt = localTimeToUTC(
      rsDate,
      hh * 60 + mm,
      site.timeZone,
    ).toISOString();
    call({ startsAt }, "reschedule");
  };

  return (
    <div className="space-y-4">
      {error && <Alert tone="error" title={error} />}

      {!canConfirm && !canComplete && (
        <p className="flex items-center gap-2 rounded-xl bg-pine-900/5 px-4 py-3 text-sm text-ink-faint">
          <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
          This appointment is closed. No further actions are available.
        </p>
      )}

      {canConfirm && (
        <ActionButton onClick={confirm} disabled={busy !== null}>
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {busy === "confirm"
            ? "Confirming…"
            : status === "RESCHEDULED"
              ? "Re-confirm"
              : "Confirm"}
        </ActionButton>
      )}

      {canComplete && (
        <div className="flex flex-wrap gap-3">
          <ActionButton onClick={complete} disabled={busy !== null}>
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {busy === "complete" ? "Completing…" : "Mark complete"}
          </ActionButton>
          <ActionButton kind="ghost" onClick={noShow} disabled={busy !== null}>
            <UserX className="size-4" aria-hidden="true" />
            {busy === "no-show" ? "Saving…" : "No show"}
          </ActionButton>
          <ActionButton kind="ghost" onClick={() => setCancelling(true)} disabled={busy !== null}>
            <XCircle className="size-4" aria-hidden="true" />
            Cancel
          </ActionButton>
          <ActionButton kind="ghost" onClick={() => setRescheduling(true)} disabled={busy !== null}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Reschedule
          </ActionButton>
        </div>
      )}

      {cancelling && canComplete && (
        <div className="rounded-2xl border border-error/25 bg-error/5 p-4">
          <Field
            label="Cancellation reason (shown on record)"
            htmlFor="cancel-reason"
            hint="Required for the audit trail."
          >
            <Input
              id="cancel-reason"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="e.g. Patient called to cancel"
            />
          </Field>
          <div className="mt-3 flex flex-wrap gap-3">
            <ActionButton kind="danger" onClick={cancel} disabled={busy !== null}>
              {busy === "cancel" ? "Cancelling…" : "Cancel appointment"}
            </ActionButton>
            <button
              type="button"
              onClick={() => {
                setCancelling(false);
                setCancellationReason("");
              }}
              className="h-11 px-4 text-sm font-bold text-ink-faint hover:text-ink"
            >
              Keep it
            </button>
          </div>
        </div>
      )}

      {rescheduling && canComplete && (
        <div className="rounded-2xl border border-pine-900/15 bg-pine-50/60 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="New date"
              htmlFor="rs-date"
              hint={`${site.timeZone} calendar`}
            >
              <Input
                id="rs-date"
                type="date"
                value={rsDate}
                onChange={(e) => setRsDate(e.target.value)}
              />
            </Field>
            <Field label="New start time" htmlFor="rs-time">
              <Select
                id="rs-time"
                value={rsTime}
                onChange={(e) => setRsTime(e.target.value)}
              >
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <ActionButton onClick={reschedule} disabled={busy !== null || !rsDate}>
              <Clock className="size-4" aria-hidden="true" />
              {busy === "reschedule" ? "Moving…" : "Move appointment"}
            </ActionButton>
            <button
              type="button"
              onClick={() => setRescheduling(false)}
              className="h-11 px-4 text-sm font-bold text-ink-faint hover:text-ink"
            >
              Cancel move
            </button>
          </div>
        </div>
      )}
    </div>
  );
}