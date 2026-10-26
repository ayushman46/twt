import clsx from "clsx";
import type { ReactNode } from "react";

/** Section title + one supporting paragraph. Left-aligned so it shares the page's left edge. */
export function SectionHeading({
  id,
  title,
  description,
  align = "left",
  className,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-col", align === "center" ? "mx-auto max-w-2xl items-center text-center" : "max-w-2xl", className)}>
      <h2 id={id} className="text-balance text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.03em] text-fg sm:text-[2.5rem] sm:leading-[1.05]">
        {title}
      </h2>
      {description ? <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-[17px]">{description}</p> : null}
    </div>
  );
}

/** A landing-page section: consistent rhythm, a hairline on top, and an optional heading. */
export function Section({
  id,
  labelledBy,
  children,
  className,
  divider = true,
}: {
  id?: string;
  labelledBy: string;
  children: ReactNode;
  className?: string;
  divider?: boolean;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={clsx("cv-auto scroll-mt-16", className)}>
      <div className="container-page">
        <div className={clsx("py-20 sm:py-24", divider && "border-t border-line")}>{children}</div>
      </div>
    </section>
  );
}
