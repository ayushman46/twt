import type { Metadata } from "next";
import { BRAND, PRICING } from "@twtdash/shared";
import { CategoriesShowcase } from "@/components/landing/categories-showcase";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { FinalCta } from "@/components/landing/final-cta";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { PrivacySection } from "@/components/landing/privacy-section";
import { SearchOperators } from "@/components/landing/search-operators";
import { BROWSERS, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: BRAND.name,
  description: BRAND.description,
  url: SITE_URL,
  applicationCategory: "BrowserApplication",
  operatingSystem: BROWSERS.join(", "),
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: PRICING.currency },
    { "@type": "Offer", name: "Pro (monthly)", price: String(PRICING.pro.monthly), priceCurrency: PRICING.currency },
    { "@type": "Offer", name: "Pro (yearly)", price: String(PRICING.pro.yearly), priceCurrency: PRICING.currency },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <Hero />
      <HowItWorks />
      <Features />
      <CategoriesShowcase />
      <SearchOperators />
      <PrivacySection />
      <Pricing />
      <Faq />
      <FinalCta />
    </>
  );
}
