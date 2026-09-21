import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPaymentByRef } from "@/lib/server/payments/engine";
import { bankAccountDetails } from "@/lib/server/payments/bank-account";
import { BankTransferCheckout } from "@/components/booking/bank-transfer-checkout";

export const metadata: Metadata = {
  title: "Pay by transfer · RYC Dental Service",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Bank transfer checkout for the bank_transfer provider. Shows the clinic's
 * bank account and the patient's "I've made payment" claim. The claim is only
 * a flag: the payment stays PENDING until the clinic confirms it against the
 * bank (admin). No money is ever collected on this page.
 */
export default async function BankPayPage({
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
    <BankTransferCheckout
      payment={{
        id: payment.id,
        paymentRef: payment.paymentRef,
        status: payment.status,
        amountCents: payment.amountCents,
        currency: payment.currency,
        provider: payment.provider,
        patientReportedAt: payment.patientReportedAt
          ? payment.patientReportedAt.toISOString()
          : null,
        serviceName: payment.serviceName,
        appointmentReference: payment.appointmentReference,
      }}
      bankAccount={bankAccountDetails()}
    />
  );
}