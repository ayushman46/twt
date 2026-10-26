import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/types";
import type { Locale } from "@/lib/i18n/config";
import { Wordmark } from "./logo";

const linkClass = "text-[13.5px] text-muted transition-colors duration-150 hover:text-fg";

export function SiteFooter({ locale, t, homeAria }: { locale: Locale; t: Dictionary["footer"]; homeAria: string }) {
  return (
    <footer className="border-t border-line">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] md:gap-8">
        <div className="flex max-w-xs flex-col gap-3">
          <Link href={locale === "en" ? "/" : "/hi"} aria-label={homeAria} className="-m-1 w-fit rounded-md p-1">
            <Wordmark />
          </Link>
          <p className="text-[13.5px] leading-relaxed text-muted">{t.tagline}</p>
        </div>
        {t.columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-[13px] font-medium text-fg">{col.title}</h2>
            <ul className="mt-3 flex flex-col gap-2">
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
      <div className="container-page">
        <div className="flex flex-col gap-1.5 border-t border-line py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>{t.rights}</p>
          <p>{t.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
