import { describe, expect, it } from "vitest";
import { notifyClinic } from "@/lib/server/email/clinic-alerts";

describe("clinic alerts (email)", () => {
  it("is a silent no-op (never throws) when emailing is not configured", async () => {
    // vitest pins RESEND_API_KEY="" and CLINIC_NOTIFY_EMAIL="" so nothing can
    // leave the process — the helper must resolve `false` without a network call.
    await expect(
      notifyClinic("New appointment booking", [
        { label: "Patient", value: "Ada Lovelace" },
        { label: "Service", value: "Cleaning" },
      ]),
    ).resolves.toBe(false);
  });
});