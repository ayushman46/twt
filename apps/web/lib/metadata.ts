import type { Metadata } from "next";
import { BRAND } from "@twtdash/shared";
import { OG_IMAGE_ALT } from "./site";

/**
 * Metadata for secondary pages. A page that sets `openGraph`/`twitter`
 * replaces the root layout's objects wholesale, so the shared image and site
 * fields are repeated here.
 */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const fullTitle = `${title} · ${BRAND.name}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      locale: "en_US",
      url: path,
      title: fullTitle,
      description,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: OG_IMAGE_ALT }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [{ url: "/twitter-image", alt: OG_IMAGE_ALT }],
    },
  };
}
