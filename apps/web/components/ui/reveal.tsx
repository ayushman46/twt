import type { CSSProperties, ReactNode } from "react";

/**
 * Fades + lifts content in when it first scrolls into view. Server-rendered,
 * zero client JS: an inline script (lib/head-script.ts) marks elements as
 * shown and CSS (globals.css) runs the animation. Without JS, or with reduced
 * motion, content is simply visible. Keep above-the-fold (LCP) content out of
 * <Reveal> so it paints immediately.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  as: Tag = "div",
  id,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "li" | "section" | "figure";
  id?: string;
}) {
  const style = { "--rd": delay ? `${delay}s` : undefined, "--ry": y !== 18 ? `${y}px` : undefined } as CSSProperties;
  return (
    <Tag data-reveal="" id={id} className={className} style={style} suppressHydrationWarning>
      {children}
    </Tag>
  );
}
