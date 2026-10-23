import clsx from "clsx";

/**
 * twtdash logo mark — inline copy of packages/shared/assets/logo.svg
 * (gradient squircle, white bookmark, X-shaped sparkle).
 * `id` keeps gradient ids unique when the mark appears more than once per page.
 */
export function LogoMark({ id, className, title }: { id: string; className?: string; title?: string }) {
  const bg = `td-logo-bg-${id}`;
  const gloss = `td-logo-gloss-${id}`;
  const mark = `td-logo-mark-${id}`;
  return (
    <svg
      viewBox="0 0 128 128"
      className={clsx("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7B61FF" />
          <stop offset=".55" stopColor="#B14CF2" />
          <stop offset="1" stopColor="#FF5C9D" />
        </linearGradient>
        <linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={mark} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6D4BFF" />
          <stop offset="1" stopColor="#E0479A" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="30" fill={`url(#${bg})`} />
      <rect width="128" height="64" rx="30" fill={`url(#${gloss})`} />
      <rect x="31" y="27" width="56" height="74" rx="10" fill="#fff" fillOpacity=".28" transform="rotate(-10 59 64)" />
      <path
        d="M44 24h44a7 7 0 0 1 7 7v71.2a3.2 3.2 0 0 1-5 2.6L66 88 42 104.8a3.2 3.2 0 0 1-5-2.6V31a7 7 0 0 1 7-7z"
        fill="#fff"
      />
      <path d="M53 41.5Q66 51.5 79 41.5Q69 54.5 79 67.5Q66 57.5 53 67.5Q63 54.5 53 41.5Z" fill={`url(#${mark})`} />
    </svg>
  );
}

/** "twt" + gradient "dash" — the twtdash wordmark as text (always lowercase). */
export function WordmarkText({ className }: { className?: string }) {
  return (
    <span className={clsx("font-semibold leading-none tracking-[-0.045em] text-white", className)}>
      twt<span className="text-brand-gradient pr-[0.04em]">dash</span>
    </span>
  );
}

export function Wordmark({ id, className }: { id: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <LogoMark id={id} className="size-7 drop-shadow-[0_4px_14px_rgb(177_76_242/0.45)]" />
      <WordmarkText className="text-[1.15rem]" />
    </span>
  );
}
