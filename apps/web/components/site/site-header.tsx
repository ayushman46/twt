"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Menu, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { LOCALE_META, LOCALES, switchLocaleHref, type Locale } from "@/lib/i18n/config";
import type { HeaderCopy } from "@/lib/i18n/types";
import { Wordmark } from "./logo";

/**
 * English ↔ हिन्दी switch. Each language has its own root layout, so this is a
 * plain link (a full page load) rather than a client-side navigation.
 */
function LanguageSwitch({ locale, label, compact = false }: { locale: Locale; label: string; compact?: boolean }) {
  const pathname = usePathname() ?? "/";
  if (compact) {
    const other: Locale = locale === "en" ? "hi" : "en";
    const meta = LOCALE_META[other];
    return (
      <a
        href={switchLocaleHref(pathname, other)}
        hrefLang={meta.htmlLang}
        lang={meta.htmlLang}
        className="inline-flex h-8 items-center rounded-lg border border-line px-2.5 text-[13px] font-medium text-fg-2 transition-colors duration-150 hover:bg-panel-2 hover:text-fg"
      >
        <span className="sr-only">{label}: </span>
        {meta.native}
      </a>
    );
  }
  return (
    <div role="group" aria-label={label} className="flex h-8 items-center rounded-lg border border-line p-0.5 text-[13px]">
      {LOCALES.map((l) => {
        const meta = LOCALE_META[l];
        const active = l === locale;
        return (
          <a
            key={l}
            href={switchLocaleHref(pathname, l)}
            hrefLang={meta.htmlLang}
            lang={meta.htmlLang}
            aria-current={active ? "true" : undefined}
            className={clsx(
              "flex h-full items-center rounded-md px-2 font-medium transition-colors duration-150",
              active ? "bg-panel-3 text-fg" : "text-muted hover:text-fg",
            )}
          >
            {meta.native}
          </a>
        );
      })}
    </div>
  );
}

export function SiteHeader({ locale, t, chromeHref }: { locale: Locale; t: HeaderCopy; chromeHref: string }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const home = locale === "en" ? "/" : "/hi";

  // Close the mobile menu after navigating to another page.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onResize = () => {
      if (window.matchMedia("(min-width: 768px)").matches) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const solid = scrolled || open;

  return (
    <header
      className={clsx(
        "sticky top-0 z-50 border-b bg-bg transition-[border-color] duration-200",
        solid ? "border-line" : "border-transparent",
      )}
    >
      <div className="container-page flex h-14 items-center justify-between gap-3">
        <div className="flex items-center gap-8">
          <Link href={home} aria-label={t.homeAria} className="-m-1 rounded-md p-1">
            <Wordmark />
          </Link>
          <nav aria-label={t.mainNav} className="hidden md:block">
            <ul className="flex items-center gap-1">
              {t.nav.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex h-8 items-center rounded-md px-2.5 text-[13.5px] text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-fg"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="hidden lg:block">
                <Link
                  href={t.installGuide.href}
                  aria-current={pathname === t.installGuide.href ? "page" : undefined}
                  className="inline-flex h-8 items-center rounded-md px-2.5 text-[13.5px] text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-fg aria-[current=page]:text-fg"
                >
                  {t.installGuide.label}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <LanguageSwitch locale={locale} label={t.language} />
          </div>
          <div className="md:hidden">
            <LanguageSwitch locale={locale} label={t.language} compact />
          </div>
          {/* Phones can't install extensions: the header CTA starts at sm. */}
          <div className="hidden sm:block">
            <ButtonLink href={chromeHref} size="sm">
              {t.cta}
            </ButtonLink>
          </div>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-lg text-fg-2 transition-colors duration-150 hover:bg-panel-2 hover:text-fg md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t.closeMenu : t.openMenu}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-[18px]" aria-hidden="true" /> : <Menu className="size-[18px]" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div id="mobile-nav" hidden={!open} className="border-t border-line bg-bg md:hidden">
        <nav aria-label={t.mobileNav} className="container-page py-3">
          <ul className="flex flex-col">
            {[...t.nav, t.installGuide].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className="flex min-h-11 items-center rounded-lg px-2 text-[15px] text-fg-2 transition-colors duration-150 hover:bg-panel-2 hover:text-fg aria-[current=page]:bg-panel-2 aria-[current=page]:text-fg"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <ButtonLink href={chromeHref} size="lg" className="mt-3 w-full" onClick={() => setOpen(false)}>
            {t.ctaLong}
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
