import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { en } from "@/lib/i18n/en";
import { homeMetadata } from "@/lib/metadata";

export const metadata: Metadata = homeMetadata(en);

export default function HomePage() {
  return <LandingPage dict={en} />;
}
