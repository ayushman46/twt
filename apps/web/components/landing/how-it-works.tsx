import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/section-heading";
import type { Dictionary } from "@/lib/i18n/types";

export function HowItWorks({ t }: { t: Dictionary["how"] }) {
  return (
    <Section id="how-it-works" labelledBy="how-title">
      <SectionHeading id="how-title" title={t.title} description={t.description} />
      <Reveal as="ol" className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
        {t.steps.map((step, i) => (
          <li key={step.title} className="flex flex-col bg-bg p-6 sm:p-7">
            <span aria-hidden="true" className="font-mono text-[13px] tabular-nums text-muted">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-6 text-[17px] font-semibold tracking-[-0.015em] text-fg">{step.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </Reveal>
    </Section>
  );
}
