"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save } from "lucide-react";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ImageUploader } from "@/components/admin/image-uploader";
import { formatMoney } from "@/lib/utils";

type Service = {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  durationMinutes: number;
  price: number | null;
  priceLabel: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  dentists: { id: string; name: string }[];
};

function emptyForm() {
  return {
    name: "",
    shortDescription: "",
    description: "",
    durationMinutes: "45",
    price: "",
    priceLabel: "",
    imageUrl: null as string | null,
    isActive: true,
  };
}

export function ServicesManager({ services }: { services: Service[] }) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/services/${id}`, {
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

  const toggle = async (s: Service) => {
    await patch(s.id, { isActive: !s.isActive });
  };

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          shortDescription: form.shortDescription,
          description: form.description,
          durationMinutes: Number(form.durationMinutes),
          price: form.price === "" ? null : Number(form.price),
          priceLabel: form.priceLabel || undefined,
          imageUrl: form.imageUrl ?? undefined,
          isActive: form.isActive,
        }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Could not create the service.");
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

  const set =
    (field: keyof ReturnType<typeof emptyForm>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({
        ...f,
        [field]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value,
      }));

  return (
    <div className="space-y-8">
      {error && <Alert tone="error" title={error} />}

      <Card as="section" aria-labelledby="new-service" className="p-6">
        <h2
          id="new-service"
          className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-ink"
        >
          <Plus className="size-4 text-pine-800" aria-hidden="true" />
          Add a service
        </h2>
        <form onSubmit={create} noValidate className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" htmlFor="svc-name" required className="sm:col-span-2">
            <Input id="svc-name" value={form.name} onChange={set("name")} placeholder="e.g. Professional cleaning (scale & polish)" />
          </Field>
          <Field label="Short description" htmlFor="svc-short" hint="Appears on service cards." required className="sm:col-span-2">
            <Input id="svc-short" value={form.shortDescription} onChange={set("shortDescription")} />
          </Field>
          <Field label="Full description" htmlFor="svc-desc" required className="sm:col-span-2">
            <Textarea id="svc-desc" rows={4} value={form.description} onChange={set("description")} />
          </Field>
          <Field label="Duration (minutes)" htmlFor="svc-duration" required>
            <Input id="svc-duration" type="number" min={15} max={480} value={form.durationMinutes} onChange={set("durationMinutes")} />
          </Field>
          <Field label="Price (₦, optional)" htmlFor="svc-price" hint="Leave blank for “price on consultation”.">
            <Input id="svc-price" type="number" min={0} value={form.price} onChange={set("price")} placeholder="25000" />
          </Field>
          <Field label="Price label (optional)" htmlFor="svc-label" hint="Overrides the numeric price, e.g. “from ₦80,000”.">
            <Input id="svc-label" value={form.priceLabel} onChange={set("priceLabel")} />
          </Field>
          <ImageUploader
            id="svc-img"
            label="Image"
            hint="Shown on the services grid and booking page."
            value={form.imageUrl}
            onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
          />
          <div className="flex items-end pb-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={set("isActive")}
                className="size-4 accent-pine-900"
              />
              Visible &amp; bookable on the public site
            </label>
          </div>
          <Button type="submit" disabled={busy}>
              <Plus className="size-4" aria-hidden="true" />
              {busy ? "Saving…" : "Create service"}
            </Button>
        </form>
      </Card>

      <section aria-labelledby="existing-services">
        <h2
          id="existing-services"
          className="mb-4 font-display text-lg font-semibold text-ink"
        >
          Existing services
        </h2>
        {services.length === 0 && (
          <EmptyState compact title="No services yet" />
        )}
        <ul className="space-y-3">
          {services.map((s) => (
            <Card
              as="li"
              key={s.id}
              className={"p-5 " + (s.isActive ? "" : "opacity-70")}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{s.name}</p>
                  <p className="text-xs text-ink-faint">
                    {s.durationMinutes} min ·{" "}
                    {s.price != null ? formatMoney(s.price) : s.priceLabel || "Price on consultation"} ·{" "}
                    {s.dentists.length}{" "}
                    {s.dentists.length === 1 ? "dentist" : "dentists"}
                  </p>
                </div>
                <Badge tone={s.isActive ? "success" : "muted"} className="uppercase">
                  {s.isActive ? "Active" : "Hidden"}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => toggle(s)} disabled={busy}>
                  {s.isActive ? "Hide" : "Show"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(editing === s.id ? null : s.id)}
                  disabled={busy}
                >
                  Edit
                </Button>
              </div>

              {editing === s.id && (
                <EditServiceForm service={s} busy={busy} onSave={patch} onDone={() => setEditing(null)} />
              )}
            </Card>
          ))}
        </ul>
      </section>
    </div>
  );
}

function EditServiceForm({
  service,
  busy,
  onSave,
  onDone,
}: {
  service: Service;
  busy: boolean;
  onSave: (id: string, body: Record<string, unknown>) => Promise<boolean>;
  onDone: () => void;
}) {
  const [v, setV] = useState({
    name: service.name,
    shortDescription: service.shortDescription,
    description: service.description,
    durationMinutes: String(service.durationMinutes),
    price: service.price == null ? "" : String(service.price),
    priceLabel: service.priceLabel ?? "",
    imageUrl: service.imageUrl,
  });
  const set =
    (field: keyof typeof v) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV((x) => ({ ...x, [field]: e.target.value }));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ok = await onSave(service.id, {
      name: v.name,
      shortDescription: v.shortDescription,
      description: v.description,
      durationMinutes: Number(v.durationMinutes),
      price: v.price === "" ? null : Number(v.price),
      priceLabel: v.priceLabel || undefined,
      imageUrl: v.imageUrl,
    });
    if (ok) onDone();
  };

  return (
    <form onSubmit={submit} className="mt-4 grid gap-4 border-t border-pine-900/8 pt-4 sm:grid-cols-2">
      <Field label="Name" htmlFor={`svc-edit-name-${service.id}`} required>
        <Input id={`svc-edit-name-${service.id}`} value={v.name} onChange={set("name")} />
      </Field>
      <Field label="Duration (minutes)" htmlFor={`svc-edit-dur-${service.id}`} required>
        <Input id={`svc-edit-dur-${service.id}`} type="number" min={15} max={480} value={v.durationMinutes} onChange={set("durationMinutes")} />
      </Field>
      <Field label="Price (₦, optional)" htmlFor={`svc-edit-price-${service.id}`}>
        <Input id={`svc-edit-price-${service.id}`} type="number" min={0} value={v.price} onChange={set("price")} />
      </Field>
      <Field label="Price label" htmlFor={`svc-edit-pricelabel-${service.id}`}>
        <Input id={`svc-edit-pricelabel-${service.id}`} value={v.priceLabel} onChange={set("priceLabel")} />
      </Field>
      <Field label="Short description" htmlFor={`svc-edit-short-${service.id}`} required className="sm:col-span-2">
        <Input id={`svc-edit-short-${service.id}`} value={v.shortDescription} onChange={set("shortDescription")} />
      </Field>
      <Field label="Full description" htmlFor={`svc-edit-desc-${service.id}`} required className="sm:col-span-2">
        <Textarea id={`svc-edit-desc-${service.id}`} rows={4} value={v.description} onChange={set("description")} />
      </Field>
      <ImageUploader
        id={`svc-edit-img-${service.id}`}
        label="Image"
        value={v.imageUrl}
        onChange={(url) => setV((x) => ({ ...x, imageUrl: url }))}
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