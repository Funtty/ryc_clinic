import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPaymentByRef } from "@/lib/server/payments/engine";
import { SimulateCheckout } from "@/components/booking/simulate-checkout";

export const metadata: Metadata = {
  title: "Deposit checkout",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Dev-only hosted "checkout" for the simulate provider. In production the
 * patient is redirected to the real provider's hosted page; here the same
 * server-side verification path is exercised so the whole lifecycle is
 * demonstrable offline. The browser NEVER declares success — it only asks the
 * server to verify with the provider.
 */
export default async function SimulatePayPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  let payment;
  try {
    payment = await getPaymentByRef(ref);
  } catch {
    notFound();
  }
  return (
    <SimulateCheckout
      payment={{
        id: payment.id,
        paymentRef: payment.paymentRef,
        status: payment.status,
        amountCents: payment.amountCents,
        currency: payment.currency,
        provider: payment.provider,
        serviceName: payment.serviceName,
        appointmentReference: payment.appointmentReference,
      }}
    />
  );
}