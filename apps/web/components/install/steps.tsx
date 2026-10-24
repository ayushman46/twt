import type { ReactNode } from "react";
import { Info } from "lucide-react";

/** Building blocks shared by the English and Hindi install guides. */

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="group/step relative flex gap-4 pb-9 last:pb-0 sm:gap-5">
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-[1.0625rem] top-10 w-px bg-[linear-gradient(180deg,rgb(139_109_255/0.35),rgb(255_255_255/0.06))] group-last/step:hidden"
      />
      <span
        aria-hidden="true"
        className="icon-tile-soft relative flex size-[2.125rem] shrink-0 items-center justify-center rounded-full font-mono text-sm font-medium text-white"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <h3 className="font-semibold text-white">{title}</h3>
        <div className="mt-2 space-y-3 text-[0.9375rem] leading-relaxed text-zinc-400">{children}</div>
      </div>
    </li>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm leading-relaxed text-zinc-400">
      <Info className="mt-0.5 size-4 shrink-0 text-brand-soft" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-zinc-200">{children}</strong>;
}

/** Hero backdrop used at the top of both install guides. */
export function InstallBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] overflow-hidden">
        <div className="bg-grid absolute inset-0" />
        <div className="absolute left-1/2 top-[-16rem] h-[34rem] w-[min(60rem,140vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(123_97_255/0.32),rgb(177_76_242/0.12)_55%,transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
      </div>
      {children}
    </div>
  );
}
