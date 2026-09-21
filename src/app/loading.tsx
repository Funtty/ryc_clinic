import { Container } from "@/components/ui/container";

export default function Loading() {
  return (
    <Container className="section-pad">
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-ink-sub"
      >
        <span className="size-8 animate-spin rounded-full border-2 border-pine-900/15 border-t-pine-700" />
        <span className="text-sm font-medium">Loading…</span>
      </div>
    </Container>
  );
}
