import { ArrowRight, HardDrive, Hash, IndianRupee, Languages, Laptop, Mic, Quote } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/section-heading";
import { categoryName, getCategory } from "@/lib/categories";
import { UI_LANGUAGES } from "@/lib/i18n/languages";
import type { Dictionary } from "@/lib/i18n/types";
import { CategoryChip } from "./category-chip";
import { FeatureCard, Initials, Inset } from "./feature-card";

type T = Dictionary["india"];

const WAVE = Array.from({ length: 40 }, (_, i) => Number((0.25 + 0.75 * Math.abs(Math.sin(i * 1.3) * Math.cos(i * 0.45))).toFixed(2)));

export function BuiltForIndia({ t, categoryNames }: { t: T; categoryNames?: Record<string, string> }) {
  const sports = getCategory("sports");
  return (
    <Section id="india" labelledBy="india-title">
      <SectionHeading id="india-title" title={t.title} description={t.description} />

      <Reveal className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
        <FeatureCard
          icon={Languages}
          title={t.languages.title}
          className="md:col-span-2 lg:col-span-4"
          visualIsContent
          visual={
            <ul className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 sm:grid-cols-5">
              {UI_LANGUAGES.map((l, i) => (
                <li key={l.code} className="flex min-h-[4.5rem] flex-col justify-between gap-2 rounded-lg border border-line bg-inset px-3 py-2.5">
                  <span lang={l.code} className="text-[17px] font-medium leading-snug text-fg">
                    {l.native}
                  </span>
                  <span className="flex items-center justify-between gap-1 text-[11.5px] text-muted">
                    {t.languages.names[i]}
                    {l.beta ? <span className="rounded bg-panel-3 px-1 text-[10.5px] leading-4 text-muted">{t.languages.beta}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          }
        >
          {t.languages.body}
        </FeatureCard>

        <FeatureCard
          icon={Quote}
          title={t.hinglish.title}
          className="md:col-span-2 lg:col-span-2"
          visual={
            <Inset>
              <div className="flex items-center gap-2">
                <Initials name="Rohan Iyer" />
                <span className="text-xs text-muted">{t.hinglish.author}</span>
              </div>
              <p lang="hi-Latn" className="mt-2.5 text-[13px] leading-snug text-fg-2">
                {t.hinglish.post}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs text-muted">
                <ArrowRight className="size-3.5" />
                {t.hinglish.sortedInto}
                <CategoryChip category={sports} label={categoryName(sports, categoryNames)} />
              </div>
            </Inset>
          }
        >
          {t.hinglish.body}
        </FeatureCard>

        <FeatureCard
          icon={Hash}
          title={t.numbers.title}
          className="lg:col-span-2"
          visual={
            <Inset className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-fg tabular-nums">{t.numbers.ours}</div>
                <div className="mt-1.5 text-[11.5px] text-muted">{t.numbers.label}</div>
              </div>
              <div className="text-[13px] tabular-nums text-muted line-through">{t.numbers.theirs}</div>
            </Inset>
          }
        >
          {t.numbers.body}
        </FeatureCard>

        <FeatureCard
          icon={Mic}
          title={t.voice.title}
          className="lg:col-span-2"
          visual={
            <Inset className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
                <Mic className="size-3.5" />
              </span>
              <span className="flex h-7 flex-1 items-center justify-between">
                {WAVE.map((h, i) => (
                  <span key={i} className="w-0.5 shrink-0 rounded-full bg-faint" style={{ height: `${Math.round(h * 28)}px` }} />
                ))}
              </span>
            </Inset>
          }
        >
          {t.voice.body}
        </FeatureCard>

        <FeatureCard
          icon={IndianRupee}
          title={t.freeAi.title}
          className="md:col-span-2 lg:col-span-2"
          visual={
            <Inset className="flex items-baseline justify-between gap-3">
              <span className="text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-fg">₹0</span>
              <span lang="en" className="font-mono text-xs text-muted">
                nvapi-••••••••
              </span>
            </Inset>
          }
        >
          {t.freeAi.body}
        </FeatureCard>

        <FeatureCard icon={Laptop} title={t.lowEnd.title} className="lg:col-span-3">
          {t.lowEnd.body}
        </FeatureCard>
        <FeatureCard icon={HardDrive} title={t.privacy.title} className="lg:col-span-3">
          {t.privacy.body}
        </FeatureCard>
      </Reveal>
    </Section>
  );
}
