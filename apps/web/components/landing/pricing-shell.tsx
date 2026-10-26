"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import clsx from "clsx";
import { CURRENCY_EVENT, CURRENCY_STORAGE_KEY } from "@/lib/currency";

type Period = "monthly" | "yearly";
type Currency = "inr" | "usd";

function subscribe(onChange: () => void) {
  window.addEventListener(CURRENCY_EVENT, onChange);
  return () => window.removeEventListener(CURRENCY_EVENT, onChange);
}

function readCurrency(): Currency {
  return document.documentElement.getAttribute("data-currency") === "inr" ? "inr" : "usd";
}

function setCurrency(c: Currency) {
  document.documentElement.setAttribute("data-currency", c);
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, c);
  } catch {
    // Private mode: the choice just isn't remembered.
  }
  window.dispatchEvent(new Event(CURRENCY_EVENT));
}

const group = "inline-flex h-9 items-center rounded-lg border border-line bg-panel p-0.5 text-[13px]";
const segment =
  "inline-flex h-full items-center justify-center gap-2 rounded-md px-3 font-medium transition-colors duration-150 active:scale-[0.98]";

/**
 * Billing period + ₹/$ toggles. Prices are server-rendered for every
 * currency × period; CSS shows the matching ones (`data-period` here,
 * `<html data-currency>` from the head script), so nothing flashes before
 * hydration and the cards ship no client JS.
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
  const [period, setPeriod] = useState<Period>("yearly");
  const currency = useSyncExternalStore(subscribe, readCurrency, () => defaultCurrency);

  return (
    <div data-period={period}>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        {heading}
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={labels.period} className={group}>
            {(["monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
                className={clsx(segment, period === p ? "bg-panel-3 text-fg" : "text-muted hover:text-fg")}
              >
                {p === "monthly" ? labels.monthly : labels.yearly}
                {p === "yearly" ? (
                  <span className="rounded bg-accent-soft px-1 text-[11px] font-medium leading-[18px] text-accent tabular-nums">
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
                onClick={() => setCurrency(c)}
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
