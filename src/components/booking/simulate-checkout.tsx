"use client";

import { useState } from "react";
import {
  Ban,
  CheckCircle2,
  Clock,
  CreditCard,
  LoaderCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { site } from "@/lib/site";

export type CheckoutPayment = {
  id: string;
  paymentRef: string;
  status: string;
  amountCents: number;
  currency: string;
  provider: string;
  serviceName?: string;
  appointmentReference?: string;
};

const STATUS_META: Record<string, { tone: "success" | "warning" | "error" | "muted"; label: string }> = {
  PENDING: { tone: "warning", label: "Awaiting payment" },
  PAID: { tone: "success", label: "Deposit received" },
  FAILED: { tone: "error", label: "Payment failed" },
  EXPIRED: { tone: "muted", label: "Payment link expired" },
  CANCELLED: { tone: "muted", label: "Payment cancelled" },
  REFUNDED: { tone: "muted", label: "Deposit refunded" },
};

export function SimulateCheckout({ payment }: { payment: CheckoutPayment }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(payment.status);

  const meta = STATUS_META[status] ?? { tone: "muted" as const, label: status };

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/verify/${payment.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        payment?: { status: string };
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? "We couldn't verify your payment. Please try again.");
        return;
      }
      setStatus(data.payment?.status ?? status);
    } catch {
      setError("We couldn't reach the payment service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" variant="panel-lg" className="mx-auto max-w-xl p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <span
          className={`grid size-14 place-items-center rounded-full ${
            meta.tone === "success"
              ? "bg-success/15 text-success"
              : meta.tone === "error"
                ? "bg-error/15 text-error"
                : "bg-pine-900/10 text-pine-800"
          }`}
        >
          {status === "PAID" ? (
            <CheckCircle2 className="size-7" aria-hidden="true" />
          ) : status === "FAILED" ? (
            <XCircle className="size-7" aria-hidden="true" />
          ) : status === "EXPIRED" || status === "CANCELLED" ? (
            <Ban className="size-7" aria-hidden="true" />
          ) : (
            <CreditCard className="size-7" aria-hidden="true" />
          )}
        </span>
        <h1 className="mt-5 font-display text-2xl font-semibold text-ink">
          {site.name} deposit
        </h1>
        <p className="mt-1 text-sm text-ink-sub">
          Reference{" "}
          <span className="font-mono font-bold text-pine-900">{payment.paymentRef}</span>
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-pine-900/5 px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-sub">
          {meta.label}
        </span>
      </div>

      <dl className="mt-7 grid gap-3 sm:grid-cols-2">
        <InfoRow label="Amount" value={formatMoney(payment.amountCents / 100, payment.currency)} />
        <InfoRow label="Service" value={payment.serviceName ?? "—"} />
        <InfoRow label="Appointment" value={payment.appointmentReference ?? "—"} />
        <InfoRow label="Method" value={payment.provider === "simulate" ? "Simulated (dev)" : payment.provider} />
      </dl>

      {status === "PENDING" && (
        <div className="mt-7">
          <Alert tone="warning" title="Demo checkout" className="mb-5">
            This is the sandbox payment page. Clicking pay simulates a real
            provider authorisation — the result is still decided server-side.
          </Alert>
          <Button onClick={() => void pay()} disabled={busy} size="lg" className="w-full">
            {busy ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Verifying with provider…
              </>
            ) : (
              <>
                <CreditCard className="size-4" aria-hidden="true" />
                Pay deposit
              </>
            )}
          </Button>
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-ink-faint">
            <Clock className="size-4" aria-hidden="true" />
            You can also pay at the clinic before your visit.
          </div>
        </div>
      )}

      {(status === "FAILED" || status === "EXPIRED" || status === "CANCELLED") && (
        <div className="mt-7 space-y-3">
          <Alert
            tone={status === "FAILED" ? "error" : "info"}
            title="No payment was collected"
          >
            Your appointment slot is still held. You can retry the deposit or
            pay at the clinic — nothing has been charged.
          </Alert>
          <Button onClick={() => void pay()} disabled={busy} variant="outline" className="w-full">
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            Retry payment
          </Button>
        </div>
      )}

      {error && (
        <Alert tone="error" title="Something went wrong" className="mt-5">
          {error}
        </Alert>
      )}
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-pine-900/8 bg-cream p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-sub">{label}</p>
      <p className="mt-1 font-display text-base font-semibold text-ink">{value}</p>
    </div>
  );
}