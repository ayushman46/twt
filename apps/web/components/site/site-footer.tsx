import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/types";
import type { Locale } from "@/lib/i18n/config";
import { Wordmark } from "./logo";

const linkClass = "text-sm text-zinc-400 transition-colors hover:text-white";

export function SiteFooter({ locale, t, homeAria }: { locale: Locale; t: Dictionary["footer"]; homeAria: string }) {
  return (
    <footer className="relative isolate overflow-hidden border-t border-white/[0.07] bg-ink-raised/50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(123_97_255/0.5)_30%,rgb(255_92_157/0.45)_70%,transparent)] opacity-50"
      />
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-8">
        <div className="flex max-w-xs flex-col gap-4">
          <Link href={locale === "en" ? "/" : "/hi"} aria-label={homeAria} className="w-fit rounded-lg">
            <Wordmark id="footer" />
          </Link>
          <p className="text-sm leading-relaxed text-zinc-400">{t.tagline}</p>
          <p className="text-xs leading-relaxed text-zinc-500">{t.worksIn}</p>
        </div>
        {t.columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{col.title}</h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {col.links.map((link) => (
                <li key={link.href}>
                  {/^https?:/.test(link.href) || link.hrefLang ? (
                    // Other-language pages live under a different root layout: use a plain link.
                    <a href={link.href} hrefLang={link.hrefLang} lang={link.hrefLang} className={linkClass}>
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* oversized, fading wordmark (SVG so it stays decorative) */}
      <div aria-hidden="true" className="pointer-events-none select-none overflow-hidden">
        <div className="container-page -mb-[1.5%] [mask-image:linear-gradient(180deg,#000_20%,transparent_92%)]">
          <svg viewBox="0 0 1000 190" className="mx-auto block w-full max-w-5xl" focusable="false">
            <defs>
              <linearGradient id="footer-dash" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="rgb(123 97 255)" stopOpacity="0.36" />
                <stop offset="0.55" stopColor="rgb(177 76 242)" stopOpacity="0.3" />
                <stop offset="1" stopColor="rgb(255 92 157)" stopOpacity="0.26" />
              </linearGradient>
            </defs>
            <text
              x="500"
              y="182"
              textAnchor="middle"
              fontSize="236"
              fontWeight="600"
              letterSpacing="-15"
              style={{ fontFamily: "var(--font-geist), ui-sans-serif, system-ui, sans-serif" }}
            >
              <tspan fill="rgb(255 255 255 / 0.07)">twt</tspan>
              <tspan fill="url(#footer-dash)">dash</tspan>
            </text>
          </svg>
        </div>
      </div>

      <div className="relative border-t border-white/[0.07]">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{t.rights}</p>
          <p>{t.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
