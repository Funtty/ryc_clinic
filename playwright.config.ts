import { defineConfig } from "@playwright/test";
import "dotenv/config";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  fullyParallel: true,
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3101",
    channel: "msedge",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "edge", use: {} },
  ],
});