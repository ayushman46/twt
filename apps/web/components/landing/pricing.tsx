import { ArrowRight, Check, KeyRound } from "lucide-react";
import { PRICING } from "@twtdash/shared";
import { ButtonLink } from "@/components/ui/button-link";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/section-heading";
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

const priceClass = "text-[2.75rem] font-semibold leading-none tracking-[-0.04em] text-fg tabular-nums";

/** Server-rendered price for one currency, both periods (CSS shows the active ones). */
function ProPrice({ c, t, locale }: { c: Currency; t: Dictionary["pricing"]; locale: string }) {
  const plan = PLANS[c];
  const perMonthExact = plan.yearly / 12;
  const perMonth = `${Number.isInteger(perMonthExact) ? "" : "≈ "}${money(Math.round(perMonthExact), c, locale)}`;
  return (
    <span className={`cur-${c} contents`}>
      <span className="flex items-baseline gap-2">
        <span className={priceClass}>
          <span className="per-monthly">{money(plan.monthly, c, locale)}</span>
          <span className="per-yearly">{money(plan.yearly, c, locale)}</span>
        </span>
        <span className="text-sm text-muted">
          <span className="per-monthly">{t.perMonth}</span>
          <span className="per-yearly">{t.perYear}</span>
        </span>
      </span>
      <span className="mt-2 block text-[13px] text-muted">
        <span className="per-yearly">{t.yearlyNote(perMonth)}</span>
        <span className="per-monthly">{t.monthlyNote(money(plan.yearly, c, locale), savings(c))}</span>
      </span>
    </span>
  );
}

function FeatureList({ items, accent = false }: { items: string[]; accent?: boolean }) {
  return (
    <ul className="mt-6 flex flex-col gap-2.5 border-t border-line pt-6 text-[14px] text-fg-2">
      {items.map((f) => (
        <li key={f} className="flex gap-2.5">
          <Check className={accent ? "mt-[3px] size-4 shrink-0 text-accent" : "mt-[3px] size-4 shrink-0 text-muted"} aria-hidden="true" />
          {f}
        </li>
      ))}
    </ul>
  );
}

export function Pricing({ dict }: { dict: Dictionary }) {
  const t = dict.pricing;
  const locale = dict.numberLocale;
  return (
    <Section id="pricing" labelledBy="pricing-title">
      <PricingShell
        defaultCurrency={dict.locale === "hi" ? "inr" : "usd"}
        heading={<SectionHeading id="pricing-title" title={t.title} description={t.description} />}
        labels={{
          period: t.periodLabel,
          monthly: t.monthly,
          yearly: t.yearly,
          currency: t.currencyLabel,
          savings: { inr: savings("inr"), usd: savings("usd") },
        }}
      >
        <Reveal className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Free */}
          <div className="flex flex-col rounded-xl border border-line bg-panel p-6 sm:p-8">
            <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-fg">{t.free.name}</h3>
            <p className="mt-1 text-[14px] text-muted">{t.free.tagline}</p>
            <p className="mt-6 flex items-baseline gap-2">
              <span className={priceClass}>
                <span className="cur-inr">₹0</span>
                <span className="cur-usd">$0</span>
              </span>
              <span className="text-sm text-muted">{t.free.forever}</span>
            </p>
            <a
              href={`${dict.locale === "en" ? "" : "/hi"}#nvidia-key`}
              className="group mt-6 flex gap-3 rounded-lg border border-line bg-inset p-3.5 transition-colors duration-150 hover:border-line-strong"
            >
              <KeyRound className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-fg">{t.free.aiBanner}</span>
                <span className="mt-0.5 block text-[12.5px] text-muted">{t.free.aiBannerNote}</span>
              </span>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
            <ButtonLink href={installHref("chrome", dict.locale)} variant="secondary" size="lg" className="mt-6 w-full">
              {t.free.cta}
            </ButtonLink>
            <FeatureList items={t.free.features} />
          </div>

          {/* Pro */}
          <div className="flex flex-col rounded-xl border border-accent/40 bg-panel p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-fg">{t.pro.name}</h3>
              <span className="rounded-full bg-accent-soft px-2.5 text-xs font-medium leading-6 text-accent">{t.pro.badge}</span>
            </div>
            <p className="mt-1 text-[14px] text-muted">{t.pro.tagline}</p>
            <p className="mt-6">
              <ProPrice c="inr" t={t} locale={locale} />
              <ProPrice c="usd" t={t} locale={locale} />
            </p>
            <ButtonLink href={PLANS.inr.checkout} size="lg" className="cur-inr mt-6 w-full">
              {t.pro.cta}
            </ButtonLink>
            <ButtonLink href={PLANS.usd.checkout} size="lg" className="cur-usd mt-6 w-full">
              {t.pro.cta}
            </ButtonLink>
            <FeatureList items={t.pro.features} accent />
            <p className="mt-auto pt-6 text-[12.5px] leading-relaxed text-muted">{t.pro.fine}</p>
          </div>
        </Reveal>
      </PricingShell>
    </Section>
  );
}
