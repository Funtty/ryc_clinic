import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeProps = {
  children: ReactNode;
  className?: string;
  tone?: BadgeTone;
};

export type BadgeTone =
  | "pine"
  | "gold"
  | "cream"
  | "soft"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "deep"
  | "muted";

const tones: Record<BadgeTone, string> = {
  pine: "bg-pine-900 text-cream",
  gold: "bg-gold-400/20 text-gold-700",
  cream: "bg-cream/10 text-cream",
  soft: "bg-pine-100 text-pine-800",
  /* Semantic status tones (balanced, AA-checked for small text) */
  success: "bg-success/10 text-success",
  error: "bg-error/10 text-error",
  warning: "bg-warning/13 text-warning",
  info: "bg-pine-100 text-pine-900",
  deep: "bg-pine-200 text-pine-900",
  muted: "bg-ink-faint/10 text-ink-faint",
};

export function Badge({ children, className, tone = "pine" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}