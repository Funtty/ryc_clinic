"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Unable to sign in. Please try again.");
        return;
      }
      window.location.assign("/admin");
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && <Alert tone="error" title={error} />}

      <Field label="Username or email" htmlFor="login-email" required>
        <Input
          id="login-email"
          name="email"
          type="text"
          autoComplete="username"
          autoFocus
          placeholder="username or you@clinic"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field label="Password" htmlFor="login-password" required>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-pine-900 px-7 text-base font-bold text-cream transition-all duration-200 hover:-translate-y-0.5 hover:bg-pine-700 hover:shadow-card disabled:pointer-events-none disabled:opacity-60"
      >
        <LogIn className="size-4" aria-hidden="true" />
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}