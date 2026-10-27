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

// Same loading as the English layout: no late swap that re-wraps the hero (CLS).
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "optional",
});

// One variable woff2 covers every weight. It is Android's own system
// Devanagari face, so most Indian phones show the same glyphs before it loads.
// Not preloaded: the bundler shares font CSS between both root layouts, so a
// preload here was sent from every English page too (121 KB they never use).
// `optional`: a late arrival is used from the next page view instead of
// swapping in mid-read, which shifted the Hindi headline (CLS).
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-deva",
  display: "optional",
  preload: false,
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = rootMetadata(hi);

// Dark by default; follows the OS when it asks for light (tokens in globals.css).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0d" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
  ],
  colorScheme: "dark light",
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
