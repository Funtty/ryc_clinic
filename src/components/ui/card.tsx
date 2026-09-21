import type {
  AnchorHTMLAttributes,
  ElementType,
  FormHTMLAttributes,
  HTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/**
 * The single surface primitive for RYC. Every panel, list shell and
 * interactive card in the app should be built from Card so radii, borders,
 * shadows and hover behaviour stay consistent in one place.
 *
 * - `panel`    → dense card (forms, admin sections, list rows)
 * - `panel-lg` → large public card (contact, hero sidebars)
 * - `table`    → flush list shell (children become divide-y rows)
 * - hover      → adds a subtle lifted shadow + translate (gentle/lift)
 */
type CardVariant = "panel" | "panel-lg" | "table";
type CardHover = "none" | "gentle" | "lift";

const BASE = "border border-pine-900/8 bg-white shadow-soft";
const VARIANTS: Record<CardVariant, string> = {
  panel: "rounded-(--radius-panel)",
  "panel-lg": "rounded-(--radius-panel-lg)",
  table: "overflow-hidden rounded-(--radius-panel)",
};
const HOVER: Record<CardHover, string> = {
  none: "",
  gentle: "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card",
  lift: "transition-all duration-300 hover:-translate-y-1 hover:shadow-card",
};

type CardProps = {
  as?: ElementType;
  variant?: CardVariant;
  hover?: CardHover;
  className?: string;
} & HTMLAttributes<HTMLElement> &
  AnchorHTMLAttributes<HTMLAnchorElement> &
  FormHTMLAttributes<HTMLFormElement>;

export function Card({
  as: Tag = "div",
  variant = "panel",
  hover: hoverMode = "none",
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag className={cn(BASE, VARIANTS[variant], HOVER[hoverMode], className)} {...rest}>
      {children}
    </Tag>
  );
}