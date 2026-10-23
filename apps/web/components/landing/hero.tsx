import Link from "next/link";
import { ArrowRight, Check, Globe, Puzzle } from "lucide-react";
import { BRAND, DEFAULT_CATEGORIES } from "@twtdash/shared";
import { Aurora } from "@/components/ui/aurora";
import { ButtonLink } from "@/components/ui/button-link";
import { Reveal } from "@/components/ui/reveal";
import { BROWSERS, CHROME_INSTALL_HREF, FIREFOX_INSTALL_HREF } from "@/lib/site";
import { DashboardMockup } from "./dashboard-mockup";

const BADGES = ["Free forever", "No account", "Local-first"] as const;

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden pb-20 pt-12 sm:pt-20 md:pb-32">
      {/* backdrop: grid, top spotlight */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-x-0 top-0 h-[56rem]" />
        <div className="absolute left-1/2 top-[-22rem] h-[42rem] w-[min(72rem,160vw)] -translate-x-1/2 bg-[radial-gradient(closest-side,rgb(123_97_255/0.24),rgb(177_76_242/0.08)_60%,transparent)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.08),transparent)]" />
      </div>

      <div className="container-page">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <Reveal y={10}>
            <Link
              href="/#features"
              className="group inline-flex max-w-full items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] py-1 pl-1 pr-3 text-xs text-zinc-300 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur transition-colors hover:border-white/15 hover:bg-white/[0.06]"
            >
              <span className="bg-brand-gradient inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]">
                On-device
              </span>
              <span className="truncate sm:hidden">Auto-sorted into {DEFAULT_CATEGORIES.length} categories</span>
              <span className="hidden truncate sm:inline">Every post auto-sorted into {DEFAULT_CATEGORIES.length} smart categories</span>
              <ArrowRight
                className="size-3.5 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-300"
                aria-hidden="true"
              />
            </Link>
          </Reveal>

          <Reveal delay={0.05}>
            <h1
              id="hero-title"
              className="mt-8 text-balance text-[2.625rem] font-semibold leading-[1.02] tracking-[-0.045em] text-white min-[400px]:text-[2.9rem] sm:text-6xl md:text-[5.25rem]"
            >
              Your X bookmarks,
              <br className="hidden sm:block" />{" "}
              <span className="text-brand-gradient pr-[0.1em] font-display text-[1.08em] font-normal italic tracking-[-0.02em]">
                finally organized.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">{BRAND.description}</p>
          </Reveal>

          <Reveal delay={0.18} className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <ButtonLink href={CHROME_INSTALL_HREF} size="lg" className="w-full sm:w-auto">
              <Puzzle className="size-[1.1rem]" aria-hidden="true" />
              Add to Chrome — it&apos;s free
            </ButtonLink>
            <ButtonLink href={FIREFOX_INSTALL_HREF} size="lg" variant="secondary" className="w-full sm:w-auto">
              <Globe className="size-[1.1rem]" aria-hidden="true" />
              Add to Firefox
            </ButtonLink>
          </Reveal>

          <Reveal delay={0.24}>
            <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-zinc-400">
              {BADGES.map((badge) => (
                <li key={badge} className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-brand-soft" aria-hidden="true" />
                  {badge}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500">Works in {BROWSERS.join(" · ")}</p>
          </Reveal>
        </div>

        <div className="relative mx-auto mt-16 max-w-6xl sm:mt-24">
          {/* animated brand aurora behind the product */}
          <Aurora className="-inset-x-[6%] -top-[14%] bottom-[35%] sm:-inset-x-[16%] sm:-top-[24%]" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[10%] -bottom-10 h-40 bg-[radial-gradient(closest-side,rgb(177_76_242/0.22),transparent)]"
          />
          <Reveal delay={0.3} y={40} className="relative">
            <DashboardMockup />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
