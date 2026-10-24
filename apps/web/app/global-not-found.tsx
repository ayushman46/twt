import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/site/logo";
import { buttonClasses } from "@/components/ui/button-link";
import { HEAD_SCRIPT } from "@/lib/head-script";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

/*
 * The site has two root layouts (English and हिन्दी), so unmatched URLs get
 * this standalone 404 (experimental.globalNotFound in next.config.ts).
 */

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Page not found · twtdash",
  description: "The page you’re looking for doesn’t exist or has moved.",
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${geist.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <header className="container-page flex h-16 items-center">
          <a href="/" aria-label="twtdash home" className="rounded-lg">
            <Wordmark id="404" />
          </a>
        </header>
        <main id="main" className="relative isolate flex-1">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] overflow-hidden">
            <div className="bg-grid absolute inset-0" />
            <div className="absolute left-1/2 top-[-14rem] h-[28rem] w-[min(52rem,130vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(123_97_255/0.2),rgb(255_92_157/0.05)_60%,transparent)]" />
          </div>
          <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
            <p className="text-brand-gradient font-mono text-sm font-medium">404</p>
            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
              This page got <span className="text-brand-gradient pr-[0.08em]">un-bookmarked</span>
            </h1>
            <p className="mt-4 max-w-md text-zinc-400">The page you’re looking for doesn’t exist or has moved.</p>
            <p lang="hi" className="mt-1 max-w-md text-zinc-400">
              यह page मौजूद नहीं है या कहीं और चला गया है।
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <a href="/" className={buttonClasses()}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to home
              </a>
              <a href="/hi" hrefLang="hi" lang="hi" className={buttonClasses({ variant: "secondary" })}>
                हिन्दी होम पर जाएँ
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
