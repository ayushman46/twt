import { MousePointerClick, Puzzle, Search } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import type { Dictionary } from "@/lib/i18n/types";

const ICONS = [Puzzle, MousePointerClick, Search] as const;

export function HowItWorks({ t }: { t: Dictionary["how"] }) {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="cv-auto relative scroll-mt-20 py-24 sm:py-32">
      <div className="container-page">
        <SectionHeading id="how-title" eyebrow={t.eyebrow} title={t.title} description={t.description} />

        <div className="relative mt-16">
          {/* connector line between the steps (desktop) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[16%] top-[3.25rem] hidden h-px bg-[linear-gradient(90deg,rgb(123_97_255/0),rgb(123_97_255/0.45),rgb(177_76_242/0.45),rgb(255_92_157/0.45),rgb(255_92_157/0))] md:block"
          />
        <ol className="relative grid gap-5 md:grid-cols-3">
          {t.steps.map((step, i) => {
            const Icon = ICONS[i] ?? Search;
            return (
              <Reveal as="li" key={step.title} delay={i * 0.08} className="relative">
                <div className="panel group h-full bg-ink-raised p-6 transition-colors hover:border-white/[0.12] sm:p-7">
                  <div className="flex items-center justify-between">
                    <span className="icon-tile-brand flex size-11 items-center justify-center rounded-xl">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-xs tabular-nums text-zinc-500" aria-hidden="true">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold tracking-[-0.02em] text-white">{step.title}</h3>
                  <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-zinc-400">{step.body}</p>
                  <p className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-300">
                    <span aria-hidden="true" className="size-1 rounded-full bg-brand-soft" />
                    {step.detail}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </ol>
        </div>
      </div>
    </section>
  );
}
