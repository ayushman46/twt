import type { ReactNode } from "react";
import { Info, type LucideIcon } from "lucide-react";

/** Building blocks shared by the English and Hindi install guides. */

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="mt-8 rounded-xl border border-line bg-panel p-5 sm:p-7">{children}</ol>;
}

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="group/step relative flex gap-4 pb-8 last:pb-0">
      <div aria-hidden="true" className="absolute bottom-0 left-[13.5px] top-9 w-px bg-line group-last/step:hidden" />
      <span
        aria-hidden="true"
        className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong bg-panel text-[12.5px] font-medium tabular-nums text-fg-2"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 pt-[3px]">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
        <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-muted">{children}</div>
      </div>
    </li>
  );
}

export function Note({ children, icon: Icon = Info }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-inset p-4 text-[14px] leading-relaxed text-muted">
      <Icon className="mt-[3px] size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-fg-2">{children}</strong>;
}

/** Section of the guide: hairline on top, title, one line of context. */
export function GuideSection({
  id,
  title,
  lead,
  children,
}: {
  id?: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={titleId} className="mt-14 scroll-mt-20 border-t border-line pt-12">
      <h2 id={titleId} className="text-[1.5rem] font-semibold leading-tight tracking-[-0.025em] text-fg sm:text-[1.75rem]">
        {title}
      </h2>
      {lead ? <p className="mt-2 text-[15px] leading-relaxed text-muted">{lead}</p> : null}
      {children}
    </section>
  );
}
