import type { CSSProperties, ReactNode } from "react";

/**
 * Fades content in (8px rise) when it first scrolls into view. Server-rendered,
 * zero client JS: an inline script (lib/head-script.ts) marks elements as
 * shown and CSS (globals.css) runs the animation. Without JS, or with reduced
 * motion, content is simply visible. Keep above-the-fold (LCP) content out of
 * <Reveal> so it paints immediately.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
  id,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "section" | "figure" | "ul" | "ol";
  id?: string;
}) {
  const style = delay ? ({ "--rd": `${delay}s` } as CSSProperties) : undefined;
  return (
    <Tag data-reveal="" id={id} className={className} style={style} suppressHydrationWarning>
      {children}
    </Tag>
  );
}
