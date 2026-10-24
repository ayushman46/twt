import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { hi } from "@/lib/i18n/hi";
import { homeMetadata } from "@/lib/metadata";

export const metadata: Metadata = homeMetadata(hi);

export default function HindiHomePage() {
  return <LandingPage dict={hi} />;
}
