import { ClipboardList, Stethoscope, Ruler, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";

const steps = [
  {
    icon: ClipboardList,
    title: "Share your concerns",
    body: "You'll start with a short health form and a conversation. Tell us what's bothering you — pain, a worry, a goal for your smile.",
  },
  {
    icon: Stethoscope,
    title: "Gentle examination",
    body: "We examine every tooth and gum carefully, using X-rays only where they're genuinely needed. You'll never be rushed.",
  },
  {
    icon: Ruler,
    title: "A clear plan, upfront",
    body: "You'll leave understanding your options — plain language, honest prices, and no pressure to decide today.",
  },
  {
    icon: Sparkles,
    title: "Comfort at every visit",
    body: "From a warm welcome to aftercare follow-ups, we keep the whole experience calm, clean and comfortable.",
  },
];

export function PatientExperience() {
  return (
    <section className="section-pad bg-cream-strong">
      <Container>
        <SectionHeading
          eyebrow="The patient experience"
          title="Every visit, designed around you"
          lede="Whether it's a first check-up or a full smile makeover, here's what you can expect when you choose RYC."
          align="center"
        />
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="relative"
            >
              <Card variant="panel-lg" className="relative p-7">
                <span
                  className="absolute right-6 top-5 font-display text-4xl font-medium text-pine-900/8"
                  aria-hidden="true"
                >
                  0{i + 1}
                </span>
                <span className="grid size-12 place-items-center rounded-2xl bg-pine-900 text-cream">
                  <s.icon className="size-6" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold text-ink">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-sub">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}