import { ArrowRight, Check } from 'lucide-react';
import { loadRecall } from '@/lazy-screens';
import { plural } from '@/lib/format';
import { fmtCountdown, nextDayStart, useClock, useRecallSummary } from '@/lib/recall';
import { navigate } from '@/hooks/route';
import { cn } from './ui/primitives';

/**
 * "Today's Recall" row for Home: title, a muted sub-line and one action.
 * Self-contained (reads Recall state itself); renders a skeleton while loading.
 */
export function RecallWidget({ className }: { className?: string }) {
  const s = useRecallSummary();
  const now = useClock(60_000);

  if (!s) return <div className={cn('skeleton h-16 rounded-xl', className)} aria-hidden />;

  const done = s.doneToday;
  const pct = s.planned ? (s.reviewedToday / s.planned) * 100 : 0;
  const title = done ? 'Today’s Recall is done' : s.dueToday ? 'Today’s Recall' : 'Recall is all caught up';
  const detail = done
    ? `${plural(s.reviewedToday, 'post')} revisited · next in ${fmtCountdown(nextDayStart(now) - now)}`
    : s.dueToday
      ? s.reviewedToday
        ? `${s.dueToday} of ${s.planned} cards left`
        : plural(s.dueToday, 'card')
      : `Next session in ${fmtCountdown(nextDayStart(now) - now)}`;
  const streakText = s.streakAtRisk ? `Keep your ${s.streak}-day streak` : `${s.streak}-day streak`;
  const action = done ? 'Review more' : s.dueToday ? (s.reviewedToday ? 'Continue' : 'Start') : 'Open';
  const primary = !done && !!s.dueToday;

  return (
    <button
      type="button"
      onClick={() => navigate('#/recall')}
      onPointerEnter={() => void loadRecall()}
      onFocus={() => void loadRecall()}
      className={cn('flex w-full items-center gap-4 rounded-xl border border-line bg-panel px-4 py-3.5 text-left transition-colors hover:bg-panel-2', className)}
    >
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2 text-[14px] font-semibold tracking-[-0.01em]">
          {done ? <Check aria-hidden className="size-4 shrink-0 text-good" strokeWidth={2.5} /> : null}
          <span className="truncate">{title}</span>
        </span>
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted">
          <span className="truncate">{detail}</span>
          {s.streak ? <span className="shrink-0 tabular-nums">· {streakText}</span> : null}
        </span>
        {s.reviewedToday && !done ? (
          <span className="mt-2 block h-1 max-w-[240px] overflow-hidden rounded-full bg-panel-2" aria-hidden>
            <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </span>
        ) : null}
      </span>

      <span
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors',
          primary ? 'btn-brand' : 'border border-line-strong bg-panel text-fg',
        )}
      >
        {action}
        <ArrowRight aria-hidden className="size-4" />
      </span>
    </button>
  );
}
