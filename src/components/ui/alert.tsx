import type { ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertTone = "success" | "info" | "warning" | "error";

type AlertProps = {
  tone?: AlertTone;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
};

const config: Record<
  AlertTone,
  { icon: typeof Info; panel: string; iconWrap: string; title: string; role: "status" | "alert" }
> = {
  success: {
    icon: CheckCircle2,
    panel: "border-success/20 bg-success/8 text-ink",
    iconWrap: "bg-success text-white",
    title: "text-ink",
    role: "status",
  },
  info: {
    icon: Info,
    panel: "border-pine-600/20 bg-pine-50 text-ink",
    iconWrap: "bg-pine-800 text-cream",
    title: "text-ink",
    role: "status",
  },
  warning: {
    icon: TriangleAlert,
    panel: "border-warning/25 bg-warning/10 text-ink",
    iconWrap: "bg-warning text-white",
    title: "text-ink",
    role: "status",
  },
  error: {
    icon: CircleAlert,
    panel: "border-error/25 bg-error/8 text-ink",
    iconWrap: "bg-error text-white",
    title: "text-ink",
    role: "alert",
  },
};

export function Alert({ tone = "info", title, children, className }: AlertProps) {
  const { icon: Icon, panel, iconWrap, title: titleClass, role } = config[tone];
  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-4 rounded-2xl border p-5",
        panel,
        className,
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          iconWrap,
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className={cn("font-display text-base font-semibold", titleClass)}>
          {title}
        </p>
        {children && (
          <div className="mt-1 text-sm leading-relaxed text-ink-sub">{children}</div>
        )}
      </div>
    </div>
  );
}