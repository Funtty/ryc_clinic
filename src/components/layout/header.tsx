"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Phone, Mail, Clock } from "lucide-react";
import { navLinks, site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

type HeaderProps = {
  hoursSummary?: string;
};

export function Header({ hoursSummary }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="relative">
      {/* Utility bar */}
      <div className="hidden bg-pine-950 text-cream/80 md:block">
        <Container className="flex h-10 items-center justify-between text-xs">
          <div className="flex items-center gap-6">
            <a
              href={`tel:${site.phone.replace(/\s/g, "")}`}
              className="flex items-center gap-2 transition-colors hover:text-cream"
            >
              <Phone className="size-3.5 text-gold-400" aria-hidden="true" />
              {site.phoneDisplay}
            </a>
            <a
              href={`mailto:${site.email}`}
              className="flex items-center gap-2 transition-colors hover:text-cream"
            >
              <Mail className="size-3.5 text-gold-400" aria-hidden="true" />
              {site.email}
            </a>
          </div>
          {hoursSummary && (
            <span className="flex items-center gap-2">
              <Clock className="size-3.5 text-gold-400" aria-hidden="true" />
              {hoursSummary}
            </span>
          )}
        </Container>
      </div>

      {/* Main navigation */}
      <div className="sticky top-0 z-50 border-b border-pine-900/5 bg-cream/85 backdrop-blur-md">
        <Container className="flex h-16 items-center justify-between gap-4 lg:h-20">
          <Logo />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-pine-100 text-pine-900"
                      : "text-ink-sub hover:bg-pine-50 hover:text-pine-900",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <Button
                href="/booking"
                size="sm"
                className="lg:px-5"
                showArrow
              >
                Book an Appointment
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              className="grid size-10 place-items-center rounded-full border border-pine-900/10 text-ink transition-colors hover:bg-pine-50 lg:hidden"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </Container>

        {/* Mobile menu */}
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          inert={!open}
          aria-hidden={!open}
          className={cn(
            "overflow-hidden border-t border-pine-900/5 bg-cream transition-[max-height,opacity] duration-300 lg:hidden",
            open ? "max-h-[38rem] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <Container className="flex flex-col gap-1 py-4">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-xl px-4 py-3 text-base font-medium transition-colors",
                    active
                      ? "bg-pine-100 text-pine-900"
                      : "text-ink-sub hover:bg-pine-50 hover:text-pine-900",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-3 flex flex-col gap-3 border-t border-pine-900/10 pt-4">
              <Button href="/booking" variant="primary" showArrow>
                Book an Appointment
              </Button>
              <a
                href={`tel:${site.phone.replace(/\s/g, "")}`}
                className="flex items-center justify-center gap-2 text-sm font-semibold text-pine-800"
              >
                <Phone className="size-4" aria-hidden="true" />
                {site.phoneDisplay}
              </a>
            </div>
          </Container>
        </nav>
      </div>
    </header>
  );
}