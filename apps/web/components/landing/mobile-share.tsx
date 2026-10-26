"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Link2, MessageCircle } from "lucide-react";
import { buttonClasses } from "@/components/ui/button-link";
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
    <div className="mt-8 rounded-xl border border-line bg-panel p-4 md:hidden">
      <p className="text-sm leading-snug text-fg-2">{t.text}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${t.shareText} ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses({ variant: "secondary", size: "md", className: "px-3" })}
        >
          <MessageCircle aria-hidden="true" className="text-muted" />
          {t.whatsapp}
        </a>
        <button type="button" onClick={copy} className={buttonClasses({ variant: "secondary", size: "md", className: "px-3" })}>
          {copied ? <Check aria-hidden="true" className="text-good" /> : <Link2 aria-hidden="true" className="text-muted" />}
          {copied ? t.copied : t.copy}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? t.copied : ""}
      </span>
    </div>
  );
}
