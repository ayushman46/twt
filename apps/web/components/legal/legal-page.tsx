import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/section-heading";

/** Shared shell for long-form pages (privacy, terms). */
export function LegalPage({
  eyebrow,
  title,
  effectiveDate,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  effectiveDate: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] overflow-hidden">
        <div className="bg-grid absolute inset-0" />
        <div className="absolute left-1/2 top-[-14rem] h-[28rem] w-[min(52rem,130vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(123_97_255/0.2),rgb(255_92_157/0.05)_60%,transparent)]" />
      </div>
      <article className="container-page max-w-3xl py-16 sm:py-24">
        <header className="border-b border-line pb-10">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{title}</h1>
          <p className="mt-4 text-sm text-zinc-500">
            Effective <time dateTime="2026-10-23">{effectiveDate}</time>
          </p>
          {intro ? <div className="mt-6 text-lg leading-relaxed text-zinc-300">{intro}</div> : null}
        </header>
        <div className="prose-legal pt-4">{children}</div>
      </article>
    </div>
  );
}
