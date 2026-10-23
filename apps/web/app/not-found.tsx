import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] overflow-hidden">
        <div className="bg-grid absolute inset-0" />
        <div className="absolute left-1/2 top-[-14rem] h-[28rem] w-[min(52rem,130vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(123_97_255/0.2),rgb(255_92_157/0.05)_60%,transparent)]" />
      </div>
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <p className="text-brand-gradient font-mono text-sm font-medium">404</p>
        <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
          This page got <span className="text-brand-gradient pr-[0.08em] font-display font-normal italic">un-bookmarked</span>
        </h1>
        <p className="mt-4 max-w-md text-zinc-400">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <ButtonLink href="/" className="mt-8">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to home
        </ButtonLink>
      </div>
    </div>
  );
}
