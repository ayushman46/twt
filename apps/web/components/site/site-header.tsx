"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowRight, Menu, Puzzle, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { CHROME_INSTALL_HREF } from "@/lib/site";
import { Wordmark } from "./logo";

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

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
        "sticky top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter,box-shadow] duration-300",
        glass
          ? "border-white/[0.07] bg-ink/70 shadow-[0_8px_32px_-16px_rgb(0_0_0/0.8)] backdrop-blur-xl backdrop-saturate-150"
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
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="twtdash home" className="rounded-lg">
          <Wordmark id="header" />
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-0.5">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-full px-3.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/install"
            className="hidden rounded-full px-3.5 py-2 text-sm text-zinc-400 transition-colors hover:text-white lg:inline-flex"
          >
            Install guide
          </Link>
          <div className="hidden sm:block">
            <ButtonLink href={CHROME_INSTALL_HREF} size="sm">
              <Puzzle className="size-4" aria-hidden="true" />
              Add to Chrome
            </ButtonLink>
          </div>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div id="mobile-nav" hidden={!open} className="border-t border-white/[0.07] md:hidden">
        <nav aria-label="Mobile" className="container-page py-4">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-xl px-3 py-3 text-base text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  {link.label}
                  <ArrowRight className="size-4 text-zinc-600" aria-hidden="true" />
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/install"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-xl px-3 py-3 text-base text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white"
              >
                Install guide
                <ArrowRight className="size-4 text-zinc-600" aria-hidden="true" />
              </Link>
            </li>
          </ul>
          <ButtonLink href={CHROME_INSTALL_HREF} className="mt-4 w-full" onClick={() => setOpen(false)}>
            <Puzzle className="size-4" aria-hidden="true" />
            Add to Chrome — it&apos;s free
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
