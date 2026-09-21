import type { ComponentType, ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  message?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
};

export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-(--radius-panel-lg) border border-dashed border-pine-900/15 bg-pine-50/50 text-center",
        compact ? "px-6 py-8" : "px-8 py-12",
        className,
      )}
    >
      <span
        className={cn(
          "grid place-items-center rounded-2xl bg-pine-100 text-pine-500",
          compact ? "size-11" : "size-14",
        )}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className={cn("font-display font-semibold text-ink", compact ? "mt-4 text-base" : "mt-5 text-lg")}>
        {title}
      </h3>
      {message && (
        <p className={cn("max-w-md text-sm leading-relaxed text-ink-sub", compact ? "mt-1.5" : "mt-2")}>
          {message}
        </p>
      )}
      {action && <div className={cn(compact ? "mt-4" : "mt-6")}>{action}</div>}
    </div>
  );
}