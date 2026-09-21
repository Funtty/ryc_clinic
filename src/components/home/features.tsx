import { Stethoscope, HeartPulse, HandHeart } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";

const features = [
  {
    icon: Stethoscope,
    title: "Modern, precise technology",
    body: "Digital X-rays, rotary endodontics and careful diagnostics let us treat accurately — and often more comfortably.",
  },
  {
    icon: HeartPulse,
    title: "Gentle, calm approach",
    body: "Anxious at the dentist? You're not alone. We work at your pace, explain everything, and make comfort the priority.",
  },
  {
    icon: HandHeart,
    title: "Honest, transparent care",
    body: "Clear treatment plans and upfront pricing — no surprises, no pressure, and options that respect your budget.",
  },
];

export function Features() {
  return (
    <Container className="relative z-10 -mt-10 sm:-mt-0">
      <h2 className="sr-only">Why patients choose RYC Dental Service</h2>
      <ul className="grid gap-5 sm:mt-[-1.5rem] md:grid-cols-3 lg:mt-[-2.5rem] lg:gap-6" role="list">
        {features.map((f) => (
          <li key={f.title}>
            <Card variant="panel-lg" className="p-7 shadow-card">
              <span className="grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine-800">
                <f.icon className="size-6" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold text-ink">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-sub">{f.body}</p>
            </Card>
          </li>
        ))}
      </ul>
    </Container>
  );
}