import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserSafe } from "@/lib/server/session-cookie";
import { requireStaff } from "@/lib/server/guards";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoutButton } from "@/components/admin/logout-button";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUserSafe();
  if (!user) redirect("/ryc_login");
  requireStaff(user);
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="bg-cream-strong/50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-pine-900/10 bg-cream p-6 lg:flex">
        <Link href="/admin" aria-label="RYC Dental admin home">
          <Logo />
        </Link>
        <div className="mt-8 flex-1">
          <AdminNav isAdmin={isAdmin} />
        </div>
        <div className="rounded-xl bg-pine-900/5 px-4 py-3 text-xs text-ink-faint">
          Signed in view of{" "}
          <Link
            href="/"
            className="font-bold text-pine-800 underline-offset-4 hover:underline"
          >
            ryc-dental.example
          </Link>
          . Changes here are visible to patients on the public site.
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-pine-900/10 bg-cream/90 backdrop-blur">
          <Container className="flex h-16 max-w-6xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{user.name}</p>
              <p className="text-xs text-ink-faint">
                {isAdmin ? "Administrator" : "Receptionist"} ·{" "}
                <span className="lowercase">{user.email}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="hidden text-sm font-semibold text-pine-800 underline-offset-4 hover:underline sm:inline"
              >
                View public site
              </Link>
              <LogoutButton />
            </div>
          </Container>
        </header>

        <Container className="max-w-6xl py-8">
          <div className="mb-6 lg:hidden">
            <AdminNav isAdmin={isAdmin} />
          </div>
          {children}
        </Container>
      </div>
    </div>
  );
}