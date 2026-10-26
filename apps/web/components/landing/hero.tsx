import { ArrowRight, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import type { Dictionary } from "@/lib/i18n/types";
import { installHref } from "@/lib/site";
import { MobileShare } from "./mobile-share";
import { ProductFrame } from "./product-frame";

/*
 * Nothing above the fold is wrapped in <Reveal>: the headline is the LCP
 * element and must paint with the first frame.
 */
export function Hero({ dict, categoryNames }: { dict: Dictionary; categoryNames?: Record<string, string> }) {
  const t = dict.hero;
  const home = dict.locale === "en" ? "" : "/hi";
  return (
    <section aria-labelledby="hero-title" className="pb-20 pt-12 sm:pb-24 sm:pt-20 lg:pt-24">
      <div className="container-page">
        <a
          href={`${home}#new`}
          className="group inline-flex h-7 max-w-full items-center gap-2 rounded-full border border-line bg-panel pl-1 pr-2.5 text-[13px] text-fg-2 transition-colors duration-150 hover:border-line-strong hover:text-fg"
        >
          <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-accent-soft px-2 text-xs font-medium text-accent">{t.pillBadge}</span>
          <span className="truncate sm:hidden">{t.pillShort}</span>
          <span className="hidden truncate sm:inline">{t.pillLong}</span>
          <ArrowRight className="size-3.5 shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
        </a>

        <h1
          id="hero-title"
          className="mt-6 max-w-4xl text-balance text-[2.625rem] font-semibold leading-[1.04] tracking-[-0.04em] text-fg min-[400px]:text-[2.875rem] sm:mt-7 sm:text-[3.75rem] lg:text-[4.5rem] lg:leading-[1.02]"
        >
          {t.titleLine1} <br className="hidden sm:block" />
          {t.titleAccent}
        </h1>

        <p className="mt-5 max-w-xl text-pretty text-[17px] leading-relaxed text-muted sm:mt-6 sm:text-lg">{t.description}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <ButtonLink href={installHref("chrome", dict.locale)} size="lg" className="w-full sm:w-auto">
            {t.ctaChrome}
          </ButtonLink>
          <ButtonLink href={installHref("firefox", dict.locale)} size="lg" variant="secondary" className="w-full sm:w-auto">
            {t.ctaFirefox}
          </ButtonLink>
        </div>

        <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-muted">
          {t.badges.map((badge) => (
            <li key={badge} className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-fg-2" aria-hidden="true" />
              {badge}
            </li>
          ))}
        </ul>

        <MobileShare t={t.mobile} />

        <div className="mt-14 sm:mt-20">
          <ProductFrame t={t.mockup} categoryNames={categoryNames} />
        </div>
      </div>
    </section>
  );
}
