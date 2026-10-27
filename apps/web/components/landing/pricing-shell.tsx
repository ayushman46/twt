"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import clsx from "clsx";
import { CURRENCY_EVENT, CURRENCY_STORAGE_KEY, PERIOD_EVENT, PERIOD_STORAGE_KEY } from "@/lib/currency";

type Period = "monthly" | "yearly";
type Currency = "inr" | "usd";

/** A pricing preference stored on <html data-*> (set before paint by lib/head-script.ts) and in localStorage. */
function htmlPreference<T extends string>(attribute: string, storageKey: string, event: string, read: (value: string | null) => T) {
  return {
    subscribe(onChange: () => void) {
      window.addEventListener(event, onChange);
      return () => window.removeEventListener(event, onChange);
    },
    get: () => read(document.documentElement.getAttribute(attribute)),
    set(value: T) {
      document.documentElement.setAttribute(attribute, value);
      try {
        localStorage.setItem(storageKey, value);
      } catch {
        // Private mode: the choice just isn't remembered.
      }
      window.dispatchEvent(new Event(event));
    },
  };
}

const currencyPref = htmlPreference<Currency>("data-currency", CURRENCY_STORAGE_KEY, CURRENCY_EVENT, (v) => (v === "inr" ? "inr" : "usd"));
const periodPref = htmlPreference<Period>("data-period", PERIOD_STORAGE_KEY, PERIOD_EVENT, (v) => (v === "monthly" ? "monthly" : "yearly"));

const group = "inline-flex h-9 items-center rounded-lg border border-line bg-panel p-0.5 text-[13px]";
const segment =
  "inline-flex h-full items-center justify-center gap-2 rounded-md px-3 font-medium transition-colors duration-150 active:scale-[0.98]";

/**
 * Billing period + ₹/$ toggles. Prices are server-rendered for every
 * currency × period; CSS shows the matching ones from `<html data-currency>`
 * and `<html data-period>` (both set by the head script, both remembered), so
 * nothing flashes before hydration and the cards ship no client JS.
 */
export function PricingShell({
  defaultCurrency,
  heading,
  labels,
  children,
}: {
  defaultCurrency: Currency;
  heading: ReactNode;
  labels: {
    period: string;
    monthly: string;
    yearly: string;
    currency: string;
    savings: { inr: number; usd: number };
  };
  children: ReactNode;
}) {
  const period = useSyncExternalStore(periodPref.subscribe, periodPref.get, () => "yearly" as const);
  const currency = useSyncExternalStore(currencyPref.subscribe, currencyPref.get, () => defaultCurrency);

  return (
    <div>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        {heading}
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={labels.period} className={group}>
            {(["monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                type="button"
                data-period-btn={p}
                aria-pressed={period === p}
                onClick={() => periodPref.set(p)}
                className={clsx(segment, "period-btn text-muted hover:text-fg")}
              >
                {p === "monthly" ? labels.monthly : labels.yearly}
                {p === "yearly" ? (
                  // The deeper accent shade keeps 11px text above 4.5:1 on the selected (panel-3) segment in both themes.
                  <span className="rounded bg-accent-soft px-1 text-[11px] font-medium leading-[18px] text-accent-hover tabular-nums">
                    <span className="cur-inr">−{labels.savings.inr}%</span>
                    <span className="cur-usd">−{labels.savings.usd}%</span>
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div role="group" aria-label={labels.currency} className={group}>
            {(["inr", "usd"] as const).map((c) => (
              <button
                key={c}
                type="button"
                data-cur-btn={c}
                aria-pressed={currency === c}
                onClick={() => currencyPref.set(c)}
                className={clsx(segment, "cur-btn min-w-[4rem] text-muted hover:text-fg")}
              >
                {c === "inr" ? "₹ INR" : "$ USD"}
              </button>
            ))}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
