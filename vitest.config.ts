import { defineConfig } from "vitest/config";
import path from "path";
import { testDatabaseUrl } from "./tests/helpers/test-db";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/helpers/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: [],
    fileParallelism: false,
    testTimeout: 90000,
    hookTimeout: 45000,
    retry: 1,
    globalSetup: ["tests/helpers/global-setup.ts"],
    env: {
      // Isolated `tests` schema in the Supabase project (never `public`).
      DATABASE_URL: testDatabaseUrl(),
      // Deterministic provider for the suite: .env may enable bank_transfer or
      // paystack for dev/prod, but the engine tests drive `simulate` (bank /
      // paystack paths are exercised via synthetic rows and adapters).
      PAYMENT_PROVIDER: "simulate",
      // No live emailing in the suite: clinic alerts return early when these
      // are unset, so the flows stay hermetic and offline.
      RESEND_API_KEY: "",
      CLINIC_NOTIFY_EMAIL: "",
    },
  },
});