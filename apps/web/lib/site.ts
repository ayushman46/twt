import { BRAND } from "@twtdash/shared";

/** Public, build-time configuration (NEXT_PUBLIC_* values are inlined at build). */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || BRAND.website).replace(/\/+$/, "");

export const CHECKOUT_URL = process.env.NEXT_PUBLIC_CHECKOUT_URL?.trim() || "#pricing";

/** Checkout for Indian visitors paying in rupees (falls back to the default checkout). */
export const CHECKOUT_URL_INR = process.env.NEXT_PUBLIC_CHECKOUT_URL_INR?.trim() || CHECKOUT_URL;

export const CHROME_STORE_URL = process.env.NEXT_PUBLIC_CHROME_STORE_URL?.trim() || "";
export const FIREFOX_ADDON_URL = process.env.NEXT_PUBLIC_FIREFOX_ADDON_URL?.trim() || "";

/** Where "Add to Chrome" / "Add to Firefox" CTAs go from anywhere on the site. */
export const CHROME_INSTALL_HREF = CHROME_STORE_URL || "/install#chrome";
export const FIREFOX_INSTALL_HREF = FIREFOX_ADDON_URL || "/install#firefox";

export const DOWNLOADS = {
  chrome: "/downloads/twtdash-chrome.zip",
  firefox: "/downloads/twtdash-firefox.zip",
} as const;

export const SUPPORT_URL = BRAND.supportUrl;
export const SUPPORT_LABEL = BRAND.supportUrl.replace(/^https?:\/\//, "");

export const LEGAL_EFFECTIVE_DATE = "October 23, 2026";

export const BROWSERS = ["Chrome", "Edge", "Brave", "Arc", "Opera", "Firefox"] as const;

export const OG_IMAGE_ALT = "twtdash — Your X bookmarks, finally organized.";

/** Install CTA target for a locale: the store listing when live, else that language's install guide. */
export function installHref(browser: "chrome" | "firefox", locale: "en" | "hi" = "en"): string {
  const store = browser === "chrome" ? CHROME_STORE_URL : FIREFOX_ADDON_URL;
  return store || `${locale === "hi" ? "/hi" : ""}/install#${browser}`;
}
