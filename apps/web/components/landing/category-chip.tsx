import clsx from "clsx";
import type { CategoryDefinition } from "@twtdash/shared";
import { CategoryGlyph } from "./category-glyph";

/** Category chip: a quiet glyph and the name, no colour fill. */
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
      className={clsx(
        "inline-flex max-w-full items-center whitespace-nowrap rounded-full border border-line bg-panel text-fg-2",
        size === "xs" && "h-5 gap-1 px-1.5 text-[10.5px]",
        size === "sm" && "h-6 gap-1.5 px-2 text-xs",
        size === "md" && "h-8 gap-2 px-3 text-[13px]",
        className,
      )}
    >
      <CategoryGlyph id={category.id} className="text-muted" />
      <span className="truncate">{label ?? category.name}</span>
      {count !== undefined ? <span className="tabular-nums text-muted">{count}</span> : null}
    </span>
  );
}
