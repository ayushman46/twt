import clsx from "clsx";
import type { ReactNode } from "react";
import { Reveal } from "./reveal";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs font-medium tracking-wide text-zinc-300 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]",
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-brand-gradient shadow-[0_0_10px_rgb(177_76_242/0.9)]" />
      {children}
    </p>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <Reveal
      className={clsx(
        "flex flex-col gap-4",
        align === "center" ? "mx-auto max-w-2xl items-center text-center" : "max-w-xl items-start text-left",
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2
        id={id}
        className="text-balance text-[2rem] font-semibold leading-[1.1] tracking-[-0.035em] text-white sm:text-4xl md:text-[2.875rem] md:leading-[1.06]"
      >
        {title}
      </h2>
      {description ? <p className="text-pretty text-base leading-relaxed text-zinc-400 sm:text-[1.0625rem]">{description}</p> : null}
    </Reveal>
  );
}

/** Serif italic accent used inside headings. */
export function Accent({ children, gradient = false }: { children: ReactNode; gradient?: boolean }) {
  return (
    <span className={clsx("font-display font-normal italic tracking-[-0.005em]", gradient && "text-brand-gradient pr-[0.08em]")}>
      {children}
    </span>
  );
}
