import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUserSafe } from "@/lib/server/session-cookie";
import { env } from "@/lib/env";
import { LoginForm } from "@/components/auth/login-form";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const user = await getSessionUserSafe();
  if (user) redirect("/admin");

  const devMode = env.NODE_ENV !== "production";

  return (
    <div className="bg-pine-950 py-16 sm:py-24">
      <Container className="max-w-md">
        <div className="rounded-3xl bg-cream p-8 shadow-card sm:p-10">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <Logo />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">
                Staff sign in
              </h1>
              <p className="mt-1 text-sm text-ink-faint">
                Restricted access — clinic staff only.
              </p>
            </div>
          </div>

          <LoginForm />

          <p className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm font-semibold text-pine-800 underline-offset-4 hover:underline"
            >
              Back to the public site
            </Link>
          </p>
        </div>

        {devMode && (
          <div className="mt-6 rounded-2xl border border-gold-400/30 bg-pine-900/60 p-4 text-xs leading-relaxed text-cream/80">
            <p className="font-bold text-gold-400">Development sign-in</p>
            <p className="mt-1">
              These local demo accounts exist only when the site is not running
              in production:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>
                Admin — {"admin@ryc-dental.example"} / the ADMIN_PASSWORD from
                your .env
              </li>
              <li>
                Receptionist — {"staff@ryc-dental.example"} / the STAFF_PASSWORD
                from your .env
              </li>
            </ul>
          </div>
        )}
      </Container>
    </div>
  );
}