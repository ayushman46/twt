import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/section-heading";
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
    <Section id="search" labelledBy="search-title">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        <div className="flex flex-col gap-10">
          <SectionHeading id="search-title" title={t.title} description={t.description} />
          <Reveal>
            <SearchDemo t={t.demo} />
          </Reveal>
        </div>

        <Reveal>
          <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
            {OPERATORS.map((o, i) => (
              <div key={`${o.op}:${o.value ?? ""}`} className="flex flex-col gap-1 bg-bg px-4 py-3.5 sm:px-5">
                <dt lang="en" className="font-mono text-[13px]">
                  {o.negate ? (
                    <span className="text-fg">-{o.op}</span>
                  ) : (
                    <>
                      <span className="text-muted">{o.op}:</span>
                      <span className="text-fg">{o.value}</span>
                    </>
                  )}
                </dt>
                <dd className="text-[13.5px] text-muted">{t.operators[i]}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </Section>
  );
}
