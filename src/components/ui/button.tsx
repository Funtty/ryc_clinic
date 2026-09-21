import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "gold"
  | "outline"
  | "ghost"
  | "ghostLight"
  | "outlineLight";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-all duration-200 disabled:pointer-events-none disabled:opacity-60";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-pine-900 text-cream shadow-soft hover:-translate-y-0.5 hover:bg-pine-700 hover:shadow-card",
  gold: "bg-gold-500 text-ink shadow-soft hover:-translate-y-0.5 hover:bg-gold-400 hover:shadow-card",
  outline:
    "border border-pine-900/25 bg-transparent text-ink hover:border-pine-800 hover:bg-white",
  ghost: "text-pine-900 hover:bg-pine-100",
  ghostLight: "text-cream hover:bg-white/10",
  outlineLight:
    "border border-white/20 bg-transparent text-cream hover:border-gold-400 hover:bg-white/10",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
};

type ButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  ariaLabel?: string;
  showArrow?: boolean;
  disabled?: boolean;
};

export function Button({
  children,
  href,
  variant = "primary",
  size = "md",
  className,
  type = "button",
  onClick,
  ariaLabel,
  showArrow = false,
  disabled,
}: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);
  const inner = (
    <>
      {children}
      {showArrow && (
        <ArrowRight
          className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(classes, "group")}
        aria-label={ariaLabel}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(classes, "group")}
    >
      {inner}
    </button>
  );
}