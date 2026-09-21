import { defineConfig } from "vitest/config";
import path from "path";

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
    testTimeout: 20000,
    globalSetup: ["tests/helpers/global-setup.ts"],
    env: {
      DATABASE_URL: "file:./test.db",
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