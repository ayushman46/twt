import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The one card anatomy used across the landing page: a muted line icon with
 * the title, one or two lines of copy, then (optionally) a small neutral
 * illustration pinned to the bottom so rows line up.
 */
export function FeatureCard({
  icon: Icon,
  title,
  children,
  visual,
  visualIsContent = false,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  visual?: ReactNode;
  /** Set when the visual carries real information (it is then exposed to assistive tech). */
  visualIsContent?: boolean;
  className?: string;
}) {
  return (
    <article className={clsx("flex flex-col rounded-xl border border-line bg-panel p-5 sm:p-6", className)}>
      <div className="flex items-center gap-2.5">
        <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
      </div>
      <p className="mt-2 text-pretty text-[14.5px] leading-relaxed text-muted">{children}</p>
      {visual ? (
        <div aria-hidden={visualIsContent ? undefined : true} className="mt-6 flex flex-1 flex-col justify-end">
          {visual}
        </div>
      ) : null}
    </article>
  );
}

/** Recessed stage for a card's mini illustration. */
export function Inset({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("rounded-lg border border-line bg-inset p-4", className)}>{children}</div>;
}

/** Neutral initials avatar (no random colours). */
export function Initials({ name, className }: { name: string; className?: string }) {
  const letters = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <span
      className={clsx(
        "flex size-7 shrink-0 items-center justify-center rounded-full bg-panel-2 text-[10.5px] font-medium text-muted",
        className,
      )}
    >
      {letters}
    </span>
  );
}
