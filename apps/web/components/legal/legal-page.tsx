import type { ReactNode } from "react";

/** Shared shell for long-form pages (privacy, terms). */
export function LegalPage({
  title,
  effectiveDate,
  intro,
  children,
}: {
  title: string;
  effectiveDate: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="container-page">
      <article className="mx-auto max-w-3xl pb-20 pt-12 sm:pb-28 sm:pt-20">
        <header className="border-b border-line pb-10">
          <h1 className="text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.035em] text-fg sm:text-[3rem]">{title}</h1>
          <p className="mt-3 text-[14px] text-muted">
            Effective <time dateTime="2026-10-23">{effectiveDate}</time>
          </p>
          {intro ? <div className="mt-6 text-[17px] leading-relaxed text-fg-2">{intro}</div> : null}
        </header>
        <div className="prose-legal pt-4">{children}</div>
      </article>
    </div>
  );
}
