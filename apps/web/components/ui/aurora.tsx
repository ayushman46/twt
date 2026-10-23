import clsx from "clsx";

/**
 * Soft, slowly drifting brand-colored glow. Purely decorative and CSS-only;
 * the drift animation is disabled for users who prefer reduced motion.
 */
export function Aurora({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={clsx("aurora", className)}>
      <span className="aurora-blob aurora-blob-1" />
      <span className="aurora-blob aurora-blob-2" />
      <span className="aurora-blob aurora-blob-3" />
    </div>
  );
}
