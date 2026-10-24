import { ArrowRight, Brain, Check, Flame } from 'lucide-react';
import { loadRecall } from '@/lazy-screens';
import { plural } from '@/lib/format';
import { fmtCountdown, nextDayStart, useClock, useRecallSummary } from '@/lib/recall';
import { navigate } from '@/hooks/route';
import { cn } from './ui/primitives';

/**
 * Compact "Today's Recall" card for Home: cards left, streak, one-tap start.
 * Self-contained (reads Recall state itself); renders a skeleton while loading.
 */
export function RecallWidget({ className }: { className?: string }) {
  const s = useRecallSummary();
  const now = useClock(60_000);

  if (!s) return <div className={cn('skeleton h-[84px] rounded-2xl', className)} aria-hidden />;

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

  return (
    <button
      type="button"
      onClick={() => navigate('#/recall')}
      onPointerEnter={() => void loadRecall()}
      onFocus={() => void loadRecall()}
      aria-label={`${title}. ${detail}. ${s.streak ? `${s.streak}-day streak.` : ''}`}
      className={cn(
        'group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-line bg-panel p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover',
        className,
      )}
    >
      <span aria-hidden className="aurora pointer-events-none absolute inset-0 opacity-50" />
      <span
        className={cn(
          'relative grid size-12 shrink-0 place-items-center rounded-[16px] text-white shadow-[0_12px_28px_-12px_rgb(150_80_255/0.8)]',
          done ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-[0_12px_28px_-12px_rgb(16_185_129/0.8)]' : 'bg-brand',
        )}
      >
        {done ? <Check className="size-6" strokeWidth={2.6} /> : <Brain className="size-6" />}
      </span>

      <span className="relative min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold tracking-[-0.02em]">{title}</span>
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted">
          <span className="truncate">{detail}</span>
          {s.streak ? (
            <span className={cn('inline-flex items-center gap-1 font-medium', s.todayCounts ? 'text-orange-500' : s.streakAtRisk ? 'text-amber-600 dark:text-amber-400' : 'text-muted')}>
              <Flame className={cn('size-3.5', s.todayCounts && 'fill-orange-500/80')} />
              {s.streakAtRisk ? `Keep your ${s.streak}-day streak` : `${s.streak}-day streak`}
            </span>
          ) : null}
        </span>
        {s.reviewedToday && !done ? (
          <span className="mt-2 block h-1 max-w-[240px] overflow-hidden rounded-full bg-panel-2" aria-hidden>
            <span className="bg-brand block h-full rounded-full" style={{ width: `${pct}%` }} />
          </span>
        ) : null}
      </span>

      <span
        className={cn(
          'relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-medium transition-transform group-hover:translate-x-0.5',
          done || !s.dueToday ? 'bg-panel-2 text-fg-2' : 'btn-brand',
        )}
      >
        {done ? 'Review more' : s.dueToday ? (s.reviewedToday ? 'Continue' : 'Start') : 'Open'}
        <ArrowRight className="size-4" />
      </span>
    </button>
  );
}
