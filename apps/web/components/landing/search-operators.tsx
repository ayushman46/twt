import { Reveal } from "@/components/ui/reveal";
import { Accent, SectionHeading } from "@/components/ui/section-heading";
import { SearchDemo } from "./search-demo";

const OPERATORS: Array<{ op: string; value?: string; negate?: boolean; desc: string }> = [
  { op: "from", value: "handle", desc: "Posts by one author" },
  { op: "has", value: "video", desc: "Posts with a video" },
  { op: "has", value: "link", desc: "Posts that include a link" },
  { op: "is", value: "thread", desc: "Threads only" },
  { op: "cat", value: "ai", desc: "One category" },
  { op: "tag", value: "react", desc: "Posts with a tag" },
  { op: "in", value: "collection", desc: "Posts in a collection" },
  { op: "after", value: "2025-01-01", desc: "After a date" },
  { op: "before", value: "2026-01-01", desc: "Before a date" },
  { op: "min_likes", value: "500", desc: "At least 500 likes" },
  { op: "lang", value: "en", desc: "Posts in a language" },
  { op: "exclude", negate: true, desc: "Leave out a word or filter" },
];

export function SearchOperators() {
  return (
    <section aria-labelledby="search-title" className="relative isolate py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute right-[-12rem] top-1/2 h-[30rem] w-[30rem] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(177_76_242/0.1),transparent)]" />
      </div>
      <div className="container-page grid items-center gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <div className="flex flex-col gap-8">
          <SectionHeading
            id="search-title"
            align="left"
            eyebrow="Search"
            title={
              <>
                Search like you <Accent gradient>mean it</Accent>
              </>
            }
            description="Type a few words and twtdash searches the full text of everything you've saved — instantly, right in your browser. Add operators to slice your library any way you like, and combine as many as you need."
          />
          <Reveal delay={0.05}>
            <SearchDemo />
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-[0_30px_80px_-40px_rgb(0_0_0/0.9)] sm:grid-cols-2">
            {OPERATORS.map((o) => (
              <div
                key={`${o.op}:${o.value ?? ""}`}
                className="flex flex-col gap-1 bg-ink-raised px-4 py-3.5 transition-colors hover:bg-[#12121a] sm:px-5"
              >
                <dt className="font-mono text-[13px]">
                  {o.negate ? (
                    <span className="text-rose-300">-{o.op}</span>
                  ) : (
                    <>
                      <span className="text-brand-soft">{o.op}:</span>
                      <span className="text-accent">{o.value}</span>
                    </>
                  )}
                </dt>
                <dd className="text-sm text-zinc-400">{o.desc}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
