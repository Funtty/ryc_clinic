import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import { env } from "@/lib/env";
import { site } from "@/lib/site";

// Clinic-internal alert emails (the clinic's own inbox — not patient-facing).
// Delivered via Resend to CLINIC_NOTIFY_EMAIL whenever a patient books or a
// payment is made. Best-effort: when the key or inbox is unset, or the API is
// unreachable, the call is a silent no-op so it can never break a booking.

const RESEND_API = "https://api.resend.com/emails";
const LOG_FILE = "logs/clinic-alerts.log";

async function logLine(message: string): Promise<void> {
  const line = `${new Date().toISOString()} ${message}\n`;
  try {
    await mkdir("logs", { recursive: true });
    await appendFile(LOG_FILE, line, "utf8");
  } catch {
    // Logging is best-effort; never break mail flow over a log write.
  }
}

export type ClinicAlertRow = { label: string; value: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildRows(rows: ClinicAlertRow[]): { text: string; html: string } {
  const longest = Math.max(...rows.map((r) => r.label.length), 0);
  const text = rows.map((r) => `${r.label.padEnd(longest)} : ${r.value}`).join("\n");
  const html = `<table role="presentation" cellpadding="0" cellspacing="12" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937">
    ${rows
      .map(
        (r) =>
          `<tr><td style="padding:4px 10px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top;font-weight:600">${escapeHtml(
            r.label,
          )}</td><td style="padding:4px 0;vertical-align:top">${escapeHtml(r.value)}</td></tr>`,
      )
      .join("")}
  </table>`;
  return { text, html };
}

/**
 * Send an alert to the clinic inbox. Returns false (and never throws) when the
 * email can't be delivered so callers can fire it without blocking a flow.
 */
export async function notifyClinic(
  topic: string,
  rows: ClinicAlertRow[],
  ref?: string,
): Promise<boolean> {
  // Resend matches the recipient against the account owner's address exactly
  // (case-sensitive), so normalize before sending.
  const recipient = env.CLINIC_NOTIFY_EMAIL?.trim().toLowerCase();
  const apiKey = env.RESEND_API_KEY?.trim();
  const from =
    env.EMAIL_FROM?.trim() || `"${site.name}" <onboarding@resend.dev>`;
  if (!recipient || !apiKey) {
    await logLine(
      `[clinic-alert] SKIPPED (not configured) topic=${topic} recipient=${recipient ?? "unset"} keySet=${!!apiKey}`,
    );
    return false;
  }

  const { text, html } = buildRows(rows);
  const subject = `${site.name} — ${topic}${ref ? ` (${ref})` : ""}`;
  const footer =
    `${site.name}\n${site.phoneDisplay}\n${site.address.city}, ${site.address.country}`;
  const bodyText = `${topic}\n\n${text}\n\n—\n${footer}`;
  const bodyHtml = `<h2 style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#111827">${escapeHtml(
    topic,
  )}</h2>${html}<p style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280">${escapeHtml(
    footer.replace(/\n/g, "<br/>"),
  )}</p>`;

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: [recipient], subject, text: bodyText, html: bodyHtml }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.warn(`[clinic-alert] Resend ${res.status}: ${detail}`);
      await logLine(`[clinic-alert] FAILED status=${res.status} topic=${topic} ref=${ref ?? "-"} detail=${detail.slice(0, 300)}`);
      return false;
    }
    const body = (await res.json()) as { id?: string };
    console.log(`[clinic-alert] delivered ${topic}${ref ? ` ${ref}` : ""}: ${body?.id ?? "sent"}`);
    await logLine(`[clinic-alert] DELIVERED id=${body?.id ?? "-"} topic=${topic} ref=${ref ?? "-"}`);
    return true;
  } catch (err) {
    console.warn("[clinic-alert] delivery unavailable:", err);
    await logLine(`[clinic-alert] ERROR topic=${topic} ref=${ref ?? "-"} err=${String(err)}`);
    return false;
  }
}