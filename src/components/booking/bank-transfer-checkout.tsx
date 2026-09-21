"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Landmark,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyField } from "@/components/ui/copy-field";
import { site } from "@/lib/site";

type BankAccount = {
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
};

export type CheckoutPayment = {
  id: string;
  paymentRef: string;
  status: string;
  amountCents: number;
  currency: string;
  provider: string;
  patientReportedAt: string | null;
  serviceName?: string;
  appointmentReference?: string;
};

/**
 * Bank-transfer checkout. The patient transfers to the clinic's account, then
 * taps "I've made payment". That tap only flags the claim — the payment stays
 * PENDING until the clinic verifies the bank and confirms (admin action). At
 * that point an automatic "payment received" email goes out.
 */
export function BankTransferCheckout({
  payment,
  bankAccount,
}: {
  payment: CheckoutPayment;
  bankAccount: BankAccount;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState<boolean>(Boolean(payment.patientReportedAt));

  const awaitingVerification = payment.status === "PENDING" && reported;
  const accountReady = Boolean(bankAccount.accountNumber && bankAccount.bankName);

  async function reportTransfer() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${payment.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as {
        payment?: { reported?: boolean };
        error?: { message?: string };
      };
      if (!res.ok || !data.payment?.reported) {
        setError(data.error?.message ?? "We couldn't record your payment. Please try again.");
        return;
      }
      setReported(true);
    } catch {
      setError("We couldn't reach the clinic. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" variant="panel-lg" className="mx-auto max-w-xl p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <span
          className={`grid size-14 place-items-center rounded-full ${
            payment.status === "PAID"
              ? "bg-success/15 text-success"
              : "bg-pine-900/10 text-pine-800"
          }`}
        >
          {payment.status === "PAID" ? (
            <CheckCircle2 className="size-7" aria-hidden="true" />
          ) : (
            <Landmark className="size-7" aria-hidden="true" />
          )}
        </span>
        <h1 className="mt-5 font-display text-2xl font-semibold text-ink">
          {site.name} deposit
        </h1>
        <p className="mt-1 text-sm text-ink-sub">
          Reference{" "}
          <span className="font-mono font-bold text-pine-900">{payment.paymentRef}</span>
        </p>
        {awaitingVerification && (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gold-700">
            <Clock className="size-3.5" aria-hidden="true" />
            Awaiting verification
          </span>
        )}
        {payment.status === "PAID" && (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-success">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Payment received
          </span>
        )}
      </div>

      <dl className="mt-7 grid gap-3 sm:grid-cols-2">
        <InfoRow label="Amount" value={formatMoney(payment.amountCents / 100, payment.currency)} />
        <InfoRow label="Service" value={payment.serviceName ?? "—"} />
        <InfoRow label="Appointment" value={payment.appointmentReference ?? "—"} />
        <InfoRow label="Method" value="Bank transfer" />
      </dl>

      {payment.status === "PENDING" && (
        <div className="mt-7">
          {accountReady ? (
            <>
              <div className="rounded-2xl border border-pine-900/10 bg-cream p-5">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-sub">
                  <Landmark className="size-4" aria-hidden="true" />
                  Transfer to this account
                </p>
                <dl className="mt-3 grid gap-2 text-sm">
                  {bankAccount.accountName && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink-sub">Account name</dt>
                      <dd className="font-bold text-ink">{bankAccount.accountName}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-ink-sub">Account number</dt>
                    <CopyField
                      value={bankAccount.accountNumber ?? ""}
                      className="font-display text-lg font-semibold tabular-nums text-ink"
                    />
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-sub">Bank</dt>
                    <dd className="font-bold text-ink">{bankAccount.bankName}</dd>
                  </div>
                </dl>
              </div>
              {!reported ? (
                <div className="mt-5">
                  <Alert tone="info" title="After you transfer" className="mb-5">
                    Tap the button below so our team knows to check the bank. We&rsquo;ll
                    email you once your payment is confirmed — you don&rsquo;t need to do
                    anything else.
                  </Alert>
                  <Button
                    onClick={() => void reportTransfer()}
                    disabled={busy}
                    size="lg"
                    className="w-full"
                  >
                    {busy ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                        Recording…
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="size-4" aria-hidden="true" />
                        I&rsquo;ve made payment
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="mt-5">
                  <Alert tone="warning" title="Thank you — we&rsquo;re checking">
                    We&rsquo;ve recorded your transfer and will verify it against the bank
                    shortly. Your slot stays held, and we&rsquo;ll email you the moment your
                    payment is confirmed.
                  </Alert>
                </div>
              )}
            </>
          ) : (
            <Alert tone="info" title="Pay at the clinic">
              Transfer instructions aren&rsquo;t set up yet. You can pay at the clinic
              before your visit, or call us on{" "}
              <a
                href={`tel:${site.phone.replace(/\s/g, "")}`}
                className="font-semibold text-ink underline"
              >
                {site.phoneDisplay}
              </a>
              .
            </Alert>
          )}

          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-faint">
            <Clock className="size-4" aria-hidden="true" />
            You can also pay at the clinic before your visit.
          </div>
        </div>
      )}

      {payment.status === "PAID" && (
        <Alert tone="success" title="Deposit received — thank you!" className="mt-6">
          We&rsquo;ve confirmed your payment. A confirmation email is on its way to you.
        </Alert>
      )}

      {(payment.status === "FAILED" ||
        payment.status === "EXPIRED" ||
        payment.status === "CANCELLED" ||
        payment.status === "REFUNDED") && (
        <div className="mt-7 space-y-3">
          <Alert
            tone={payment.status === "FAILED" ? "error" : "info"}
            title="No payment was collected"
          >
            {payment.status === "REFUNDED"
              ? "This deposit has been refunded by the clinic."
              : "Your appointment slot is still held. You can retry the deposit or pay at the clinic."}
          </Alert>
          {payment.status !== "REFUNDED" && (
            <Button onClick={() => void reportTransfer()} disabled={busy} variant="outline" className="w-full">
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              Retry payment
            </Button>
          )}
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