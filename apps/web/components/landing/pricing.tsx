import { Check, KeyRound, Puzzle, Sparkles } from "lucide-react";
import { PRICING } from "@twtdash/shared";
import { ButtonLink } from "@/components/ui/button-link";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import type { Dictionary } from "@/lib/i18n/types";
import { CHECKOUT_URL, CHECKOUT_URL_INR, installHref } from "@/lib/site";
import { PricingShell } from "./pricing-shell";

type Currency = "usd" | "inr";

const PLANS: Record<Currency, { monthly: number; yearly: number; code: string; checkout: string }> = {
  usd: { ...PRICING.pro, code: "USD", checkout: CHECKOUT_URL },
  inr: { ...PRICING.inr, code: "INR", checkout: CHECKOUT_URL_INR },
};

const savings = (c: Currency) => Math.round((1 - PLANS[c].yearly / (PLANS[c].monthly * 12)) * 100);

function money(amount: number, c: Currency, locale: string) {
  return new Intl.NumberFormat(c === "inr" ? (locale === "hi-IN" ? "hi-IN" : "en-IN") : "en-US", {
    style: "currency",
    currency: PLANS[c].code,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Server-rendered price for one currency, both periods (CSS shows the active ones). */
function ProPrice({ c, t, locale }: { c: Currency; t: Dictionary["pricing"]; locale: string }) {
  const plan = PLANS[c];
  const perMonthExact = plan.yearly / 12;
  const perMonth = `${Number.isInteger(perMonthExact) ? "" : "≈ "}${money(Math.round(perMonthExact), c, locale)}`;
  return (
    <span className={`cur-${c} contents`}>
      <span className="text-5xl font-semibold tracking-[-0.04em] text-white tabular-nums">
        <span className="per-monthly">{money(plan.monthly, c, locale)}</span>
        <span className="per-yearly">{money(plan.yearly, c, locale)}</span>
      </span>
      <span className="text-sm text-zinc-400">
        <span className="per-monthly">{t.perMonth}</span>
        <span className="per-yearly">{t.perYear}</span>
      </span>
      <span className="w-full text-xs text-zinc-400">
        <span className="per-yearly">{t.yearlyNote(perMonth)}</span>
        <span className="per-monthly">{t.monthlyNote(money(plan.yearly, c, locale), savings(c))}</span>
      </span>
    </span>
  );
}

export function Pricing({ dict }: { dict: Dictionary }) {
  const t = dict.pricing;
  const locale = dict.numberLocale;
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="cv-auto relative scroll-mt-20 py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute bottom-0 left-1/2 h-[30rem] w-[min(60rem,130vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(123_97_255/0.12),rgb(255_92_157/0.04)_60%,transparent)]" />
      </div>
      <div className="container-page">
        <SectionHeading id="pricing-title" eyebrow={t.eyebrow} title={t.title} description={t.description} />

        <PricingShell
          defaultCurrency={dict.locale === "hi" ? "inr" : "usd"}
          labels={{
            period: t.periodLabel,
            monthly: t.monthly,
            yearly: t.yearly,
            currency: t.currencyLabel,
            savings: { inr: savings("inr"), usd: savings("usd") },
          }}
        >
          <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
            <Reveal className="panel flex flex-col bg-ink-raised/80 p-7 sm:p-8">
              <h3 className="text-lg font-semibold text-white">{t.free.name}</h3>
              <p className="mt-1 text-sm text-zinc-400">{t.free.tagline}</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="text-5xl font-semibold tracking-[-0.04em] text-white">
                  <span className="cur-inr">₹0</span>
                  <span className="cur-usd">$0</span>
                </span>
                <span className="text-sm text-zinc-400">{t.free.forever}</span>
              </p>
              <a
                href={`${dict.locale === "en" ? "" : "/hi"}#nvidia-key`}
                className="mt-5 flex gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] p-3.5 transition-colors hover:border-emerald-400/40"
              >
                <KeyRound className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-medium text-emerald-100">{t.free.aiBanner}</span>
                  <span className="mt-0.5 block text-xs text-emerald-200/75">{t.free.aiBannerNote}</span>
                </span>
              </a>
              <ButtonLink href={installHref("chrome", dict.locale)} variant="secondary" className="mt-6 w-full">
                <Puzzle className="size-4" aria-hidden="true" />
                {t.free.cta}
              </ButtonLink>
              <ul className="mt-8 flex flex-col gap-3 text-sm text-zinc-300">
                {t.free.features.map((f) => (
                  <li key={f} className="flex gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-zinc-400" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal
              delay={0.08}
              className="ring-gradient ring-brand relative flex flex-col overflow-hidden rounded-[1.25rem] bg-[linear-gradient(180deg,rgb(123_97_255/0.16),rgb(177_76_242/0.05)_40%,rgb(14_14_20/0.9)_75%)] p-7 shadow-[0_0_0_1px_rgb(177_76_242/0.12),0_30px_90px_-30px_rgb(177_76_242/0.55),0_10px_60px_-30px_rgb(255_92_157/0.45)] sm:p-8"
            >
              <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 -z-10 size-72 rounded-full bg-[radial-gradient(closest-side,rgb(255_92_157/0.2),transparent)]" />
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.6),transparent)]" />
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                  {t.pro.name}
                  <span className="icon-tile-brand flex size-6 items-center justify-center rounded-md">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                  </span>
                </h3>
                <span className="rounded-full border border-white/10 bg-white/[0.08] px-2.5 py-1 text-xs font-medium text-zinc-100">{t.pro.badge}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-400">{t.pro.tagline}</p>
              <p className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <ProPrice c="inr" t={t} locale={locale} />
                <ProPrice c="usd" t={t} locale={locale} />
              </p>
              <ButtonLink href={PLANS.inr.checkout} className="cur-inr mt-7 w-full">
                {t.pro.cta}
              </ButtonLink>
              <ButtonLink href={PLANS.usd.checkout} className="cur-usd mt-7 w-full">
                {t.pro.cta}
              </ButtonLink>
              <ul className="mt-8 flex flex-col gap-3 text-sm text-zinc-200">
                {t.pro.features.map((f) => (
                  <li key={f} className="flex gap-3">
                    <span aria-hidden="true" className="bg-brand-gradient mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full">
                      <Check className="size-2.5 text-white" strokeWidth={3.5} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <p className="mt-8 border-t border-white/10 pt-5 text-xs leading-relaxed text-zinc-400">{t.pro.fine}</p>
            </Reveal>
          </div>
        </PricingShell>
      </div>
    </section>
  );
}
