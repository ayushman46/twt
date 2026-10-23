import { MessagesSquare } from 'lucide-react';
import type { Route } from '@/hooks/route';
import type { Settings } from '@/lib/storage';

/** Placeholder — replaced by the Ask feature implementation. */
export function AskView(_props: { route: Route; settings: Settings }) {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pt-8 sm:px-8">
      <h1 className="flex items-center gap-3 text-[28px] font-semibold tracking-tight">
        <MessagesSquare className="size-7 text-accent" /> Ask
      </h1>
      <p className="mt-2 text-muted">Coming together…</p>
    </div>
  );
}
