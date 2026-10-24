import { ArrowRight, Database, EyeOff, HardDrive, KeyRound, UserX } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { LogoMark } from "@/components/site/logo";
import type { Dictionary } from "@/lib/i18n/types";

type T = Dictionary["privacy"];

const ICONS = [HardDrive, UserX, KeyRound, Database] as const;

export function PrivacySection({ t, lang }: { t: T; lang: string }) {
  return (
    <section aria-labelledby="privacy-title" className="cv-auto relative py-24 sm:py-32">
      <div className="container-page">
        <div className="panel relative isolate overflow-hidden px-5 py-12 sm:px-10 sm:py-16 lg:px-14">
          <div aria-hidden="true" className="bg-dots pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_top_right,#000_10%,transparent_60%)]" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-40 -z-10 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(123_97_255/0.14),rgb(255_92_157/0.04)_60%,transparent)]"
          />
          <div className="relative grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-10">
              <SectionHeading
                id="privacy-title"
                align="left"
                eyebrow={t.eyebrow}
                title={t.title}
                description={t.description}
              />
              <ul className="grid gap-6 sm:grid-cols-2">
                {t.points.map((p, i) => {
                  const Icon = ICONS[i] ?? HardDrive;
                  return (
                  <li key={p.title}>
                    <Reveal delay={i * 0.05} className="flex flex-col gap-2">
                      <span className="icon-tile-soft mb-1 flex size-9 items-center justify-center rounded-lg">
                        <Icon className="size-[1.05rem]" aria-hidden="true" />
                      </span>
                      <h3 className="font-semibold tracking-[-0.01em] text-white">{p.title}</h3>
                      <p className="text-sm leading-relaxed text-zinc-400">{p.body}</p>
                    </Reveal>
                  </li>
                  );
                })}
              </ul>
              {/* The policy is English-only; a plain link also crosses root layouts from /hi. */}
              <a
                href="/privacy"
                hrefLang={lang === "en" ? undefined : "en"}
                className="group inline-flex w-fit items-center gap-1.5 text-sm font-medium text-brand-soft transition-colors hover:text-white"
              >
                {t.link}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </a>
            </div>

            <Reveal delay={0.1}>
              <DataFlowDiagram t={t.diagram} />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Coded diagram of where data flows. */
function DataFlowDiagram({ t }: { t: T["diagram"] }) {
  return (
    <figure className="relative">
      <figcaption className="sr-only">{t.caption}</figcaption>
      <div aria-hidden="true" className="flex flex-col items-stretch gap-3">
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            <span className="size-1.5 rounded-full bg-emerald-400" /> {t.browser}
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center text-xs">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-4">
              <div className="font-mono text-[11px] text-zinc-300">x.com</div>
              <div className="mt-1 text-[10.5px] text-zinc-500">{t.bookmarks}</div>
            </div>
            <Arrow />
            <div className="ring-gradient ring-brand flex flex-col items-center rounded-xl bg-[linear-gradient(135deg,rgb(123_97_255/0.16),rgb(255_92_157/0.08))] px-2 py-3 shadow-[0_0_44px_-10px_rgb(177_76_242/0.75)]">
              <LogoMark id="diagram" className="size-7" />
              <div className="mt-1.5 text-[11px] font-medium text-white">twtdash</div>
            </div>
            <Arrow />
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-4">
              <div className="text-[11px] text-zinc-300">IndexedDB</div>
              <div className="mt-1 text-[10.5px] text-zinc-500">{t.onDevice}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="h-10 w-px border-l border-dashed border-white/20" />
        </div>

        <div className="mx-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm">
          <EyeOff className="size-5 shrink-0 text-zinc-500" />
          <div>
            <div className="font-medium text-zinc-200">{t.nvidia}</div>
            <div className="text-xs text-zinc-500">{t.nvidiaNote}</div>
          </div>
        </div>
      </div>
    </figure>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 8" className="h-2 w-5 text-zinc-600 sm:w-6" fill="none" aria-hidden="true">
      <path d="M0 4h21m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
