import clsx from "clsx";
import type { CSSProperties } from "react";
import type { CategoryDefinition } from "@twtdash/shared";

/** Category pill tinted with the category's taxonomy color. */
export function CategoryChip({
  category,
  label,
  count,
  size = "sm",
  className,
}: {
  category: CategoryDefinition;
  label?: string;
  count?: number | string;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  return (
    <span
      style={{ "--c": category.color } as CSSProperties}
      className={clsx(
        "inline-flex max-w-full items-center whitespace-nowrap rounded-full border font-medium",
        "border-[color:color-mix(in_oklab,var(--c)_38%,transparent)] bg-[color:color-mix(in_oklab,var(--c)_13%,transparent)] text-[color:color-mix(in_oklab,var(--c)_42%,white)]",
        size === "xs" && "gap-1 px-1.5 py-px text-[10px]",
        size === "sm" && "gap-1.5 px-2 py-0.5 text-[11px]",
        size === "md" && "gap-2 px-3.5 py-2 text-sm",
        className,
      )}
    >
      <span aria-hidden="true">{category.emoji}</span>
      <span className="truncate">{label ?? category.name}</span>
      {count !== undefined ? <span className="tabular-nums opacity-60">{count}</span> : null}
    </span>
  );
}
