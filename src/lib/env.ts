import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // DIRECT_URL is used by Prisma's DDL commands (db push / migrate) so schema
  // changes never cross a transaction-mode pooler. Set it to the Supabase
  // direct connection string.
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required for Prisma schema commands").optional(),
  // Signed/random secrets for sessions are derived from AUTH_SECRET in prod;
  // a development default keeps local runs frictionless.
  AUTH_SECRET: z.string().min(16).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  // Supabase Storage (images). The service-role key never leaves the server.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).optional(),
  // Payments (Phase 8): provider + Paystack secret for the production adapter.
  // Defaults to the offline "simulate" provider when unset.
  //   simulate      — dev/test sandbox that just echoes statuses
  //   paystack      — live Paystack hosted checkout (NGN)
  //   bank_transfer — clinic bank account; patient claims a transfer, admin
  //                   checks the bank and confirms the payment manually.
  PAYMENT_PROVIDER: z.enum(["simulate", "paystack", "bank_transfer"]).optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  // Bank transfer provider: account shown to patients on the payment step.
  // Optional (empty allowed) so the site boots even before the details are set.
  BANK_ACCOUNT_NAME: z.string().optional(),
  BANK_ACCOUNT_NUMBER: z.string().optional(),
  BANK_NAME: z.string().optional(),
  // Clinic alert emails (Resend): sent only to the clinic's own inbox when a
  // patient books or a payment is made. All optional — unset means no emails.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CLINIC_NOTIFY_EMAIL: z.union([z.string().email(), z.literal("")]).optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment configuration:",
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  );
  throw new Error("Invalid environment configuration. See server logs.");
}

export const env = parsed.data;