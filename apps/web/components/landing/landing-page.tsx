import { BRAND, PRICING } from "@twtdash/shared";
import { localePath } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/types";
import { BROWSERS, SITE_URL } from "@/lib/site";
import { BuiltForIndia } from "./built-for-india";
import { CategoriesShowcase } from "./categories-showcase";
import { Faq } from "./faq";
import { Features } from "./features";
import { FinalCta } from "./final-cta";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { Pricing } from "./pricing";
import { PrivacySection } from "./privacy-section";
import { SearchOperators } from "./search-operators";
import { WhatsNew } from "./whats-new";

function structuredData(dict: Dictionary) {
  const offers = [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro (monthly)", price: String(PRICING.pro.monthly), priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro (yearly)", price: String(PRICING.pro.yearly), priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro (monthly, India)", price: String(PRICING.inr.monthly), priceCurrency: "INR", eligibleRegion: "IN" },
    { "@type": "Offer", name: "Pro (yearly, India)", price: String(PRICING.inr.yearly), priceCurrency: "INR", eligibleRegion: "IN" },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: BRAND.name,
    description: dict.meta.description,
    url: `${SITE_URL}${localePath(dict.locale, "/") === "/" ? "/" : localePath(dict.locale, "/")}`,
    inLanguage: dict.locale === "hi" ? "hi-IN" : "en",
    availableLanguage: ["en", "hi", "bn", "mr", "te", "ta", "gu", "kn", "ml", "pa"],
    applicationCategory: "BrowserApplication",
    operatingSystem: BROWSERS.join(", "),
    offers,
  };
}

/** The whole landing page, in one language. English (/) and हिन्दी (/hi) share every section. */
export function LandingPage({ dict }: { dict: Dictionary }) {
  const names = dict.categories.names;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(dict)).replace(/</g, "\\u003c") }}
      />
      <Hero dict={dict} categoryNames={names} />
      <HowItWorks t={dict.how} />
      <WhatsNew t={dict.whatsNew} categoryNames={names} />
      <BuiltForIndia t={dict.india} categoryNames={names} />
      <Features t={dict.features} />
      <SearchOperators t={dict.search} />
      <CategoriesShowcase t={dict.categories} lang={dict.locale} />
      <PrivacySection t={dict.privacy} lang={dict.locale} />
      <Pricing dict={dict} />
      <Faq t={dict.faq} />
      <FinalCta t={dict.cta} locale={dict.locale} />
    </>
  );
}
