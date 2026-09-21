import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
};

const sizes = {
  sm: "size-4",
  md: "size-5",
  lg: "size-7",
};

export function Spinner({ size = "md", className, label = "Loading" }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-2", className)}>
      <LoaderCircle
        className={cn("animate-spin text-pine-600", sizes[size])}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("block animate-pulse rounded-xl bg-pine-200/60", className)}
    />
  );
}