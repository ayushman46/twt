import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { SharedHead, SiteShell } from "@/components/site/site-shell";
import { en } from "@/lib/i18n/en";
import { rootMetadata } from "@/lib/metadata";
import "../globals.css";

/*
 * Root layout for the English site. Hindi pages live under app/hi with their
 * own root layout so each page gets the right <html lang> and only Hindi
 * pages download the Devanagari font.
 */

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

// Only the italic is used (editorial accents in headings).
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-instrument",
  display: "swap",
});

// Mono only appears in small UI previews: don't let it compete with critical fonts.
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = rootMetadata(en);

export const viewport: Viewport = {
  themeColor: "#08080C",
  colorScheme: "dark",
};

export default function EnglishRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geist.variable} ${instrumentSerif.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <SharedHead />
      </head>
      <body className="flex min-h-dvh flex-col">
        <SiteShell dict={en}>{children}</SiteShell>
      </body>
    </html>
  );
}
