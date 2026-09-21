import { PhoneCall } from "lucide-react";
import { site } from "@/lib/site";
import { slotLabel } from "@/lib/datetime";
import type { SlotWithDentist } from "@/lib/availability";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

type AvailabilityPreviewProps = {
  slots: SlotWithDentist[];
};

export function AvailabilityPreview({ slots }: AvailabilityPreviewProps) {
  return (
    <section className="section-pad bg-pine-950 text-cream">
      <Container className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-gold-400">
            See what&rsquo;s free
          </p>
          <h2 className="font-display text-3xl font-medium leading-tight sm:text-4xl">
            Booking online takes under a minute.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-cream/70">
            These are live availability windows drawn from our real clinic and
            dentist schedules — updated as appointments are booked.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button href="/booking" variant="gold" size="lg" showArrow>
              Start booking
            </Button>
            <a
              href={`tel:${site.phone.replace(/\s/g, "")}`}
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 px-7 text-base font-semibold text-cream transition-colors hover:border-gold-400 hover:text-gold-300"
            >
              <PhoneCall className="size-4" aria-hidden="true" />
              {site.phoneDisplay}
            </a>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <p className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-cream/60">
            Next available appointments
          </p>
          {slots.length === 0 ? (
            <p className="px-1 py-8 text-sm text-cream/70">
              Nothing available online right now — please call us and we&rsquo;ll
              find a slot for you.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-white/10">
              {slots.map((s, i) => (
                <li
                  key={`${s.dateKey}-${s.start.getTime()}-${s.dentist.id}`}
                  className="flex items-center justify-between gap-4 px-1 py-3.5"
                >
                  <div>
                    <p className="text-sm font-semibold">{slotLabel(s.start)}</p>
                    <p className="mt-0.5 text-xs text-cream/60">
                      {s.dentist.name}
                    </p>
                  </div>
                  {i === 0 && (
                    <span className="rounded-full bg-gold-400/20 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-gold-300">
                      Soonest
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </section>
  );
}