import { Smile } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="bg-pine-950 text-cream">
      <Container className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-white/5 text-gold-400">
          <Smile className="size-8" aria-hidden="true" />
        </span>
        <p className="mt-8 font-display text-7xl font-medium tracking-tight text-gold-400">
          404
        </p>
        <h1 className="mt-4 max-w-md font-display text-2xl font-semibold sm:text-3xl">
          That page took the day off.
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-cream/65">
          We couldn&rsquo;t find the page you were looking for. Let&rsquo;s get
          you back to a smile.
        </p>
        <div className="mt-8">
          <Button href="/" variant="gold" size="lg" showArrow>
            Back to home
          </Button>
        </div>
      </Container>
    </section>
  );
}