import type { ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n/types";
import { installHref } from "@/lib/site";
import { HEAD_SCRIPT } from "@/lib/head-script";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** <head> additions shared by both root layouts (must render inside <head>). */
export function SharedHead() {
  return <script dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />;
}

/** Everything inside <body> that both root layouts (English and हिन्दी) share. */
export function SiteShell({ dict, children }: { dict: Dictionary; children: ReactNode }) {
  // The header is a client component: hand it only its own strings.
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink"
      >
        {dict.shell.skipToContent}
      </a>
      <SiteHeader locale={dict.locale} t={dict.header} chromeHref={installHref("chrome", dict.locale)} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter locale={dict.locale} t={dict.footer} homeAria={dict.header.homeAria} />
      <div aria-hidden="true" className="noise-overlay" />
    </>
  );
}
