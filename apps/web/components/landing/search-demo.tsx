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
    const id = setTimeout(() => setTyped((n) => (n === null ? null : n + 1)), 24);
    return () => clearTimeout(id);
  }, [typed, full.length]);

  function select(i: number) {
    setActive(i);
    setTyped(prefersReducedMotion() ? null : 0);
  }

  // Render tokens, clipped to the number of characters "typed" so far.
  // Each token starts after the previous tokens plus one separating space.
  const offsets = example.tokens.map((_, i) => example.tokens.slice(0, i).reduce((n, t) => n + tokenText(t).length + 1, 0));
  const rendered = example.tokens.map((t, i) => {
    const text = tokenText(t);
    const take = Math.max(0, Math.min(text.length, visible - offsets[i]!));
    if (take <= 0 && i > 0) return null;
    const shown = text.slice(0, take);
    if (t.negate) {
      return (
        <span key={i} className={clsx(i > 0 && "ml-2", "text-fg")}>
          {shown}
        </span>
      );
    }
    const keyPart = shown.slice(0, (t.key?.length ?? 0) + 1);
    const valuePart = shown.slice(keyPart.length);
    return (
      <span key={i} className={clsx(i > 0 && "ml-2")}>
        <span className="text-muted">{keyPart}</span>
        <span className="text-fg">{valuePart}</span>
      </span>
    );
  });

  return (
    <div className="rounded-xl border border-line bg-panel p-4 sm:p-5">
      <div role="group" aria-label={t.label} className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={i === active}
            onClick={() => select(i)}
            className={clsx(
              "inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium transition-colors duration-150 active:scale-[0.98]",
              i === active ? "bg-panel-3 text-fg" : "text-muted hover:bg-panel-2 hover:text-fg",
            )}
          >
            {t.examples[i]?.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex h-11 items-center gap-2.5 rounded-lg border border-accent bg-bg px-3.5">
        <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <div lang="en" className="flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap font-mono text-[13px]" aria-live="polite">
          <span className="sr-only">{full}</span>
          <span aria-hidden="true" className="flex items-center">
            {rendered}
            <span className="ml-0.5 inline-block h-4 w-px bg-fg" />
          </span>
        </div>
        <span className="kbd hidden sm:inline-flex">⌘K</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 px-0.5 text-[13px] text-muted">
        <span className="truncate">{t.examples[active]?.caption}</span>
        <span className="shrink-0 tabular-nums">
          {example.results} {t.results}
        </span>
      </div>
    </div>
  );
}
