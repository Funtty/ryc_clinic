import Link from "next/link";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

type LogoProps = {
  dark?: boolean;
  className?: string;
};

export function Logo({ dark = false, className }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label="RYC Dental Service — home"
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl transition-transform duration-300 hover:rotate-3",
          dark ? "bg-cream text-pine-950" : "bg-pine-900 text-cream",
        )}
      >
        <Smile className="size-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="leading-none">
        <span
          className={cn(
            "block font-display text-lg font-semibold tracking-tight",
            dark ? "text-cream" : "text-ink",
          )}
        >
          RYC Dental
        </span>
        <span
          className={cn(
            "mt-1 block text-[0.62rem] font-bold uppercase tracking-[0.3em]",
            dark ? "text-cream/60" : "text-ink-faint",
          )}
        >
          Service
        </span>
      </span>
    </Link>
  );
}