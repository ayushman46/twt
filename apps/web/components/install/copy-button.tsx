"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, Copy } from "lucide-react";

/** Inline code snippet with a copy-to-clipboard button (browsers block links to chrome:// and about: pages). */
export function CopyCode({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be denied; the value is still selectable.
    }
  }

  return (
    <span
      lang="en"
      className={clsx(
        "inline-flex max-w-full items-center gap-1 rounded-lg border border-line bg-inset py-0.5 pl-3 pr-0.5 align-middle font-mono text-[13px] text-fg",
        className,
      )}
    >
      <code className="min-w-0 select-all break-all">{value}</code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-fg active:scale-95"
        aria-label={copied ? `Copied ${value}` : `Copy ${value}`}
      >
        {copied ? <Check className="size-3.5 text-good" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </span>
  );
}
