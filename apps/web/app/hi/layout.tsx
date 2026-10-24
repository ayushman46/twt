import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Devanagari } from "next/font/google";
import { SharedHead, SiteShell } from "@/components/site/site-shell";
import { hi } from "@/lib/i18n/hi";
import { rootMetadata } from "@/lib/metadata";
import "../globals.css";

/*
 * Root layout for the Hindi site (/hi, /hi/install): <html lang="hi"> and the
 * Devanagari font. Latin words (brand, tech terms) still render in Geist.
 */

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

// One variable woff2 covers every weight. It is Android's own system
// Devanagari face, so on most Indian phones the swap is invisible.
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-deva",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = rootMetadata(hi);

export const viewport: Viewport = {
  themeColor: "#08080C",
  colorScheme: "dark",
};

export default function HindiRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="hi"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geist.variable} ${devanagari.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <SharedHead />
      </head>
      <body className="flex min-h-dvh flex-col">
        <SiteShell dict={hi}>{children}</SiteShell>
      </body>
    </html>
  );
}
