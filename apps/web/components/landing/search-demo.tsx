"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Search } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/types";

type Token = { key?: string; value: string; negate?: boolean };

/** Queries and result counts; labels and captions come from the dictionary (same order). */
const EXAMPLES: Array<{ tokens: Token[]; results: number }> = [
  { tokens: [{ key: "from", value: "mayabuilds" }, { key: "has", value: "link" }], results: 14 },
  { tokens: [{ key: "cat", value: "ai" }, { key: "tag", value: "prompting" }, { key: "min_likes", value: "500" }], results: 37 },
  { tokens: [{ key: "is", value: "thread" }, { key: "after", value: "2025-01-01" }, { value: "crypto", negate: true }], results: 92 },
  { tokens: [{ key: "lang", value: "hi" }, { key: "has", value: "video" }], results: 21 },
];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function tokenText(t: Token) {
  return t.negate ? `-${t.value}` : `${t.key}:${t.value}`;
}

export function SearchDemo({ t }: { t: Dictionary["search"]["demo"] }) {
  const [active, setActive] = useState(0);
  const [typed, setTyped] = useState<number | null>(null);

  const example = EXAMPLES[active]!;
  const full = example.tokens.map(tokenText).join(" ");
  const visible = typed ?? full.length;

  useEffect(() => {
    if (typed === null) return;
    if (typed >= full.length) {
      const done = setTimeout(() => setTyped(null), 0);
      return () => clearTimeout(done);
    }
    const id = setTimeout(() => setTyped((n) => (n === null ? null : n + 1)), 28);
    return () => clearTimeout(id);
  }, [typed, full.length]);

  function select(i: number) {
    setActive(i);
    setTyped(prefersReducedMotion() ? null : 0);
  }

  // Render tokens, clipped to the number of characters "typed" so far.
  // Each token starts after the previous tokens plus one separating space.
  const offsets = example.tokens.map((_, i) =>
    example.tokens.slice(0, i).reduce((n, t) => n + tokenText(t).length + 1, 0),
  );
  const rendered = example.tokens.map((t, i) => {
    const text = tokenText(t);
    const take = Math.max(0, Math.min(text.length, visible - offsets[i]!));
    if (take <= 0 && i > 0) return null;
    const shown = text.slice(0, take);
    if (t.negate) {
      return (
        <span key={i} className={clsx(i > 0 && "ml-1.5", "rounded bg-rose-400/10 px-1 text-rose-300")}>
          {shown}
        </span>
      );
    }
    const keyPart = shown.slice(0, (t.key?.length ?? 0) + 1);
    const valuePart = shown.slice(keyPart.length);
    return (
      <span key={i} className={clsx(i > 0 && "ml-1.5", "rounded bg-white/[0.06] px-1")}>
        <span className="text-brand-soft">{keyPart}</span>
        <span className="text-accent">{valuePart}</span>
      </span>
    );
  });

  return (
    <div className="panel p-4 sm:p-5">
      <div role="group" aria-label={t.label} className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={i === active}
            onClick={() => select(i)}
            className={clsx(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              i === active ? "bg-white text-ink" : "bg-white/[0.05] text-zinc-400 hover:bg-white/[0.09] hover:text-zinc-200",
            )}
          >
            {t.examples[i]?.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex h-12 items-center gap-2.5 rounded-xl border border-brand/35 bg-black/30 px-3.5 shadow-[0_0_0_4px_rgb(139_109_255/0.12),0_0_32px_-8px_rgb(177_76_242/0.45)]">
        <Search className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
        <div lang="en" className="flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap font-mono text-[13px]" aria-live="polite">
          <span className="sr-only">{full}</span>
          <span aria-hidden="true" className="flex items-center">
            {rendered}
            <span className="ml-0.5 inline-block h-4 w-px animate-blink bg-brand-soft" />
          </span>
        </div>
        <span className="kbd hidden sm:inline-flex">⌘K</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 px-1 text-xs text-zinc-500">
        <span className="truncate">{t.examples[active]?.caption}</span>
        <span className="shrink-0 tabular-nums">
          {example.results} {t.results}
        </span>
      </div>
    </div>
  );
}
