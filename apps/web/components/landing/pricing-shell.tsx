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

/**
 * Billing period + ₹/$ toggles. Prices are server-rendered for every
 * currency × period; CSS shows the matching ones (`data-period` here,
 * `<html data-currency>` from the head script), so nothing flashes before
 * hydration and the cards ship no client JS.
 */
export function PricingShell({
  defaultCurrency,
  labels,
  children,
}: {
  defaultCurrency: Currency;
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
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <div
          role="group"
          aria-label={labels.period}
          className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] p-1 text-sm shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]"
        >
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
              {p === "monthly" ? labels.monthly : labels.yearly}
              {p === "yearly" ? (
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-px text-[11px] font-semibold",
                    period === p ? "bg-brand-gradient text-white" : "bg-brand/20 text-brand-soft",
                  )}
                >
                  <span className="cur-inr">−{labels.savings.inr}%</span>
                  <span className="cur-usd">−{labels.savings.usd}%</span>
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div
          role="group"
          aria-label={labels.currency}
          className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] p-1 text-sm shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]"
        >
          {(["inr", "usd"] as const).map((c) => (
            <button
              key={c}
              type="button"
              data-cur-btn={c}
              aria-pressed={currency === c}
              onClick={() => setCurrency(c)}
              className="cur-btn inline-flex min-w-[3.25rem] items-center justify-center rounded-full px-3 py-1.5 font-medium text-zinc-400 transition-colors hover:text-white"
            >
              {c === "inr" ? "₹ INR" : "$ USD"}
            </button>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
