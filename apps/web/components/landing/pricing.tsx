"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, Puzzle, Sparkles } from "lucide-react";
import { DEFAULT_CATEGORIES, PRICING } from "@twtdash/shared";
import { ButtonLink } from "@/components/ui/button-link";
import { Reveal } from "@/components/ui/reveal";
import { Accent, SectionHeading } from "@/components/ui/section-heading";
import { CHECKOUT_URL, CHROME_INSTALL_HREF } from "@/lib/site";

type Period = "monthly" | "yearly";

const FREE_FEATURES = [
  "One-click sync, quick & full",
  "Real-time capture as you bookmark",
  "Likes import & X Premium folders",
  `${DEFAULT_CATEGORIES.length} smart categories + custom categories`,
  "Instant search with operators",
  "Masonry, list, table & media views",
  "Collections, tags, notes & bulk actions",
  "Insights dashboard",
  "Export JSON / CSV / Markdown",
  "AI with your own free NVIDIA key",
] as const;

const PRO_FEATURES = [
  "Everything in Free",
  "Hosted AI categorization — no API key",
  "AI auto-tagging",
  "One-line AI gists on longer posts",
  "Priority support",
  "Early access to new features",
] as const;

const yearlySavings = Math.round((1 - PRICING.pro.yearly / (PRICING.pro.monthly * 12)) * 100);

export function Pricing() {
  const [period, setPeriod] = useState<Period>("yearly");
  const price = period === "monthly" ? PRICING.pro.monthly : PRICING.pro.yearly;
  const perMonth = PRICING.pro.yearly / 12;

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="relative scroll-mt-20 py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute bottom-0 left-1/2 h-[30rem] w-[min(60rem,130vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(123_97_255/0.12),rgb(255_92_157/0.04)_60%,transparent)]" />
      </div>
      <div className="container-page">
        <SectionHeading
          id="pricing-title"
          eyebrow="Pricing"
          title={
            <>
              Free forever. <Accent gradient>Pro</Accent> if you want AI on autopilot.
            </>
          }
          description="Everything that makes twtdash great is free. Pro adds hosted AI so you never have to manage an API key."
        />

        <Reveal className="mt-10 flex justify-center">
          <div role="group" aria-label="Billing period" className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] p-1 text-sm shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]">
            {(["monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-medium transition-colors",
                  period === p ? "bg-white text-ink" : "text-zinc-400 hover:text-white",
                )}
              >
                {p === "monthly" ? "Monthly" : "Yearly"}
                {p === "yearly" ? (
                  <span
                    className={clsx(
                      "rounded-full px-1.5 py-px text-[11px] font-semibold",
                      period === p ? "bg-brand-gradient text-white" : "bg-brand/20 text-brand-soft",
                    )}
                  >
                    −{yearlySavings}%
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
          <Reveal className="panel flex flex-col bg-ink-raised/80 p-7 sm:p-8">
            <h3 className="text-lg font-semibold text-white">Free</h3>
            <p className="mt-1 text-sm text-zinc-400">For everyone who bookmarks on X.</p>
            <p className="mt-6 flex items-baseline gap-2">
              <span className="text-5xl font-semibold tracking-[-0.04em] text-white">$0</span>
              <span className="text-sm text-zinc-500">forever</span>
            </p>
            <ButtonLink href={CHROME_INSTALL_HREF} variant="secondary" className="mt-7 w-full">
              <Puzzle className="size-4" aria-hidden="true" />
              Add to Chrome — it&apos;s free
            </ButtonLink>
            <ul className="mt-8 flex flex-col gap-3 text-sm text-zinc-300">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden="true" />
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
                Pro
                <span className="icon-tile-brand flex size-6 items-center justify-center rounded-md">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                </span>
              </h3>
              <span className="rounded-full border border-white/10 bg-white/[0.08] px-2.5 py-1 text-xs font-medium text-zinc-100">No API key needed</span>
            </div>
            <p className="mt-1 text-sm text-zinc-400">Hosted AI, zero setup.</p>
            <p className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1" aria-live="polite">
              <span className="text-5xl font-semibold tracking-[-0.04em] text-white">${price}</span>
              <span className="text-sm text-zinc-400">{period === "monthly" ? "/ month" : "/ year"}</span>
              <span className="w-full text-xs text-zinc-500">
                {period === "yearly"
                  ? `That's $${perMonth.toFixed(perMonth % 1 === 0 ? 0 : 2)}/month, billed yearly`
                  : `Or $${PRICING.pro.yearly}/year — save ${yearlySavings}%`}
              </span>
            </p>
            <ButtonLink href={CHECKOUT_URL} className="mt-7 w-full">
              Get twtdash Pro
            </ButtonLink>
            <ul className="mt-8 flex flex-col gap-3 text-sm text-zinc-200">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex gap-3">
                  <span aria-hidden="true" className="bg-brand-gradient mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full">
                    <Check className="size-2.5 text-white" strokeWidth={3.5} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-8 border-t border-white/10 pt-5 text-xs leading-relaxed text-zinc-500">
              Your license key arrives by email — paste it into twtdash to unlock Pro. Cancel anytime; refunds within 14
              days.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
