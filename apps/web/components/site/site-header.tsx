"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowRight, Menu, Puzzle, X } from "lucide-react";
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
        className="inline-flex h-9 items-center rounded-full border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 hover:text-white"
      >
        <span className="sr-only">{label}: </span>
        {meta.native}
      </a>
    );
  }
  return (
    <div role="group" aria-label={label} className="flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] p-0.5 text-[13px]">
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
              "rounded-full px-2.5 py-1 font-medium transition-colors",
              active ? "bg-white/[0.1] text-white" : "text-zinc-400 hover:text-white",
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
    const onScroll = () => setScrolled(window.scrollY > 8);
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

  const glass = scrolled || open;

  return (
    <header
      className={clsx(
        "sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300",
        glass
          ? "border-white/[0.07] bg-ink/90 shadow-[0_8px_32px_-16px_rgb(0_0_0/0.8)] md:bg-ink/70 md:backdrop-blur-xl md:backdrop-saturate-150"
          : "border-transparent bg-transparent",
      )}
    >
      {/* brand hairline that fades in once the page scrolls */}
      <div
        aria-hidden="true"
        className={clsx(
          "pointer-events-none absolute inset-x-0 -bottom-px h-px bg-[linear-gradient(90deg,transparent,rgb(123_97_255/0.45)_30%,rgb(255_92_157/0.4)_70%,transparent)] transition-opacity duration-300",
          glass ? "opacity-60" : "opacity-0",
        )}
      />
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link href={home} aria-label={t.homeAria} className="rounded-lg">
          <Wordmark id="header" />
        </Link>

        <nav aria-label={t.mainNav} className="hidden md:block">
          <ul className="flex items-center gap-0.5">
            {t.nav.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-full px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-white lg:px-3.5"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          <div className="hidden md:block">
            <LanguageSwitch locale={locale} label={t.language} />
          </div>
          <div className="md:hidden">
            <LanguageSwitch locale={locale} label={t.language} compact />
          </div>
          <Link
            href={t.installGuide.href}
            className="hidden rounded-full px-3.5 py-2 text-sm text-zinc-400 transition-colors hover:text-white xl:inline-flex"
          >
            {t.installGuide.label}
          </Link>
          <div className="hidden sm:block">
            <ButtonLink href={chromeHref} size="sm">
              <Puzzle className="size-4" aria-hidden="true" />
              {t.cta}
            </ButtonLink>
          </div>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t.closeMenu : t.openMenu}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div id="mobile-nav" hidden={!open} className="border-t border-white/[0.07] md:hidden">
        <nav aria-label={t.mobileNav} className="container-page py-4">
          <ul className="flex flex-col gap-1">
            {[...t.nav, t.installGuide].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-xl px-3 py-3 text-base text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  {link.label}
                  <ArrowRight className="size-4 text-zinc-500" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <ButtonLink href={chromeHref} className="mt-4 w-full" onClick={() => setOpen(false)}>
            <Puzzle className="size-4" aria-hidden="true" />
            {t.ctaLong}
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
