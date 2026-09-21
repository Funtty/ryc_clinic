"use client";

import { useState } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Admin refund action; the result is decided server-side only. */
export function PaymentRefundButton({ paymentId }: { paymentId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refund() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as {
        payment?: { status?: string };
        error?: { message?: string };
      };
      if (!res.ok || !data.payment) {
        setError(data.error?.message ?? "Refund failed.");
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
        onClick={() => void refund()}
        disabled={busy}
        ariaLabel={`Refund payment ${paymentId}`}
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw className="size-4" aria-hidden="true" />
        )}
        Refund
      </Button>
      {error && <span className="text-xs font-semibold text-error">{error}</span>}
    </span>
  );
}