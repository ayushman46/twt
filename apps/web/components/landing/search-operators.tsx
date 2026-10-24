import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import type { Dictionary } from "@/lib/i18n/types";
import { SearchDemo } from "./search-demo";

const OPERATORS: Array<{ op: string; value?: string; negate?: boolean }> = [
  { op: "from", value: "handle" },
  { op: "has", value: "video" },
  { op: "has", value: "link" },
  { op: "is", value: "thread" },
  { op: "cat", value: "ai" },
  { op: "tag", value: "react" },
  { op: "in", value: "collection" },
  { op: "after", value: "2025-01-01" },
  { op: "before", value: "2026-01-01" },
  { op: "min_likes", value: "500" },
  { op: "lang", value: "hi" },
  { op: "exclude", negate: true },
];

export function SearchOperators({ t }: { t: Dictionary["search"] }) {
  return (
    <section aria-labelledby="search-title" className="cv-auto relative isolate py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute right-[-12rem] top-1/2 h-[30rem] w-[30rem] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(177_76_242/0.1),transparent)]" />
      </div>
      <div className="container-page grid items-center gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <div className="flex flex-col gap-8">
          <SectionHeading id="search-title" align="left" eyebrow={t.eyebrow} title={t.title} description={t.description} />
          <Reveal delay={0.05}>
            <SearchDemo t={t.demo} />
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-[0_30px_80px_-40px_rgb(0_0_0/0.9)] sm:grid-cols-2">
            {OPERATORS.map((o, i) => (
              <div
                key={`${o.op}:${o.value ?? ""}`}
                className="flex flex-col gap-1 bg-ink-raised px-4 py-3.5 transition-colors hover:bg-[#12121a] sm:px-5"
              >
                <dt lang="en" className="font-mono text-[13px]">
                  {o.negate ? (
                    <span className="text-rose-300">-{o.op}</span>
                  ) : (
                    <>
                      <span className="text-brand-soft">{o.op}:</span>
                      <span className="text-accent">{o.value}</span>
                    </>
                  )}
                </dt>
                <dd className="text-sm text-zinc-400">{t.operators[i]}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
