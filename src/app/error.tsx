"use client";

import { ErrorCard } from "@/components/ui/error-card";
import { Container } from "@/components/ui/container";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container className="section-pad">
      <ErrorCard onReset={reset} />
    </Container>
  );
}