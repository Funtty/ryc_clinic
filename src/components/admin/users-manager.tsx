"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, UserPlus } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ROLES } from "@/lib/constants";

type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

export function UsersManager({ users }: { users: StaffUser[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm] = useState({ name: "", email: "", role: "STAFF", password: "" });

  const api = async (id: string, body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
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
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Could not create the user.");
        return;
      }
      setForm({ name: "", email: "", role: "STAFF", password: "" });
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

      <Card as="section" aria-labelledby="new-user" className="p-6">
        <h2
          id="new-user"
          className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-ink"
        >
          <UserPlus className="size-4 text-pine-800" aria-hidden="true" />
          Add a staff user
        </h2>
        <form onSubmit={create} noValidate className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="user-name" required>
            <Input id="user-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Email" htmlFor="user-email" required>
            <Input id="user-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Role" htmlFor="user-role" hint="Administrators manage the clinic; receptionists run the front desk." required>
            <Select id="user-role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="Initial password" htmlFor="user-password" hint="Min. 8 characters." required>
            <Input id="user-password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              <Plus className="size-4" aria-hidden="true" />
              {busy ? "Saving…" : "Create user"}
            </Button>
          </div>
        </form>
      </Card>

      <section aria-labelledby="existing-users">
        <h2 id="existing-users" className="mb-4 font-display text-lg font-semibold text-ink">
          Staff accounts
        </h2>
        <Card as="ul" variant="table">
          {users.map((u) => (
            <li key={u.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">
                    {u.name}{" "}
                    <Badge tone="info" className="ml-1 uppercase">
                      {u.role}
                    </Badge>
                  </p>
                  <p className="truncate text-xs text-ink-faint">
                    {u.email} · Last sign-in:{" "}
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-GB") : "never"}
                  </p>
                </div>
                <Badge tone={u.isActive ? "success" : "muted"} className="uppercase">
                  {u.isActive ? "Active" : "Disabled"}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => void api(u.id, { isActive: !u.isActive })} disabled={busy}>
                  {u.isActive ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setResetFor(resetFor === u.id ? null : u.id);
                    setNewPassword("");
                  }}
                  disabled={busy}
                >
                  <KeyRound className="size-4" aria-hidden="true" />
                  Reset password
                </Button>
              </div>

              {resetFor === u.id && (
                <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-pine-50/60 p-4">
                  <Field label={`New password for ${u.name}`} htmlFor={`reset-${u.id}`} hint="Min. 8 characters." className="max-w-xs" required>
                    <Input
                      id={`reset-${u.id}`}
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </Field>
                  <Button
                    type="button"
                    onClick={() => {
                      void api(u.id, { password: newPassword }).then((ok) => {
                        if (ok) setResetFor(null);
                      });
                    }}
                    disabled={busy || newPassword.length < 8}
                  >
                    Set password
                  </Button>
                  <button
                    type="button"
                    onClick={() => setResetFor(null)}
                    className="h-12 px-4 text-sm font-bold text-ink-faint hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </Card>
      </section>
    </div>
  );
}