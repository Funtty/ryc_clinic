"use client";

import "./globals.css";
import { Container } from "@/components/ui/container";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-cream text-ink">
        <Container className="section-pad">
          <div className="mx-auto max-w-lg">
            <div className="rounded-3xl border border-error/25 bg-error/8 p-6">
              <p className="font-display text-lg font-semibold text-ink">
                The clinic site hit an error
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-sub">
                We couldn&rsquo;t load the page. Please try again, or call us and
                we&rsquo;ll help directly.
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="mt-6 inline-flex h-11 items-center rounded-full bg-pine-900 px-6 font-semibold text-cream transition-colors hover:bg-pine-700"
            >
              Try again
            </button>
          </div>
        </Container>
      </body>
    </html>
  );
}