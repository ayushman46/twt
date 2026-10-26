import clsx from "clsx";

/** Brand blue from packages/shared/assets/logo.svg (the canonical mark). */
export const LOGO_BLUE = "#3D5BD9";

/**
 * twtdash mark: a flat blue squircle with a white bookmark and a dash cut into it.
 * Inline copy of packages/shared/assets/logo.svg. No gradients, no glow.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      className={clsx("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="128" height="128" rx="28" fill={LOGO_BLUE} />
      <path
        transform="translate(-2 0)"
        d="M44 24h44a7 7 0 0 1 7 7v71.2a3.2 3.2 0 0 1-5 2.6L66 88 42 104.8a3.2 3.2 0 0 1-5-2.6V31a7 7 0 0 1 7-7z"
        fill="#fff"
      />
      <rect x="52" y="49" width="24" height="9" rx="4.5" fill={LOGO_BLUE} />
    </svg>
  );
}

/** "twtdash" in the foreground colour, one colour (always lowercase). */
export function WordmarkText({ className }: { className?: string }) {
  return (
    <span lang="en" className={clsx("font-semibold leading-none tracking-[-0.03em] text-fg", className)}>
      twtdash
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-6" />
      <WordmarkText className="text-[15px]" />
    </span>
  );
}
