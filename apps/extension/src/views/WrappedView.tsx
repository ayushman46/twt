/**
 * Wrapped — a story-style recap of what the user saved on X, ending in a
 * shareable image (the growth loop). Tap/click or ←/→ to move, Space to pause.
 */
import { ArrowRight, ChevronLeft, ChevronRight, Heart, Pause, Play, RotateCcw, Share2, Sprout } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import { Avatar, Logo } from '@/components/Brand';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { ShareStudio } from '@/components/ShareCard';
import { startSync } from '@/components/SyncControl';
import { Tip } from '@/components/ui/overlays';
import { Button, Kbd, cn } from '@/components/ui/primitives';
import { catName } from '@/i18n';
import { fmtCompact, fmtNumber } from '@/lib/format';
import { perfStat, usePaintMark } from '@/lib/perf';
import { viewerItem } from '@/lib/storage';
import { computeWrapped, countByPeriod, hourLabel, WRAPPED_MIN_POSTS, WRAPPED_PERIODS, type WrappedPeriod, type WrappedStats } from '@/lib/wrapped';
import { useStorageItem } from '@/hooks/data';
import { useLibrary } from '@/hooks/library';
import { useRoute } from '@/hooks/route';
import { useUi } from '@/store/ui';

/* ------------------------------------------------------------------ Setup */

type SlideId = 'intro' | 'total' | 'categories' | 'authors' | 'when' | 'streak' | 'persona' | 'share' | 'empty';

interface SlideDef {
  id: SlideId;
  title: string;
  /** Auto-advance after this many ms; 0 = stay. */
  ms: number;
}

/** Story motion: a calm rise, bars that grow, a clock that draws itself. No blur, no bounce, nothing infinite. */
const KEYFRAMES = `
@keyframes wr-progress { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes wr-in { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
@keyframes wr-grow-x { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes wr-grow-y { from { transform: scaleY(0) } to { transform: scaleY(1) } }
@keyframes wr-dash { from { stroke-dashoffset: 1; opacity: 0 } 20% { opacity: 1 } to { stroke-dashoffset: 0; opacity: 1 } }
@keyframes wr-dot { from { opacity: 0; transform: scale(.6) } to { opacity: 1; transform: none } }
.wr-in { animation: wr-in .6s cubic-bezier(.16, 1, .3, 1) both }
`;

const PERIOD_LABEL: Record<WrappedPeriod, { short: string; long: string }> = {
  year: { short: '', long: '' },
  '12m': { short: '12M', long: '12 months' },
  '30d': { short: '30D', long: '30 days' },
  all: { short: 'All', long: 'All time' },
};

function periodPhrase(s: WrappedStats): string {
  if (s.period === 'year') return `in ${s.label}`;
  if (s.period === '12m') return 'in the last 12 months';
  if (s.period === '30d') return 'in the last 30 days';
  return 'since you started';
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Height that fills the viewport below the element's top edge. */
function useFillHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [h, setH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setH(Math.max(540, Math.round(window.innerHeight - top)));
    };
    update();
    window.addEventListener('resize', update);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    if (ref.current?.parentElement?.parentElement) ro?.observe(ref.current.parentElement.parentElement);
    return () => {
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, []);
  return [ref, h] as const;
}

function delay(ms: number, reduced: boolean): CSSProperties {
  return { animationDelay: reduced ? '0ms' : `${ms}ms` };
}

/** Number that counts up when it appears (static with reduced motion). */
function CountUp({ value, reduced, duration = 1400, format = fmtNumber }: { value: number; reduced: boolean; duration?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setShown(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced, duration]);
  return (
    <>
      <span aria-hidden className="tabular-nums">
        {format(shown)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}

/** Slide label: sentence case, muted. */
const kicker = 'text-[15px] text-muted sm:text-[17px]';
/** The big numbers: confident, semibold, tight. */
const numeral = 'font-semibold tracking-[-0.055em] tabular-nums text-fg';
const tile = 'rounded-xl border border-line bg-panel';

/* ----------------------------------------------------------------- Slides */

function IntroSlide({ s, reduced, handle }: { s: WrappedStats; reduced: boolean; handle?: string | null }) {
  const big = s.period === 'year' ? s.label : s.period === '12m' ? '12 months' : s.period === '30d' ? '30 days' : 'All time';
  const facts = [
    `${fmtNumber(s.total)} ${s.total === 1 ? 'save' : 'saves'}`,
    `${fmtNumber(s.categoryCount)} ${s.categoryCount === 1 ? 'interest' : 'interests'}`,
    `${fmtNumber(s.authorCount)} ${s.authorCount === 1 ? 'account' : 'accounts'}`,
  ];
  return (
    <div className="flex flex-col items-start">
      <p className="wr-in inline-flex items-center gap-2 text-[13px] text-muted" style={delay(0, reduced)}>
        <Logo className="size-5" />
        twtdash Wrapped{handle ? <span className="text-faint">· @{handle}</span> : null}
      </p>
      <p className="wr-in mt-10 text-[clamp(24px,4.2cqw,40px)] leading-tight font-semibold tracking-[-0.03em] text-muted" style={delay(100, reduced)}>
        {s.period === 'all' ? 'Your X bookmarks,' : 'Your bookmarks on X in'}
      </p>
      <h2 className={cn(numeral, 'wr-in mt-[0.02em] -ml-[0.04em] text-[clamp(88px,21cqw,232px)] leading-[0.78]')} style={delay(180, reduced)}>
        {big}
        <span className="text-accent">.</span>
      </h2>
      <p className="wr-in mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-fg-2 tabular-nums sm:text-[17px]" style={delay(320, reduced)}>
        {facts.map((f, i) => (
          <span key={f} className="inline-flex items-center gap-3">
            {i ? (
              <span aria-hidden className="text-faint">
                ·
              </span>
            ) : null}
            {f}
          </span>
        ))}
      </p>
      <p className="wr-in mt-10 inline-flex items-center gap-2 text-[13px] text-muted" style={delay(480, reduced)}>
        Tap anywhere or press <Kbd>→</Kbd> to begin
      </p>
    </div>
  );
}

function TotalSlide({ s, reduced }: { s: WrappedStats; reduced: boolean }) {
  const buckets = s.timeline.buckets;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const peak = buckets.reduce((best, b, i) => (b.count > buckets[best]!.count ? i : best), 0);
  const change = s.previous?.change;
  const perDay = s.perDay >= 10 ? fmtNumber(Math.round(s.perDay)) : s.perDay >= 1 ? s.perDay.toFixed(1) : null;
  const perWeek = (s.perDay * 7).toFixed(1).replace(/\.0$/, '');
  const unitWord = s.timeline.unit === 'day' ? 'day' : s.timeline.unit === 'year' ? 'year' : 'month';
  return (
    <div className="flex flex-col">
      <p className={cn(kicker, 'wr-in first-letter:uppercase')} style={delay(0, reduced)}>
        {periodPhrase(s)} you saved
      </p>
      <div className="wr-in mt-3 flex flex-wrap items-baseline gap-x-4" style={delay(80, reduced)}>
        <span className={cn(numeral, 'text-[clamp(96px,21cqw,224px)] leading-[0.8]')}>
          <CountUp value={s.total} reduced={reduced} />
        </span>
        <span className="text-[clamp(28px,4.6cqw,48px)] font-semibold tracking-[-0.03em] text-muted">{s.total === 1 ? 'post' : 'posts'}</span>
      </div>
      <div className="wr-in mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] text-fg-2 sm:text-[16px]" style={delay(200, reduced)}>
        <span>{perDay ? `That’s ${perDay} a day.` : `About ${perWeek} a week.`}</span>
        {change !== undefined && change !== null && s.previous ? (
          <span className={cn('inline-flex items-center gap-1 text-[14px] font-medium tabular-nums', change >= 0 ? 'text-good' : 'text-muted')}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(Math.round(change * 100))}% vs {s.previous.label}
          </span>
        ) : s.previous && s.previous.total === 0 && s.total > 0 ? (
          <span className="text-[14px] text-muted">Nothing saved {s.previous.label}</span>
        ) : null}
      </div>

      {buckets.length > 1 ? (
        <figure className="wr-in mt-10 sm:mt-12" style={delay(300, reduced)}>
          <div className="flex h-[clamp(88px,18cqh,168px)] items-end gap-[3px] sm:gap-1.5" role="img" aria-label={`Saves per ${unitWord}. Peak: ${buckets[peak]!.label} with ${buckets[peak]!.count}.`}>
            {buckets.map((b, i) => (
              <div key={b.key} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div
                  className={cn('origin-bottom rounded-t-[3px] [animation:wr-grow-y_.8s_cubic-bezier(.16,1,.3,1)_both]', i === peak ? 'bg-accent' : 'bg-panel-3')}
                  style={{ height: `${Math.max(3, (b.count / max) * 100)}%`, ...delay(360 + i * (500 / buckets.length), reduced) }}
                />
              </div>
            ))}
          </div>
          {buckets.length <= 14 ? (
            <div className="mt-2 flex gap-[3px] border-t border-line pt-2 sm:gap-1.5">
              {buckets.map((b, i) => (
                <span key={b.key} className={cn('min-w-0 flex-1 truncate text-center text-[10px] sm:text-[11px]', i === peak ? 'font-medium text-fg' : 'text-muted')}>
                  {b.label}
                </span>
              ))}
            </div>
          ) : null}
          <figcaption className="mt-4 text-[14px] text-muted sm:text-[15px]">
            {s.timeline.unit === 'day' ? (
              <>
                Your biggest day: <span className="font-medium text-fg">{buckets[peak]!.label}</span> · {fmtNumber(buckets[peak]!.count)} saves
              </>
            ) : s.busiestMonth ? (
              <>
                <span className="font-medium text-fg">{s.busiestMonth.label.replace(` ${s.year}`, '')}</span> was your biggest month · {fmtNumber(s.busiestMonth.count)} saves
              </>
            ) : null}
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}

function CategoriesSlide({ s, reduced }: { s: WrappedStats; reduced: boolean }) {
  const top = s.categories[0]!;
  const max = top.share || 1;
  return (
    <div className="flex flex-col">
      <p className={cn(kicker, 'wr-in')} style={delay(0, reduced)}>
        Your feed had a type
      </p>
      <h2 className="wr-in mt-3 text-[clamp(34px,6.4cqw,68px)] leading-[1.02] font-semibold tracking-[-0.04em] text-fg" style={delay(80, reduced)}>
        {top.share >= 0.3 ? 'Mostly' : 'Led by'} <span className="text-accent">{catName(top)}</span>
      </h2>
      <p className="wr-in mt-3 text-[15px] text-muted tabular-nums sm:text-[16px]" style={delay(160, reduced)}>
        {Math.round(top.share * 100)}% of everything you saved · {s.categoryCount} categories in all
      </p>
      <ol className="mt-9 divide-y divide-line border-y border-line sm:mt-11">
        {s.categories.map((c, i) => (
          <li key={c.id} className="wr-in grid grid-cols-[24px_minmax(0,1fr)_48px] items-center gap-x-3 py-3 sm:grid-cols-[32px_minmax(0,1fr)_minmax(0,1.4fr)_56px] sm:gap-x-5" style={delay(240 + i * 80, reduced)}>
            <span className="row-start-1 text-[13px] text-muted tabular-nums">{String(i + 1).padStart(2, '0')}</span>
            <div className="col-start-2 row-start-1 flex min-w-0 items-center gap-2 text-[15px] font-medium text-fg sm:text-[16px]">
              <CategoryGlyph category={c} className="text-[16px] text-muted" />
              <span className="truncate">{catName(c)}</span>
            </div>
            <div className="col-start-2 row-start-2 mt-2.5 h-1.5 overflow-hidden rounded-full bg-panel-2 sm:col-start-3 sm:row-start-1 sm:mt-0">
              <div
                className={cn('h-full origin-left rounded-full [animation:wr-grow-x_.9s_cubic-bezier(.16,1,.3,1)_both]', i === 0 ? 'bg-accent' : 'bg-fg/30')}
                style={{ width: `${Math.max(3, (c.share / max) * 100)}%`, ...delay(340 + i * 80, reduced) }}
              />
            </div>
            <span className="col-start-3 row-start-1 text-right text-[15px] font-medium text-fg tabular-nums sm:col-start-4 sm:text-[16px]">{Math.max(1, Math.round(c.share * 100))}%</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AuthorsSlide({ s, reduced }: { s: WrappedStats; reduced: boolean }) {
  const [top, ...rest] = s.authors;
  if (!top) return null;
  return (
    <div className="flex flex-col">
      <p className={cn(kicker, 'wr-in')} style={delay(0, reduced)}>
        The account you kept coming back to
      </p>
      <div className="wr-in mt-6 flex items-center gap-4 sm:gap-6" style={delay(100, reduced)}>
        <Avatar src={top.avatar} name={top.name} handle={top.handle} size={80} className="shrink-0 max-sm:!size-[60px] max-sm:!text-[22px]" />
        <div className="min-w-0">
          <div className="truncate text-[clamp(28px,5.4cqw,56px)] leading-[1.05] font-semibold tracking-[-0.035em] text-fg">{top.name || top.handle}</div>
          <div className="mt-1 truncate text-[15px] text-muted sm:text-[16px]">@{top.handle}</div>
        </div>
      </div>
      <p className="wr-in mt-5 text-[15px] text-fg-2 sm:text-[17px]" style={delay(180, reduced)}>
        <span className="font-semibold text-fg tabular-nums">{fmtNumber(top.count)}</span> of your saves. That’s 1 in every {Math.max(1, Math.round(s.total / top.count))}.
      </p>
      {rest.length ? (
        <ol className="mt-8 grid gap-x-8 sm:mt-10 sm:grid-cols-2">
          {rest.map((a, i) => (
            <li key={a.handle} className="wr-in flex min-h-14 items-center gap-3 border-t border-line py-2.5" style={delay(260 + i * 80, reduced)}>
              <span className="w-5 text-[13px] text-muted tabular-nums">{i + 2}</span>
              <Avatar src={a.avatar} name={a.name} handle={a.handle} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-fg">{a.name || a.handle}</div>
                <div className="truncate text-[12.5px] text-muted">@{a.handle}</div>
              </div>
              <span className="text-[14px] font-medium text-fg tabular-nums">{fmtNumber(a.count)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <p className="wr-in mt-6 text-[13px] text-muted" style={delay(640, reduced)}>
        You saved posts from {fmtNumber(s.authorCount)} different {s.authorCount === 1 ? 'account' : 'accounts'}.
      </p>
    </div>
  );
}

function timeOfDayLine(h: number): string {
  if (h >= 5 && h < 12) return 'Morning person. You save with your first chai.';
  if (h >= 12 && h < 17) return 'Post-lunch scrolling is your research hour.';
  if (h >= 17 && h < 22) return 'Evenings are when you catch up on the world.';
  return 'Sleep can wait. The timeline can’t.';
}

function HourClock({ hours, peak, reduced }: { hours: number[]; peak: number; reduced: boolean }) {
  const max = Math.max(1, ...hours);
  const r0 = 70;
  const len = 74;
  return (
    <svg viewBox="-182 -182 364 364" className="w-[min(78cqw,320px)] shrink-0 overflow-visible max-sm:w-[min(62cqw,240px)]" role="img" aria-label={`Saves by hour of day. Peak at ${hourLabel(peak)}.`}>
      <circle r={r0 - 10} fill="var(--panel)" stroke="var(--line)" />
      {hours.map((v, h) => {
        const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
        const r1 = r0 + 4 + (v / max) * len;
        return (
          <line
            key={h}
            x1={Math.cos(a) * r0}
            y1={Math.sin(a) * r0}
            x2={Math.cos(a) * r1}
            y2={Math.sin(a) * r1}
            pathLength={1}
            strokeDasharray="1 1"
            stroke={h === peak ? 'var(--accent)' : 'var(--line-strong)'}
            strokeWidth={9}
            strokeLinecap="round"
            style={{ animation: 'wr-dash .7s cubic-bezier(.16,1,.3,1) both', ...delay(240 + h * 25, reduced) }}
          />
        );
      })}
      {[0, 6, 12, 18].map((h) => {
        const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
        return (
          <text key={h} x={Math.cos(a) * 170} y={Math.sin(a) * 170 + 4} textAnchor="middle" fontSize="12" fill="var(--muted)" fontWeight="500">
            {hourLabel(h).replace(' ', '').toLowerCase()}
          </text>
        );
      })}
      <text y="6" textAnchor="middle" fontSize="30" fontWeight="600" letterSpacing="-0.8" fill="var(--fg)">
        {hourLabel(peak)}
      </text>
      <text y="28" textAnchor="middle" fontSize="12" fill="var(--muted)">
        peak hour
      </text>
    </svg>
  );
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEK_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function WhenSlide({ s, reduced }: { s: WrappedStats; reduced: boolean }) {
  const peak = s.busiestHour!;
  const day = s.busiestWeekday!;
  const wmax = Math.max(1, ...s.weekdays);
  return (
    <div className="flex flex-col gap-10 sm:flex-row sm:items-center sm:gap-14">
      <div className="wr-in order-2 flex justify-center sm:order-1" style={delay(120, reduced)}>
        <HourClock hours={s.hours} peak={peak.hour} reduced={reduced} />
      </div>
      <div className="order-1 min-w-0 flex-1 sm:order-2">
        <p className={cn(kicker, 'wr-in')} style={delay(0, reduced)}>
          When you save
        </p>
        <h2 className="wr-in mt-3 text-[clamp(34px,6cqw,64px)] leading-[1.02] font-semibold tracking-[-0.04em] text-fg" style={delay(80, reduced)}>
          Your hour is <span className="whitespace-nowrap text-accent">{peak.label}</span>
        </h2>
        <p className="wr-in mt-3 text-[15px] text-fg-2 sm:text-[17px]" style={delay(160, reduced)}>
          {timeOfDayLine(peak.hour)}
        </p>
        <div className="wr-in mt-8 sm:mt-10" style={delay(240, reduced)}>
          <div className="flex h-[72px] items-end gap-1.5 sm:h-[92px] sm:gap-2" role="img" aria-label={`Saves by weekday. Busiest: ${day.label}.`}>
            {WEEK_ORDER.map((d, i) => (
              <div key={d} className="flex h-full flex-1 flex-col items-center justify-end">
                <div
                  className={cn('w-full origin-bottom rounded-t-[3px] [animation:wr-grow-y_.7s_cubic-bezier(.16,1,.3,1)_both]', d === day.day ? 'bg-accent' : 'bg-panel-3')}
                  style={{ height: `${Math.max(4, (s.weekdays[d]! / wmax) * 100)}%`, ...delay(320 + i * 50, reduced) }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5 border-t border-line pt-2 sm:gap-2">
            {WEEK_ORDER.map((d) => (
              <span key={d} className={cn('flex-1 text-center text-[11px]', d === day.day ? 'font-medium text-fg' : 'text-muted')}>
                {WEEK_SHORT[d]}
              </span>
            ))}
          </div>
          <p className="mt-4 text-[14px] text-muted sm:text-[15px]">
            <span className="font-medium text-fg">{day.label}s</span> are for saving. {fmtNumber(day.count)} of your posts landed on one.
          </p>
        </div>
      </div>
    </div>
  );
}

function StreakSlide({ s, reduced }: { s: WrappedStats; reduced: boolean }) {
  const days = s.streak?.days ?? 0;
  const dots = Math.min(days, 28);
  const liked = s.mostLiked;
  return (
    <div className="flex flex-col">
      <p className={cn(kicker, 'wr-in')} style={delay(0, reduced)}>
        Your longest streak
      </p>
      <div className="wr-in mt-3 flex flex-wrap items-baseline gap-x-4" style={delay(80, reduced)}>
        <span className={cn(numeral, 'text-[clamp(104px,23cqw,240px)] leading-[0.8]')}>
          <CountUp value={days} reduced={reduced} duration={1000} />
        </span>
        <span className="text-[clamp(26px,4.6cqw,48px)] font-semibold tracking-[-0.03em] text-muted">{days === 1 ? 'day' : 'days in a row'}</span>
      </div>
      <p className="wr-in mt-4 text-[15px] text-fg-2 sm:text-[17px]" style={delay(160, reduced)}>
        {days > 1 ? (
          <>
            From <span className="font-medium text-fg">{s.streak!.startLabel}</span> to <span className="font-medium text-fg">{s.streak!.endLabel}</span>, you saved something every day.
          </>
        ) : (
          'One save a day and next year’s streak is yours.'
        )}
      </p>
      {days > 1 ? (
        <div className="wr-in mt-6 flex max-w-[560px] flex-wrap items-center gap-1.5" aria-hidden style={delay(220, reduced)}>
          {Array.from({ length: dots }, (_, i) => (
            <span key={i} className="size-3 rounded-[3px] bg-accent [animation:wr-dot_.35s_ease-out_both] sm:size-3.5" style={delay(260 + i * 30, reduced)} />
          ))}
          {days > dots ? <span className="ml-1.5 text-[12px] font-medium text-muted tabular-nums">+{days - dots}</span> : null}
        </div>
      ) : null}
      <dl className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:grid-cols-3">
        <div className={cn(tile, 'wr-in p-4 sm:p-5')} style={delay(420, reduced)}>
          <dd className="text-[34px] leading-none font-semibold tracking-[-0.04em] text-fg tabular-nums sm:text-[40px]">{Math.round(s.readShare * 100)}%</dd>
          <dt className="mt-2 text-[13px] text-muted">of your saves opened</dt>
        </div>
        <div className={cn(tile, 'wr-in p-4 sm:p-5')} style={delay(500, reduced)}>
          <dd className="text-[34px] leading-none font-semibold tracking-[-0.04em] text-fg tabular-nums sm:text-[40px]">{fmtNumber(s.activeDays)}</dd>
          <dt className="mt-2 text-[13px] text-muted">days with a save</dt>
        </div>
        {liked && liked.likes > 0 ? (
          <a
            href={liked.url}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(tile, 'wr-in col-span-2 block p-4 transition-colors duration-150 hover:border-line-strong hover:bg-panel-2 sm:col-span-1 sm:p-5')}
            style={delay(580, reduced)}
          >
            <span className="flex items-center gap-2 text-[34px] leading-none font-semibold tracking-[-0.04em] text-fg tabular-nums sm:text-[40px]">
              {fmtCompact(liked.likes)} <Heart className="size-5 text-muted" strokeWidth={1.75} />
            </span>
            <span className="mt-2 block truncate text-[13px] text-muted">most-liked save · @{liked.authorHandle}</span>
          </a>
        ) : null}
      </dl>
    </div>
  );
}

function PersonaSlide({ s, reduced }: { s: WrappedStats; reduced: boolean }) {
  const p = s.persona;
  const reveal = reduced ? 0 : 700;
  return (
    <div className="flex flex-col">
      <p className={cn(kicker, 'wr-in')} style={delay(0, reduced)}>
        Your bookmark persona
      </p>
      <h2 className="wr-in mt-4 max-w-[14ch] text-[clamp(52px,10.5cqw,128px)] leading-[0.95] font-semibold tracking-[-0.05em] text-balance text-fg" style={delay(reveal, reduced)}>
        {p.name}
        <span className="text-accent">.</span>
      </h2>
      <p className="wr-in mt-6 max-w-[560px] text-[17px] leading-relaxed text-fg-2 sm:text-[20px]" style={delay(reveal + 160, reduced)}>
        <span aria-hidden className="mr-2 text-[0.9em]">
          {p.emoji}
        </span>
        {p.line}
      </p>
      <p className="wr-in mt-3 text-[14px] text-muted" style={delay(reveal + 260, reduced)}>
        {p.reason}
      </p>
      {s.funFacts.length ? (
        <ul className="mt-10 grid w-full max-w-[920px] gap-x-8 sm:mt-12 sm:grid-cols-3">
          {s.funFacts.map((f, i) => (
            <li key={f.id} className="wr-in flex gap-3 border-t border-line py-4 text-[14px] leading-snug text-fg-2" style={delay(reveal + 380 + i * 100, reduced)}>
              <span className="pt-px text-[12px] text-muted tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0">{f.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ShareSlide({ s, reduced, handle, onReplay }: { s: WrappedStats; reduced: boolean; handle?: string | null; onReplay: () => void }) {
  return (
    <div className="flex flex-col">
      <div className="wr-in mb-8 flex flex-wrap items-end justify-between gap-3 sm:mb-10" style={delay(0, reduced)}>
        <div>
          <h2 className="text-[clamp(30px,4.6cqw,44px)] leading-[1.05] font-semibold tracking-[-0.035em] text-fg">Share your Wrapped</h2>
          <p className="mt-2 text-[15px] text-muted">Made on this device. Pick a size and a style.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onReplay} className="text-muted hover:text-fg [&_svg]:stroke-[1.75]">
          <RotateCcw /> Replay
        </Button>
      </div>
      <div className="wr-in" style={delay(100, reduced)}>
        <ShareStudio stats={s} handle={handle} />
      </div>
    </div>
  );
}

function EmptySlide({ s, counts, libraryEmpty, onPeriod }: { s: WrappedStats; counts: Record<WrappedPeriod, number>; libraryEmpty: boolean; onPeriod: (p: WrappedPeriod) => void }) {
  const alt = (['year', '12m', 'all'] as WrappedPeriod[]).find((p) => p !== s.period && counts[p] >= WRAPPED_MIN_POSTS);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const tryDemo = async () => {
    setLoadingDemo(true);
    try {
      const { loadDemoLibrary } = await import('@/lib/demo');
      await loadDemoLibrary();
      toast.success('Sample library loaded', { description: 'Here’s what Wrapped looks like with real saves.' });
    } catch {
      toast.error('Couldn’t load the sample library');
    } finally {
      setLoadingDemo(false);
    }
  };
  return (
    <div className="flex flex-col items-start">
      <Sprout className="wr-in size-7 text-muted" strokeWidth={1.75} aria-hidden />
      <h2 className="wr-in mt-6 text-[clamp(34px,6cqw,60px)] leading-[1.04] font-semibold tracking-[-0.04em] text-fg">Your story is still being written</h2>
      <p className="wr-in mt-4 max-w-[540px] text-[15px] leading-relaxed text-muted sm:text-[16px]">
        {libraryEmpty
          ? 'Sync your X bookmarks and Wrapped turns them into a story: your top topics, favourite accounts, saving habits and your bookmark persona.'
          : `You’ve saved ${s.total === 0 ? 'nothing' : s.total === 1 ? 'one post' : `${s.total} posts`} ${periodPhrase(s)}. Wrapped needs at least ${WRAPPED_MIN_POSTS} to find your patterns.`}
      </p>
      <div className="wr-in mt-8 flex flex-wrap gap-2 [&_svg]:stroke-[1.75]">
        {alt ? (
          <Button variant="primary" onClick={() => onPeriod(alt)}>
            See {alt === 'year' ? s.year : PERIOD_LABEL[alt].long.toLowerCase()} instead <ArrowRight />
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void startSync('bookmark', libraryEmpty ? 'full' : 'quick')}>
            Sync my bookmarks
          </Button>
        )}
        {libraryEmpty ? (
          <Button variant="outline" onClick={() => void tryDemo()} loading={loadingDemo} className="shadow-none">
            Preview with sample data
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Story */

function buildSlides(s: WrappedStats): SlideDef[] {
  if (s.total < WRAPPED_MIN_POSTS) return [{ id: 'empty', title: 'Not enough saves yet', ms: 0 }];
  const out: SlideDef[] = [
    { id: 'intro', title: 'Intro', ms: 5000 },
    { id: 'total', title: 'Total saves', ms: 7500 },
    { id: 'categories', title: 'Top categories', ms: 8000 },
  ];
  if (s.authors.length) out.push({ id: 'authors', title: 'Top accounts', ms: 7500 });
  out.push({ id: 'when', title: 'When you save', ms: 8000 }, { id: 'streak', title: 'Longest streak', ms: 7500 }, { id: 'persona', title: 'Your persona', ms: 11000 }, { id: 'share', title: 'Share', ms: 0 });
  return out;
}

function isInteractive(el: EventTarget | null): boolean {
  return el instanceof Element && !!el.closest('button, a, input, select, textarea, label, [role="switch"], [role="radio"], [role="menu"], [role="menuitem"], [data-no-tap]');
}

function Story({
  s,
  counts,
  period,
  onPeriod,
  handle,
  libraryEmpty,
}: {
  s: WrappedStats;
  counts: Record<WrappedPeriod, number>;
  period: WrappedPeriod;
  onPeriod: (p: WrappedPeriod) => void;
  handle?: string | null;
  libraryEmpty: boolean;
}) {
  const reduced = useReducedMotion();
  const slides = useMemo(() => buildSlides(s), [s]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [run, setRun] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [stageRef, height] = useFillHeight<HTMLDivElement>();
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const i = Math.min(index, slides.length - 1);
  const slide = slides[i]!;
  const autoplay = !reduced && slide.ms > 0;
  const running = autoplay && !paused && !holding && !hidden;

  const go = useCallback(
    (to: number, manual = true) => {
      const next = Math.max(0, Math.min(slides.length - 1, to));
      setIndex(next);
      setRun((r) => r + 1);
      if (manual) setAnnounce(`Slide ${next + 1} of ${slides.length}: ${slides[next]!.title}`);
      scroller.current?.scrollTo({ top: 0 });
    },
    [slides],
  );
  const next = useCallback(() => go(i + 1), [go, i]);
  const prev = useCallback(() => go(i - 1), [go, i]);

  // Restart from the top when the period changes.
  useEffect(() => {
    setIndex(0);
    setRun((r) => r + 1);
  }, [period]);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || useUi.getState().paletteOpen) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable], [role="radiogroup"], [role="menu"], [role="dialog"]')) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if ((e.key === ' ' || e.key === 'k') && !el?.closest('button, a')) {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 || isInteractive(e.target)) return;
    down.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    setHolding(true);
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const d = down.current;
    down.current = null;
    setHolding(false);
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) return dx < 0 ? next() : prev();
    if (performance.now() - d.t > 380 || Math.hypot(dx, dy) > 10 || slide.id === 'share' || slide.id === 'empty') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.3) prev();
    else next();
  };
  const onPointerCancel = () => {
    down.current = null;
    setHolding(false);
  };

  const replay = () => {
    setPaused(false);
    go(0);
  };

  const content =
    slide.id === 'intro' ? (
      <IntroSlide s={s} reduced={reduced} handle={handle} />
    ) : slide.id === 'total' ? (
      <TotalSlide s={s} reduced={reduced} />
    ) : slide.id === 'categories' ? (
      <CategoriesSlide s={s} reduced={reduced} />
    ) : slide.id === 'authors' ? (
      <AuthorsSlide s={s} reduced={reduced} />
    ) : slide.id === 'when' ? (
      <WhenSlide s={s} reduced={reduced} />
    ) : slide.id === 'streak' ? (
      <StreakSlide s={s} reduced={reduced} />
    ) : slide.id === 'persona' ? (
      <PersonaSlide s={s} reduced={reduced} />
    ) : slide.id === 'share' ? (
      <ShareSlide s={s} reduced={reduced} handle={handle} onReplay={replay} />
    ) : (
      <EmptySlide s={s} counts={counts} libraryEmpty={libraryEmpty} onPeriod={onPeriod} />
    );

  const multi = slides.length > 1;
  const chromeBtn =
    'grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-[background-color,color,transform] duration-150 hover:bg-panel-2 hover:text-fg active:scale-[0.96] active:bg-panel-3 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4';

  return (
    <section
      ref={stageRef}
      aria-roledescription="carousel"
      aria-label="Your Wrapped story"
      className="@container relative isolate flex touch-pan-y flex-col overflow-hidden bg-bg text-fg select-none [&_svg.lucide]:stroke-[1.75]"
      style={{ height: height ?? 'calc(100dvh - 48px)' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={() => holding && onPointerCancel()}
    >
      <style>{KEYFRAMES}</style>

      {/* Top chrome: progress + controls */}
      <header className="relative z-10 px-4 pt-3 sm:px-8 sm:pt-5">
        {multi ? (
          <div className="flex gap-1 sm:gap-1.5" aria-hidden>
            {slides.map((x, n) => (
              <div key={x.id} className="h-[2px] flex-1 overflow-hidden rounded-full bg-line-strong">
                {n === i && autoplay ? (
                  <div
                    key={run}
                    className="h-full origin-left rounded-full bg-fg"
                    style={{ animation: `wr-progress ${x.ms}ms linear both`, animationPlayState: running ? 'running' : 'paused' }}
                    onAnimationEnd={() => go(i + 1, false)}
                  />
                ) : (
                  <div className={cn('h-full origin-left rounded-full bg-fg transition-transform duration-300', n <= i ? 'scale-x-100' : 'scale-x-0')} />
                )}
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-1.5 sm:mt-4">
          <div className="mr-auto flex min-w-0 items-center gap-2">
            <Logo className="size-6" />
            <h1 className="sr-only text-[14px] font-semibold tracking-[-0.01em] sm:not-sr-only sm:inline">Wrapped</h1>
          </div>
          <div role="radiogroup" aria-label="Time period" className="flex gap-0.5 rounded-lg border border-line bg-panel p-[3px]">
            {WRAPPED_PERIODS.map((p) => {
              const label = p === 'year' ? String(s.year) : PERIOD_LABEL[p];
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={period === p}
                  onClick={() => onPeriod(p)}
                  className={cn(
                    'min-h-7 rounded-md px-2 text-[12.5px] font-medium whitespace-nowrap tabular-nums transition-colors duration-150 sm:px-2.5',
                    period === p ? 'bg-accent-soft text-accent' : 'text-fg-2 hover:bg-panel-2 hover:text-fg',
                  )}
                >
                  {typeof label === 'string' ? (
                    label
                  ) : (
                    <>
                      <span className="sm:hidden">{label.short}</span>
                      <span className="hidden sm:inline">{label.long}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          {autoplay ? (
            <Tip label={paused ? 'Play' : 'Pause'} shortcut="Space">
              <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play story' : 'Pause story'} className={chromeBtn}>
                {paused ? <Play /> : <Pause />}
              </button>
            </Tip>
          ) : null}
          {multi && slide.id !== 'share' ? (
            <Tip label="Skip to share">
              <button type="button" onClick={() => go(slides.length - 1)} aria-label="Skip to share" className={chromeBtn}>
                <Share2 />
              </button>
            </Tip>
          ) : null}
        </div>
      </header>

      {/* Slide */}
      <div ref={scroller} className="relative z-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <div
          key={`${slide.id}-${period}-${run}`}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${slides.length}: ${slide.title}`}
          className="mx-auto flex min-h-full w-full max-w-[960px] flex-col justify-center px-5 py-8 sm:px-10 sm:py-10"
        >
          {content}
        </div>
      </div>

      {/* Bottom chrome */}
      {multi ? (
        <footer className="relative z-10 flex items-center justify-between gap-3 px-4 pt-1 pb-3 sm:px-8 sm:pb-5">
          <button type="button" onClick={prev} disabled={i === 0} aria-label="Previous slide" className={cn(chromeBtn, 'size-9 border border-line bg-panel')}>
            <ChevronLeft />
          </button>
          <span className="text-[12px] text-muted tabular-nums">
            <span className="hidden sm:inline">{reduced ? 'Use ← → to move' : paused ? 'Paused · Space to resume' : 'Tap, swipe or use ← →'} · </span>
            {i + 1} / {slides.length}
          </span>
          <button type="button" onClick={next} disabled={i === slides.length - 1} aria-label="Next slide" className={cn(chromeBtn, 'size-9 border border-line bg-panel')}>
            <ChevronRight />
          </button>
        </footer>
      ) : null}

      <div className="sr-only" aria-live={running ? 'off' : 'polite'}>
        {announce}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- View */

function defaultPeriod(counts: Record<WrappedPeriod, number>): WrappedPeriod {
  if (counts.year >= WRAPPED_MIN_POSTS) return 'year';
  if (counts['12m'] >= WRAPPED_MIN_POSTS) return '12m';
  return 'all';
}

function StageSkeleton() {
  return (
    <div className="relative h-[calc(100dvh-48px)] overflow-hidden bg-bg lg:h-dvh" aria-busy="true" aria-label="Loading your Wrapped">
      <div className="flex gap-1.5 px-4 pt-3 sm:px-8 sm:pt-5">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-[2px] flex-1 rounded-full bg-line-strong" />
        ))}
      </div>
      <div className="relative mx-auto flex h-full max-w-[960px] flex-col justify-center gap-5 px-5 sm:px-10">
        <div className="skeleton h-4 w-40 rounded" />
        <div className="skeleton h-32 w-3/4 rounded-xl" />
        <div className="skeleton h-4 w-1/2 rounded" />
      </div>
    </div>
  );
}

export function WrappedView() {
  const lib = useLibrary();
  const route = useRoute();
  const viewer = useStorageItem(viewerItem, null);
  const ready = !lib.loading && !lib.partial;

  const counts = useMemo(() => countByPeriod(lib.bookmarks), [lib.bookmarks]);
  const fromRoute = WRAPPED_PERIODS.includes(route.section as WrappedPeriod) ? (route.section as WrappedPeriod) : null;
  const [chosen, setChosen] = useState<WrappedPeriod | null>(fromRoute);
  const period = chosen ?? defaultPeriod(counts);

  const stats = useMemo(() => {
    const t0 = performance.now();
    const s = computeWrapped(lib.bookmarks, { period, categories: lib.categories });
    perfStat('wrapped', performance.now() - t0);
    return s;
  }, [lib.bookmarks, lib.categories, period]);

  usePaintMark('route:wrapped:painted', ready, period);

  if (!ready) return <StageSkeleton />;
  return <Story s={stats} counts={counts} period={period} onPeriod={setChosen} handle={viewer?.handle} libraryEmpty={!lib.counts.total} />;
}
