"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Link2, MessageCircle } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/types";
import { SITE_URL } from "@/lib/site";

/**
 * Phones can't run the extension, so mobile visitors (a big share of Indian
 * traffic) get a quick way to send the link to their laptop instead.
 * Hidden from md up.
 */
export function MobileShare({ t }: { t: Dictionary["hero"]["mobile"] }) {
  const [copied, setCopied] = useState(false);
  const pathname = usePathname();
  const url = `${SITE_URL}${pathname && pathname !== "/" ? pathname : ""}`;

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the WhatsApp link still works.
    }
  }

  return (
    <div className="mt-5 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 text-left md:hidden">
      <p className="text-[13px] leading-snug text-zinc-300">{t.text}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${t.shareText} ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#1f7a4d] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#23905a]"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          {t.whatsapp}
        </a>
        <button
          type="button"
          onClick={copy}
          className="btn-secondary inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium"
        >
          {copied ? <Check className="size-4 text-emerald-400" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
          {copied ? t.copied : t.copy}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? t.copied : ""}
      </span>
    </div>
  );
}
