import { Library } from 'lucide-react';
import type { Route } from '@/hooks/route';

/** Placeholder — replaced by the Shelf feature implementation. */
export function ShelfView(_props: { route: Route }) {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pt-8 sm:px-8">
      <h1 className="flex items-center gap-3 text-[28px] font-semibold tracking-tight">
        <Library className="size-7 text-accent" /> Shelf
      </h1>
      <p className="mt-2 text-muted">Coming together…</p>
    </div>
  );
}
