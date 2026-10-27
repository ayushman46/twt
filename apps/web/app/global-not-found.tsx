import type { Metadata, Viewport } from "next";
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

// Same loading as the root layouts (see app/(en)/layout.tsx): no late font swap.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "optional" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Page not found · twtdash",
  description: "The page you’re looking for doesn’t exist or has moved.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0d" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
  ],
  colorScheme: "dark light",
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${geist.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <header className="border-b border-line">
          <div className="container-page flex h-14 items-center">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- outside both root layouts: a full page load is intended */}
            <a href="/" aria-label="twtdash home" className="-m-1 rounded-md p-1">
              <Wordmark />
            </a>
          </div>
        </header>
        <main id="main" className="flex-1">
          <div className="container-page flex min-h-[60vh] flex-col items-start justify-center py-24">
            <p className="font-mono text-[13px] text-muted">404</p>
            <h1 className="mt-3 text-balance text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.035em] text-fg sm:text-[3rem]">
              This page doesn’t exist
            </h1>
            <p className="mt-4 max-w-md text-[17px] text-muted">The page you’re looking for doesn’t exist or has moved.</p>
            <p lang="hi" className="mt-1 max-w-md text-[17px] text-muted">
              यह page मौजूद नहीं है या कहीं और चला गया है।
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- outside both root layouts: a full page load is intended */}
              <a href="/" className={buttonClasses({ size: "lg" })}>
                <ArrowLeft aria-hidden="true" />
                Back to home
              </a>
              <a href="/hi" hrefLang="hi" lang="hi" className={buttonClasses({ variant: "secondary", size: "lg" })}>
                हिन्दी होम पर जाएँ
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
