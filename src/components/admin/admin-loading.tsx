import { cn } from "@/lib/utils";

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-pine-900/10", className)}
    />
  );
}

export function AdminListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SkeletonBlock className="h-4 w-48" />
        <SkeletonBlock className="h-10 w-40 rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-(--radius-panel) border border-pine-900/8 bg-white p-5 shadow-soft">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="mt-3 h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-(--radius-panel) border border-pine-900/8 bg-white shadow-soft">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={cn("flex items-center gap-4 px-5 py-4", i > 0 && "border-t border-pine-900/8")}>
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-4 w-full max-w-64" />
            <SkeletonBlock className="ml-auto h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminPageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading pages">
      <SkeletonBlock className="h-7 w-2/3" />
      <SkeletonBlock className="h-4 w-1/2" />
      <AdminListSkeleton rows={4} />
    </div>
  );
}