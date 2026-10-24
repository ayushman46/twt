import { ArrowRight, Check, Globe, Puzzle } from "lucide-react";
import { Aurora } from "@/components/ui/aurora";
import { ButtonLink } from "@/components/ui/button-link";
import { Reveal } from "@/components/ui/reveal";
import { UI_LANGUAGES } from "@/lib/i18n/languages";
import type { Dictionary } from "@/lib/i18n/types";
import { installHref } from "@/lib/site";
import { DashboardMockup } from "./dashboard-mockup";
import { MobileShare } from "./mobile-share";


/*
 * Nothing above the fold is wrapped in <Reveal>: the headline is the LCP
 * element and must paint with the first frame.
 */
export function Hero({ dict, categoryNames }: { dict: Dictionary; categoryNames?: Record<string, string> }) {
  const t = dict.hero;
  const home = dict.locale === "en" ? "" : "/hi";
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden pb-20 pt-10 sm:pt-20 md:pb-32">
      {/* backdrop: grid, top spotlight */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-x-0 top-0 h-[56rem]" />
        <div className="absolute left-1/2 top-[-22rem] h-[42rem] w-[min(72rem,160vw)] -translate-x-1/2 bg-[radial-gradient(closest-side,rgb(123_97_255/0.24),rgb(177_76_242/0.08)_60%,transparent)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.08),transparent)]" />
      </div>

      <div className="container-page">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <a
            href={`${home}#new`}
            className="group inline-flex max-w-full items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] py-1 pl-1 pr-3 text-xs text-zinc-300 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] transition-colors hover:border-white/15 hover:bg-white/[0.06]"
          >
            <span className="bg-brand-gradient inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]">
              {t.pillBadge}
            </span>
            <span className="truncate sm:hidden">{t.pillShort}</span>
            <span className="hidden truncate sm:inline">{t.pillLong}</span>
            <ArrowRight
              className="size-3.5 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-300"
              aria-hidden="true"
            />
          </a>

          <h1
            id="hero-title"
            className="mt-7 text-balance text-[2.625rem] font-semibold leading-[1.02] tracking-[-0.045em] text-white min-[400px]:text-[2.9rem] sm:mt-8 sm:text-6xl md:text-[5.25rem]"
          >
            {t.titleLine1}
            <br className="hidden sm:block" />{" "}
            <span className="text-brand-gradient pr-[0.1em] font-display text-[1.08em] font-normal italic tracking-[-0.02em]">
              {t.titleAccent}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">{t.description}</p>

          <div className="mt-9 flex w-full flex-col items-center gap-3 sm:mt-10 sm:w-auto sm:flex-row">
            <ButtonLink href={installHref("chrome", dict.locale)} size="lg" className="w-full sm:w-auto">
              <Puzzle className="size-[1.1rem]" aria-hidden="true" />
              {t.ctaChrome}
            </ButtonLink>
            <ButtonLink href={installHref("firefox", dict.locale)} size="lg" variant="secondary" className="w-full sm:w-auto">
              <Globe className="size-[1.1rem]" aria-hidden="true" />
              {t.ctaFirefox}
            </ButtonLink>
          </div>

          <MobileShare t={t.mobile} />

          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-zinc-400">
            {t.badges.map((badge) => (
              <li key={badge} className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-brand-soft" aria-hidden="true" />
                {badge}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500">{t.worksIn}</p>

          <div className="mt-6 flex max-w-xl flex-wrap items-center justify-center gap-x-1 gap-y-1.5 text-[13px]">
            <span className="mr-1.5 text-xs text-zinc-500">{t.languagesLabel}</span>
            {UI_LANGUAGES.map((l) => (
              <span
                key={l.code}
                lang={l.code}
                className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-0.5 text-zinc-300"
              >
                {l.native}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto mt-16 max-w-6xl sm:mt-24">
          {/* animated brand aurora behind the product */}
          <Aurora className="-inset-x-[6%] -top-[14%] bottom-[35%] sm:-inset-x-[16%] sm:-top-[24%]" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[10%] -bottom-10 h-40 bg-[radial-gradient(closest-side,rgb(177_76_242/0.22),transparent)]"
          />
          <Reveal delay={0.15} y={40} className="relative">
            <DashboardMockup t={t.mockup} categoryNames={categoryNames} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
