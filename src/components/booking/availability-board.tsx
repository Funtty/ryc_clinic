import { PhoneCall, Info, CalendarX2 } from "lucide-react";
import { site } from "@/lib/site";
import { slotLabel } from "@/lib/datetime";
import type { SlotWithDentist } from "@/lib/availability";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AvailabilityBoardProps = {
  slots: SlotWithDentist[];
};

export function AvailabilityBoard({ slots }: AvailabilityBoardProps) {
  const groups = new Map<string, SlotWithDentist[]>();
  for (const s of slots) {
    const list = groups.get(s.dentist.id) ?? [];
    list.push(s);
    groups.set(s.dentist.id, list);
  }

  return (
    <Card
      as="section"
      aria-labelledby="availability-heading"
      variant="panel-lg"
      className="p-6 sm:p-7"
    >
      <h2
        id="availability-heading"
        className="font-display text-xl font-semibold text-ink"
      >
        Live availability
      </h2>
      <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-ink-sub">
        <Info className="mt-0.5 size-4 shrink-0 text-gold-700" aria-hidden="true" />
        Times below are computed from the clinic&rsquo;s real schedules and
        update as appointments are taken.
      </p>

      {groups.size === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={CalendarX2}
            title="No online availability right now"
            message="Every slot in the next two weeks is taken or the clinic is closed — call us and we’ll fit you in."
            action={
              <Button href={`tel:${site.phone.replace(/\s/g, "")}`}>
                <PhoneCall className="size-4" aria-hidden="true" />
                {site.phoneDisplay}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {[...groups.entries()].map(([dentistId, list]) => (
            <div key={dentistId}>
              <p className="text-sm font-bold text-pine-900">
                {list[0].dentist.name}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {list.map((s) => (
                  <span
                    key={`${s.dateKey}-${s.start.getTime()}`}
                    className="rounded-full border border-pine-900/10 bg-cream px-3.5 py-1.5 text-sm font-medium text-ink-sub"
                  >
                    {slotLabel(s.start)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-7 rounded-2xl bg-pine-900 p-5 text-cream">
        <p className="text-sm font-semibold">Want to secure a slot now?</p>
        <p className="mt-1 text-sm text-cream/70">
          Call our front desk — bookings, rescheduling and same-day emergency
          slots.
        </p>
        <a
          href={`tel:${site.phone.replace(/\s/g, "")}`}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-gold-400"
        >
          <PhoneCall className="size-4" aria-hidden="true" />
          {site.phoneDisplay}
        </a>
      </div>
    </Card>
  );
}