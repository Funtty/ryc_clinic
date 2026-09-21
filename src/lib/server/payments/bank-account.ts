import "server-only";
import { env } from "@/lib/env";

// Public bank-account details shown to patients for the bank_transfer provider.
// Held in env so each deployment (and the Render dashboard) can set/replace it
// without a redeploy. Empty values are a graceful "coming soon" instead of a
// broken checkout.

export type BankAccount = {
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
};

function clean(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : null;
}

export function bankAccountDetails(): BankAccount {
  return {
    accountName: clean(env.BANK_ACCOUNT_NAME),
    accountNumber: clean(env.BANK_ACCOUNT_NUMBER),
    bankName: clean(env.BANK_NAME),
  };
}

/** True when all three fields are set and the transfer step can be shown. */
export function bankAccountReady(): boolean {
  const a = bankAccountDetails();
  return Boolean(a.accountNumber && a.bankName);
}