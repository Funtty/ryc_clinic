"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";
import { site } from "@/lib/site";

type PatientLike = { id: string; firstName: string; lastName: string; email: string };
type ServiceLike = { id: string; name: string; durationMinutes: number; price: number | null };
type DentistLike = { id: string; name: string; isActive: boolean };

const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let h = 8; h <= 17; h += 1) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 17) slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
})();

export function AppointmentForm({
  patients,
  services,
  dentists,
}: {
  patients: PatientLike[];
  services: ServiceLike[];
  dentists: DentistLike[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");

  const service = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const form = e.currentTarget;
    const body = {
      patientId: (form.elements.namedItem("patientId") as HTMLSelectElement).value,
      serviceId: (form.elements.namedItem("serviceId") as HTMLSelectElement).value,
      dentistId:
        (form.elements.namedItem("dentistId") as HTMLSelectElement).value || undefined,
      date: (form.elements.namedItem("date") as HTMLInputElement).value,
      time: (form.elements.namedItem("time") as HTMLSelectElement).value,
      notes: (form.elements.namedItem("notes") as HTMLTextAreaElement).value,
    };
    try {
      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        appointment?: { id: string };
        error?: { message?: string };
      };
      if (!res.ok) {
        setFormError(data.error?.message ?? "Could not book the appointment.");
        return;
      }
      router.push(`/admin/appointments/${data.appointment!.id}`);
      router.refresh();
    } catch {
      setFormError("Unable to reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <Alert tone="error" title={formError} />}

      <Field label="Patient" htmlFor="appt-patient" required>
        <Select id="appt-patient" name="patientId" required defaultValue="">
          <option value="" disabled>
            Select patient…
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName} ({p.email})
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Service" htmlFor="appt-service" required>
          <Select
            id="appt-service"
            name="serviceId"
            required
            defaultValue=""
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="" disabled>
              Select service…
            </option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Dentist" htmlFor="appt-dentist" hint="Leave as Flexible to auto-assign.">
          <Select id="appt-dentist" name="dentistId" defaultValue="">
            <option value="">Flexible (no dentist)</option>
            {dentists.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.isActive ? "" : " (inactive)"}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="rounded-2xl border border-pine-900/8 bg-pine-50/60 px-4 py-3 text-sm text-ink-sub">
        {service
          ? `${service.name} usually takes ~${service.durationMinutes} minutes`
          : "Pick a service to see its duration."}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Date" htmlFor="appt-date" hint={`${site.timeZone} calendar`} required>
          <Input
            id="appt-date"
            name="date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <Field label="Start time" htmlFor="appt-time" required>
          <Select
            id="appt-time"
            name="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
          >
            {TIME_SLOTS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="appt-notes" hint="Internal notes for the clinic.">
        <Textarea id="appt-notes" name="notes" rows={4} />
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-pine-900 px-7 text-base font-bold text-cream transition-all duration-200 hover:bg-pine-700 disabled:opacity-60 sm:w-auto"
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
        {submitting ? "Booking…" : "Book appointment"}
      </button>
    </form>
  );
}