import clsx from "clsx";
import { ArrowRight, HardDrive, Hash, IndianRupee, Laptop, Mic } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { categoryName, getCategory } from "@/lib/categories";
import { UI_LANGUAGES } from "@/lib/i18n/languages";
import type { Dictionary } from "@/lib/i18n/types";
import { CategoryChip } from "./category-chip";

type T = Dictionary["india"];

/** Thin saffron · white · green rule — a quiet nod to the flag. */
function Tricolor({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={clsx("flex h-[3px] overflow-hidden rounded-full", className)}>
      <span className="flex-1 bg-[#FF9933]" />
      <span className="flex-1 bg-white/85" />
      <span className="flex-1 bg-[#138808]" />
    </div>
  );
}

function Card({ className, delay = 0, children }: { className?: string; delay?: number; children: ReactNode }) {
  return (
    <Reveal
      delay={delay}
      className={clsx("panel relative isolate flex flex-col overflow-hidden p-6 transition-colors hover:border-white/[0.13] sm:p-7", className)}
    >
      {children}
    </Reveal>
  );
}

function SmallCard({ icon: Icon, title, body, visual, delay, className }: { icon: LucideIcon; title: string; body: string; visual?: ReactNode; delay?: number; className?: string }) {
  return (
    <Card delay={delay} className={className}>
      <span className="icon-tile-soft flex size-10 items-center justify-center rounded-xl">
        <Icon className="size-[1.1rem]" aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-[1.0625rem] font-semibold tracking-[-0.02em] text-white">{title}</h3>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-zinc-400">{body}</p>
      {visual ? (
        <div aria-hidden="true" className="mt-5 flex flex-1 items-end">
          <div className="w-full">{visual}</div>
        </div>
      ) : null}
    </Card>
  );
}

export function BuiltForIndia({ t, categoryNames }: { t: T; categoryNames?: Record<string, string> }) {
  const sports = getCategory("sports");
  return (
    <section id="india" aria-labelledby="india-title" className="cv-auto relative isolate scroll-mt-20 py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 top-20 size-[30rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_153_51/0.08),transparent)]" />
        <div className="absolute -right-40 bottom-10 size-[30rem] rounded-full bg-[radial-gradient(closest-side,rgb(19_136_8/0.08),transparent)]" />
      </div>
      <div aria-hidden="true" className="hairline pointer-events-none absolute inset-x-0 top-0" />
      <div className="container-page">
        <SectionHeading id="india-title" eyebrow={t.eyebrow} title={t.title} description={t.description} />
        <Tricolor className="mx-auto mt-8 w-24" />

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          {/* Languages */}
          <Card className="md:col-span-2 lg:col-span-4">
            <h3 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-white">{t.languages.title}</h3>
            <p className="mt-2 max-w-lg text-[0.9375rem] leading-relaxed text-zinc-400">{t.languages.body}</p>
            <ul className="mt-6 grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 sm:grid-cols-5">
              {UI_LANGUAGES.map((l, i) => (
                <li
                  key={l.code}
                  className={clsx(
                    "relative flex flex-col justify-between gap-2 rounded-xl border px-3 py-3",
                    l.beta
                      ? "border-white/[0.07] bg-white/[0.025]"
                      : "border-brand/40 bg-[linear-gradient(135deg,rgb(123_97_255/0.16),rgb(255_92_157/0.07))]",
                  )}
                >
                  <span lang={l.code} className="text-[1.15rem] font-medium leading-tight text-white">
                    {l.native}
                  </span>
                  <span className="flex items-center justify-between gap-1 text-[11px] text-zinc-400">
                    {t.languages.names[i]}
                    {l.beta ? <span className="rounded bg-white/[0.06] px-1 py-px text-[10px] text-zinc-400">{t.languages.beta}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Hinglish-aware sorting */}
          <Card delay={0.05} className="md:col-span-2 lg:col-span-2">
            <h3 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-white">{t.hinglish.title}</h3>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-zinc-400">{t.hinglish.body}</p>
            <div aria-hidden="true" className="mt-6 flex flex-1 flex-col justify-end gap-3">
              <div className="rounded-xl border border-white/[0.08] bg-black/25 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-teal-600 text-[10px] font-semibold text-white ring-1 ring-white/15">
                    RI
                  </span>
                  <span className="text-[12px] text-zinc-500">{t.hinglish.author}</span>
                </div>
                <p lang="hi-Latn" className="mt-2 text-[13px] leading-snug text-zinc-200">
                  {t.hinglish.post}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-zinc-400">
                <ArrowRight className="size-3.5 text-brand-soft" />
                {t.hinglish.sortedInto}
                <CategoryChip category={sports} label={categoryName(sports, categoryNames)} size="sm" />
              </div>
            </div>
          </Card>

          {/* Lakh & crore */}
          <SmallCard
            icon={Hash}
            title={t.numbers.title}
            body={t.numbers.body}
            className="lg:col-span-2"
            visual={
              <div className="flex items-end justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/25 px-4 py-3">
                <div>
                  <div className="text-brand-gradient text-[1.75rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">{t.numbers.ours}</div>
                  <div className="mt-1 text-[11px] text-zinc-500">{t.numbers.label}</div>
                </div>
                <div className="text-[13px] tabular-nums text-zinc-500 line-through decoration-rose-400/70">{t.numbers.theirs}</div>
              </div>
            }
          />

          {/* Voice */}
          <SmallCard
            icon={Mic}
            title={t.voice.title}
            body={t.voice.body}
            delay={0.05}
            className="lg:col-span-2"
            visual={
              <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-black/25 px-3 py-3">
                {[0.35, 0.7, 1, 0.55, 0.85, 0.4, 0.95, 0.6, 0.3, 0.75, 0.5, 0.9, 0.45, 0.65].map((h, i) => (
                  <span
                    key={i}
                    className="w-1 flex-1 rounded-full bg-gradient-to-t from-brand-violet via-brand-purple to-brand-pink"
                    style={{ height: `${Math.round(h * 28)}px` }}
                  />
                ))}
              </div>
            }
          />

          {/* Free AI */}
          <SmallCard
            icon={IndianRupee}
            title={t.freeAi.title}
            body={t.freeAi.body}
            delay={0.1}
            className="md:col-span-2 lg:col-span-2"
            visual={
              <div className="flex items-baseline gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3">
                <span className="text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-emerald-200">₹0</span>
                <span className="font-mono text-[12px] text-emerald-200/70">nvapi-••••••</span>
              </div>
            }
          />

          {/* Low-end laptops */}
          <SmallCard icon={Laptop} title={t.lowEnd.title} body={t.lowEnd.body} className="lg:col-span-3" />

          {/* Privacy */}
          <SmallCard icon={HardDrive} title={t.privacy.title} body={t.privacy.body} delay={0.05} className="lg:col-span-3" />
        </div>
      </div>
    </section>
  );
}
