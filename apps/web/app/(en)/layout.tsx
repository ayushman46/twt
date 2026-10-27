import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SharedHead, SiteShell } from "@/components/site/site-shell";
import { en } from "@/lib/i18n/en";
import { rootMetadata } from "@/lib/metadata";
import "../globals.css";

/*
 * Root layout for the English site. Hindi pages live under app/hi with their
 * own root layout so each page gets the right <html lang> and only Hindi
 * pages download the Devanagari font.
 */

// `optional` + preload: Geist renders when it arrives in time (and from cache
// after), but a late font never swaps in. With any fallback face the mobile hero
// headline wraps to 4 lines instead of 2, so a late swap shifted the page (CLS ~0.2).
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "optional",
});

// Mono only appears in small UI previews: don't let it compete with critical fonts.
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = rootMetadata(en);

// Dark by default; follows the OS when it asks for light (tokens in globals.css).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0d" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
  ],
  colorScheme: "dark light",
};

export default function EnglishRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} antialiased`}
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
