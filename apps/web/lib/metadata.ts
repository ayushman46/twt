import type { Metadata } from "next";
import { BRAND } from "@twtdash/shared";
import { LOCALE_META, LOCALES, languageAlternates, localePath, type Locale } from "./i18n/config";
import type { Dictionary } from "./i18n/types";
import { OG_IMAGE_ALT, SITE_URL } from "./site";

/**
 * The OG and Twitter card images are generated once at the app root
 * (app/opengraph-image.tsx, app/twitter-image.tsx) and are English-only, so
 * every locale points at them. There is no /hi/opengraph-image route.
 */
function ogImages(alt: string) {
  return {
    og: [{ url: "/opengraph-image", width: 1200, height: 630, alt }],
    twitter: [{ url: "/twitter-image", alt }],
  };
}

/** Site-wide metadata for a root layout (one per language). */
export function rootMetadata(dict: Dictionary): Metadata {
  const { locale, meta } = dict;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: meta.title, template: meta.titleTemplate },
    description: meta.description,
    applicationName: BRAND.name,
    keywords: meta.keywords,
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      title: meta.title,
      description: meta.description,
      url: localePath(locale, "/"),
      locale: LOCALE_META[locale].ogLocale,
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => LOCALE_META[l].ogLocale),
    },
    twitter: { card: "summary_large_image", title: meta.title, description: meta.description },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

/** Home page metadata: canonical + hreflang alternates. */
export function homeMetadata(dict: Dictionary): Metadata {
  const images = ogImages(dict.meta.ogAlt);
  return {
    alternates: { canonical: localePath(dict.locale, "/"), languages: languageAlternates("/") },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      title: dict.meta.title,
      description: dict.meta.description,
      url: localePath(dict.locale, "/"),
      locale: LOCALE_META[dict.locale].ogLocale,
      images: images.og,
    },
    twitter: { card: "summary_large_image", title: dict.meta.title, description: dict.meta.description, images: images.twitter },
  };
}

/**
 * Metadata for secondary pages. A page that sets `openGraph`/`twitter`
 * replaces the root layout's objects wholesale, so the shared image and site
 * fields are repeated here. Pass `translated` for pages that also exist in
 * the other language so hreflang alternates are emitted.
 */
export function pageMetadata({
  title,
  description,
  path,
  locale = "en",
  translated,
  ogAlt = OG_IMAGE_ALT,
}: {
  title: string;
  description: string;
  path: string;
  locale?: Locale;
  translated?: "/install";
  ogAlt?: string;
}): Metadata {
  const fullTitle = `${title} · ${BRAND.name}`;
  const url = localePath(locale, path);
  const images = ogImages(ogAlt);
  return {
    title,
    description,
    alternates: { canonical: url, ...(translated ? { languages: languageAlternates(translated) } : {}) },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      locale: LOCALE_META[locale].ogLocale,
      url,
      title: fullTitle,
      description,
      images: images.og,
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: images.twitter },
  };
}
