"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Stethoscope } from "lucide-react";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ImageUploader } from "@/components/admin/image-uploader";
import { DAY_LABELS } from "@/lib/constants";
import { minutesToClock } from "@/lib/datetime";

type ScheduleRow = {
  id: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  isClosed: boolean;
};

type Dentist = {
  id: string;
  name: string;
  title: string;
  bio: string;
  specialties: string;
  photoUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  schedules: ScheduleRow[];
};

function emptyForm() {
  return {
    name: "",
    title: "",
    bio: "",
    specialties: "",
    photoUrl: null as string | null,
    isActive: true,
  };
}

export function DentistsManager({ dentists }: { dentists: Dentist[] }) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const set =
    (field: keyof ReturnType<typeof emptyForm>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({
        ...f,
        [field]:
          e.target.type === "checkbox"
            ? (e.target as HTMLInputElement).checked
            : e.target.value,
      }));

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/dentists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Update failed.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Unable to reach the server.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dentists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, photoUrl: form.photoUrl ?? undefined }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Could not add the technologist.");
        return;
      }
      setForm(emptyForm());
      router.refresh();
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {error && <Alert tone="error" title={error} />}

      <Card as="section" aria-labelledby="new-dentist" className="p-6">
        <h2
          id="new-dentist"
          className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-ink"
        >
          <Plus className="size-4 text-pine-800" aria-hidden="true" />
          Add a technologist
        </h2>
        <form onSubmit={create} noValidate className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="dent-name" required>
            <Input id="dent-name" value={form.name} onChange={set("name")} placeholder="Dr. Adaeze Nwosu" />
          </Field>
          <Field label="Title" htmlFor="dent-title" hint="Show on the team page, e.g. “Lead Technologist”." required>
            <Input id="dent-title" value={form.title} onChange={set("title")} />
          </Field>
          <Field label="Bio" htmlFor="dent-bio" required className="sm:col-span-2">
            <Textarea id="dent-bio" rows={4} value={form.bio} onChange={set("bio")} />
          </Field>
          <Field label="Specialties (comma separated)" htmlFor="dent-specials">
            <Input id="dent-specials" value={form.specialties} onChange={set("specialties")} placeholder="Tooth-coloured fillings, Root canal treatment, Extractions" />
          </Field>
          <ImageUploader
            id="dent-img"
            label="Photo"
            hint="Portrait shown on the team page."
            value={form.photoUrl}
            onChange={(url) => setForm((f) => ({ ...f, photoUrl: url }))}
          />
          <div className="flex items-end pb-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={set("isActive")}
                className="size-4 accent-pine-900"
              />
              Offers appointments
            </label>
          </div>
          <Button type="submit" disabled={busy}>
            <Stethoscope className="size-4" aria-hidden="true" />
            {busy ? "Saving…" : "Add technologist"}
          </Button>
        </form>
      </Card>

      <section aria-labelledby="existing-dentists">
        <h2 id="existing-dentists" className="mb-4 font-display text-lg font-semibold text-ink">
          Existing technologists
        </h2>
        {dentists.length === 0 && (
          <EmptyState compact title="No technologists yet" message="Configure working hours on the Schedule page." />
        )}
        <ul className="space-y-3">
          {dentists.map((d) => (
            <Card
              as="li"
              key={d.id}
              className={"p-5 " + (d.isActive ? "" : "opacity-70")}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{d.name}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {d.title} · {weekSummary(d.schedules)}
                  </p>
                </div>
                <Badge tone={d.isActive ? "success" : "muted"} className="uppercase">
                  {d.isActive ? "Active" : "Hidden"}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => patch(d.id, { isActive: !d.isActive })} disabled={busy}>
                  {d.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(editing === d.id ? null : d.id)}
                  disabled={busy}
                >
                  Edit
                </Button>
              </div>

              {editing === d.id && (
                <EditDentistForm dentist={d} busy={busy} onSave={patch} onDone={() => setEditing(null)} />
              )}
            </Card>
          ))}
        </ul>
      </section>
    </div>
  );
}

function weekSummary(schedules: ScheduleRow[]): string {
  const working = schedules.filter((s) => !s.isClosed);
  if (working.length === 0) return "No working hours set";
  const days = working
    .map((s) => `${DAY_LABELS[s.dayOfWeek]} ${minutesToClock(s.startMinutes)}–${minutesToClock(s.endMinutes)}`)
    .join(", ");
  return days;
}

function EditDentistForm({
  dentist,
  busy,
  onSave,
  onDone,
}: {
  dentist: Dentist;
  busy: boolean;
  onSave: (id: string, body: Record<string, unknown>) => Promise<boolean>;
  onDone: () => void;
}) {
  const [v, setV] = useState({
    name: dentist.name,
    title: dentist.title,
    bio: dentist.bio,
    specialties: dentist.specialties,
    photoUrl: dentist.photoUrl,
  });
  const set =
    (field: keyof typeof v) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV((x) => ({ ...x, [field]: e.target.value }));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ok = await onSave(dentist.id, {
      ...v,
      photoUrl: v.photoUrl,
    });
    if (ok) onDone();
  };

  return (
    <form onSubmit={submit} className="mt-4 grid gap-4 border-t border-pine-900/8 pt-4 sm:grid-cols-2">
      <Field label="Full name" htmlFor={`dent-edit-name-${dentist.id}`} required>
        <Input id={`dent-edit-name-${dentist.id}`} value={v.name} onChange={set("name")} />
      </Field>
      <Field label="Title" htmlFor={`dent-edit-title-${dentist.id}`} required>
        <Input id={`dent-edit-title-${dentist.id}`} value={v.title} onChange={set("title")} />
      </Field>
      <Field label="Specialties" htmlFor={`dent-edit-specials-${dentist.id}`} className="sm:col-span-2">
        <Input id={`dent-edit-specials-${dentist.id}`} value={v.specialties} onChange={set("specialties")} />
      </Field>
      <Field label="Bio" htmlFor={`dent-edit-bio-${dentist.id}`} required className="sm:col-span-2">
        <Textarea id={`dent-edit-bio-${dentist.id}`} rows={4} value={v.bio} onChange={set("bio")} />
      </Field>
      <ImageUploader
        id={`dent-edit-img-${dentist.id}`}
        label="Photo"
        value={v.photoUrl}
        onChange={(url) => setV((x) => ({ ...x, photoUrl: url }))}
      />
      <div className="flex gap-3">
        <Button type="submit" size="sm" disabled={busy}>
          <Save className="size-4" aria-hidden="true" />
          {busy ? "Saving…" : "Save changes"}
        </Button>
        <button type="button" onClick={onDone} className="px-2 text-sm font-bold text-ink-faint hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}