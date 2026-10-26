import { ArrowRight, Database, EyeOff, HardDrive, KeyRound, UserX } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/section-heading";
import { LogoMark } from "@/components/site/logo";
import type { Dictionary } from "@/lib/i18n/types";

type T = Dictionary["privacy"];

const ICONS = [HardDrive, UserX, KeyRound, Database] as const;

export function PrivacySection({ t, lang }: { t: T; lang: string }) {
  return (
    <Section id="privacy" labelledBy="privacy-title">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading id="privacy-title" title={t.title} description={t.description} />
          <ul className="mt-10 grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2">
            {t.points.map((p, i) => {
              const Icon = ICONS[i] ?? HardDrive;
              return (
                <li key={p.title}>
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{p.title}</h3>
                  </div>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{p.body}</p>
                </li>
              );
            })}
          </ul>
          {/* The policy is English-only; a plain link also crosses root layouts from /hi. */}
          <a
            href="/privacy"
            hrefLang={lang === "en" ? undefined : "en"}
            className="group mt-10 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent"
          >
            {t.link}
            <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        </div>

        <Reveal className="lg:pt-2">
          <DataFlowDiagram t={t.diagram} />
        </Reveal>
      </div>
    </Section>
  );
}

/** Coded diagram of where data flows. */
function DataFlowDiagram({ t }: { t: T["diagram"] }) {
  return (
    <figure>
      <figcaption className="sr-only">{t.caption}</figcaption>
      <div aria-hidden="true" className="rounded-xl border border-line bg-panel p-4 sm:p-6">
        <div className="rounded-lg border border-dashed border-line-strong p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-[13px] text-muted">
            <span className="size-1.5 rounded-full bg-good" />
            {t.browser}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-center">
            <div className="rounded-lg border border-line bg-inset px-2 py-4">
              <div lang="en" className="font-mono text-[12px] text-fg-2">
                x.com
              </div>
              <div className="mt-1 text-[11.5px] text-muted">{t.bookmarks}</div>
            </div>
            <Arrow />
            <div className="flex flex-col items-center rounded-lg border border-line-strong bg-panel-2 px-2 py-3">
              <LogoMark className="size-6" />
              <div lang="en" className="mt-1.5 text-[12px] font-medium text-fg">
                twtdash
              </div>
            </div>
            <Arrow />
            <div className="rounded-lg border border-line bg-inset px-2 py-4">
              <div lang="en" className="font-mono text-[12px] text-fg-2">
                IndexedDB
              </div>
              <div className="mt-1 text-[11.5px] text-muted">{t.onDevice}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="h-10 border-l border-dashed border-line-strong" />
        </div>

        <div className="mx-auto flex max-w-sm items-center gap-3 rounded-lg border border-line bg-inset p-4">
          <EyeOff className="size-4 shrink-0 text-muted" />
          <div>
            <div className="text-[13.5px] font-medium text-fg">{t.nvidia}</div>
            <div className="mt-0.5 text-[12.5px] text-muted">{t.nvidiaNote}</div>
          </div>
        </div>
      </div>
    </figure>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 8" className="h-2 w-5 text-faint sm:w-6" fill="none" aria-hidden="true">
      <path d="M0 4h21m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
