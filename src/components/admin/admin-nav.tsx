"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  Clock,
  CreditCard,
  LayoutDashboard,
  ScrollText,
  Scissors,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type LinkItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

const ALL_LINKS: LinkItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarRange },
  { href: "/admin/patients", label: "Patients", icon: Users },
  { href: "/admin/services", label: "Services", icon: Scissors, adminOnly: true },
  { href: "/admin/dentists", label: "Technologists", icon: Stethoscope, adminOnly: true },
  { href: "/admin/schedule", label: "Schedule", icon: Clock, adminOnly: true },
  { href: "/admin/users", label: "Staff users", icon: ShieldCheck, adminOnly: true },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, adminOnly: true },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText, adminOnly: true },
];

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = ALL_LINKS.filter((l) => !l.adminOnly || isAdmin);

  return (
    <nav aria-label="Admin sections">
      <ul className="grid gap-1">
        {links.map((link) => {
          const active =
            link.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-pine-900 text-cream"
                    : "text-ink-faint hover:bg-pine-900/10 hover:text-ink",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}