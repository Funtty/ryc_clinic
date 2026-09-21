import { ChevronDown } from "lucide-react";
import type { FaqItem } from "@/lib/faqs";
import { Card } from "@/components/ui/card";

type FaqAccordionProps = {
  items: FaqItem[];
};

export function FaqAccordion({ items }: FaqAccordionProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {items.map((item) => (
        <Card
          as="details"
          key={item.question}
          className="group transition-shadow open:shadow-card"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 font-medium text-ink transition-colors hover:bg-pine-50/60 [&::-webkit-details-marker]:hidden">
            <span className="text-base">{item.question}</span>
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-pine-900/10 text-pine-800 transition-transform duration-200 group-open:rotate-180">
              <ChevronDown className="size-4" aria-hidden="true" />
            </span>
          </summary>
          <div className="px-5 pb-5">
            <p className="text-sm leading-relaxed text-ink-sub">{item.answer}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}