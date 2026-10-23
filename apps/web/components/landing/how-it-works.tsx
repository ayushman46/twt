import { MousePointerClick, Puzzle, Search } from "lucide-react";
import { DEFAULT_CATEGORIES } from "@twtdash/shared";
import { Reveal } from "@/components/ui/reveal";
import { Accent, SectionHeading } from "@/components/ui/section-heading";
import { BROWSERS } from "@/lib/site";

const STEPS = [
  {
    icon: Puzzle,
    title: "Install the extension",
    body: `Add twtdash to ${BROWSERS.slice(0, -1).join(", ")} or ${BROWSERS.at(-1)}. There's no account to create and nothing to configure.`,
    detail: "No account needed",
  },
  {
    icon: MousePointerClick,
    title: "Sync in one click",
    body: "twtdash opens your X bookmarks and scrolls through them for you, reading X's own page data — no X API key or paid X plan. Quick sync grabs only what's new; full sync re-reads everything. Pull in your Likes too, if you want.",
    detail: "Quick or full sync",
  },
  {
    icon: Search,
    title: "Find anything, instantly",
    body: `Every post lands in one of ${DEFAULT_CATEGORIES.length} categories on your device. Search with operators, tag, star, add notes and rediscover what you saved — all in a fast local dashboard.`,
    detail: "Instant full-text search",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="container-page">
        <SectionHeading
          id="how-title"
          eyebrow="How it works"
          title={
            <>
              From bookmark chaos to a library in <Accent gradient>three steps</Accent>
            </>
          }
          description="No scripts to run, no API keys, no exports to wrangle. twtdash does the tedious part while you watch."
        />

        <ol className="relative mt-16 grid gap-5 md:grid-cols-3">
          {/* connector line between the steps (desktop) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[16%] top-[3.25rem] hidden h-px bg-[linear-gradient(90deg,rgb(123_97_255/0),rgb(123_97_255/0.45),rgb(177_76_242/0.45),rgb(255_92_157/0.45),rgb(255_92_157/0))] md:block"
          />
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative">
              <Reveal delay={i * 0.08} className="panel group h-full bg-ink-raised p-6 transition-colors hover:border-white/[0.12] sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="icon-tile-brand flex size-11 items-center justify-center rounded-xl">
                    <step.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-xs tabular-nums text-zinc-600" aria-hidden="true">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-semibold tracking-[-0.02em] text-white">{step.title}</h3>
                <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-zinc-400">{step.body}</p>
                <p className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-300">
                  <span aria-hidden="true" className="size-1 rounded-full bg-brand-soft" />
                  {step.detail}
                </p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
