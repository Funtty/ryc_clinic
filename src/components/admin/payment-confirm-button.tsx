"use client";

import { useState } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Admin "I checked the bank — payment received" action for bank transfers. */
export function PaymentConfirmButton({ paymentId }: { paymentId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as {
        payment?: { status?: string };
        error?: { message?: string };
      };
      if (!res.ok || !data.payment) {
        setError(data.error?.message ?? "Couldn't confirm the payment.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void confirm()}
        disabled={busy}
        ariaLabel={`Confirm payment received for ${paymentId}`}
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <ShieldCheck className="size-4" aria-hidden="true" />
        )}
        Confirm payment received
      </Button>
      {error && <span className="text-xs font-semibold text-error">{error}</span>}
    </span>
  );
}