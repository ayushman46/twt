import Link from "next/link";
import { BRAND } from "@twtdash/shared";
import { BROWSERS, SUPPORT_URL } from "@/lib/site";
import { Wordmark } from "./logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Get started",
    links: [
      { href: "/install", label: "Install" },
      { href: "/install#first-sync", label: "First sync" },
      { href: SUPPORT_URL, label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
] as const;

const linkClass = "text-sm text-zinc-400 transition-colors hover:text-white";

export function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden border-t border-white/[0.07] bg-ink-raised/50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(123_97_255/0.5)_30%,rgb(255_92_157/0.45)_70%,transparent)] opacity-50"
      />
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-8">
        <div className="flex max-w-xs flex-col gap-4">
          <Link href="/" aria-label="twtdash home" className="w-fit rounded-lg">
            <Wordmark id="footer" />
          </Link>
          <p className="text-sm leading-relaxed text-zinc-400">{BRAND.tagline}</p>
          <p className="text-xs leading-relaxed text-zinc-500">Works in {BROWSERS.join(", ").replace(/, (?=[^,]*$)/, " and ")}.</p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{col.title}</h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {col.links.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith("mailto:") ? (
                    <a href={link.href} className={linkClass}>
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

      {/* oversized, fading wordmark */}
      <div aria-hidden="true" className="pointer-events-none select-none overflow-hidden">
        <p className="container-page -mb-[0.16em] text-center text-[20vw] font-semibold leading-[0.85] tracking-[-0.065em] [mask-image:linear-gradient(180deg,#000_20%,transparent_92%)] md:text-[12rem] lg:text-[14rem]">
          <span className="text-white/[0.07]">twt</span>
          <span className="bg-[linear-gradient(135deg,rgb(123_97_255/0.32),rgb(177_76_242/0.26)_55%,rgb(255_92_157/0.22))] bg-clip-text pr-[0.04em] text-transparent">
            dash
          </span>
        </p>
      </div>

      <div className="relative border-t border-white/[0.07]">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {BRAND.name}. All rights reserved.</p>
          <p>twtdash is not affiliated with or endorsed by X Corp.</p>
        </div>
      </div>
    </footer>
  );
}
