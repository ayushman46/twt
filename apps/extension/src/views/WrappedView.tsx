/**
 * Wrapped — a story-style recap of what the user saved on X, ending in a
 * shareable image (the growth loop). Tap/click or ←/→ to move, Space to pause.
 */
import { ArrowRight, ChevronLeft, ChevronRight, Heart, Pause, Play, RotateCcw, Share2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import { Avatar, Logo } from '@/components/Brand';
import { ShareStudio } from '@/components/ShareCard';
import { startSync } from '@/components/SyncControl';
import { cn } from '@/components/ui/primitives';
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

/** Each slide gets its own mood; layers cross-fade between them. */
const PALETTES: Record<SlideId, string> = {
  intro:
    'radial-gradient(110% 75% at 8% 0%, #7B61FF 0%, transparent 62%), radial-gradient(90% 70% at 100% 100%, #FF5C9D 0%, transparent 58%), linear-gradient(160deg, #1c0c44 0%, #2f1066 50%, #13072e 100%)',
  total:
    'radial-gradient(100% 75% at 92% 6%, #B14CF2 0%, transparent 60%), radial-gradient(85% 65% at 0% 100%, #7B61FF 0%, transparent 62%), linear-gradient(150deg, #3a1a8c 0%, #251062 58%, #150a39 100%)',
  categories:
    'radial-gradient(95% 75% at 0% 0%, #4F6BFF 0%, transparent 60%), radial-gradient(85% 70% at 100% 95%, #8B61FF 0%, transparent 60%), linear-gradient(160deg, #0e1a52 0%, #1b1d6e 55%, #0a0e35 100%)',
  authors:
    'radial-gradient(95% 75% at 100% 0%, #FF5C9D 0%, transparent 58%), radial-gradient(85% 70% at 0% 100%, #B14CF2 0%, transparent 60%), linear-gradient(160deg, #4d0e52 0%, #3b0c47 55%, #1f0628 100%)',
  when:
    'radial-gradient(80% 65% at 82% 12%, #5865FF 0%, transparent 60%), radial-gradient(70% 60% at 8% 100%, #7B61FFaa 0%, transparent 60%), linear-gradient(170deg, #070c33 0%, #0d1552 60%, #050826 100%)',
  streak:
    'radial-gradient(90% 70% at 12% 0%, #FF8A3D 0%, transparent 58%), radial-gradient(90% 70% at 100% 100%, #FF5C9D 0%, transparent 60%), linear-gradient(160deg, #5c1030 0%, #7a1838 50%, #2c0717 100%)',
  persona:
    'radial-gradient(60% 55% at 50% 38%, rgb(255 255 255 / 0.2) 0%, transparent 70%), linear-gradient(180deg, transparent 40%, rgb(30 8 60 / 0.42) 100%), linear-gradient(135deg, #7B61FF 0%, #B14CF2 55%, #FF5C9D 100%)',
  share:
    'radial-gradient(80% 60% at 15% 0%, #7B61FF66 0%, transparent 60%), radial-gradient(70% 60% at 100% 100%, #FF5C9D55 0%, transparent 60%), linear-gradient(160deg, #110c24 0%, #160e2e 60%, #09070f 100%)',
  empty:
    'radial-gradient(110% 75% at 8% 0%, #7B61FF 0%, transparent 62%), radial-gradient(90% 70% at 100% 100%, #FF5C9D99 0%, transparent 58%), linear-gradient(160deg, #1c0c44 0%, #2f1066 50%, #13072e 100%)',
};

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const KEYFRAMES = `
@keyframes wr-progress { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes wr-drift-a { 0% { transform: translate3d(-8%, -6%, 0) scale(1) } 100% { transform: translate3d(10%, 8%, 0) scale(1.18) } }
@keyframes wr-drift-b { 0% { transform: translate3d(8%, 6%, 0) scale(1.12) } 100% { transform: translate3d(-10%, -8%, 0) scale(.94) } }
@keyframes wr-in { from { opacity: 0; transform: translateY(22px); filter: blur(8px) } to { opacity: 1; transform: none; filter: blur(0) } }
@keyframes wr-pop { 0% { opacity: 0; transform: scale(.3) rotate(-14deg) } 60% { opacity: 1; transform: scale(1.12) rotate(5deg) } 100% { opacity: 1; transform: none } }
@keyframes wr-grow-x { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes wr-grow-y { from { transform: scaleY(0) } to { transform: scaleY(1) } }
@keyframes wr-dash { from { stroke-dashoffset: 1; opacity: 0 } 20% { opacity: 1 } to { stroke-dashoffset: 0; opacity: 1 } }
@keyframes wr-dot { from { opacity: .12; transform: scale(.5) } to { opacity: 1; transform: none } }
@keyframes wr-fade-out { 0%, 70% { opacity: 1 } 100% { opacity: 0; transform: translateY(-14px) } }
.wr-in { animation: wr-in .8s cubic-bezier(.16, 1, .3, 1) both }
.wr-pop { animation: wr-pop .9s cubic-bezier(.34, 1.56, .64, 1) both }
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
function CountUp({ value, reduced, duration = 1500, format = fmtNumber }: { value: number; reduced: boolean; duration?: number; format?: (n: number) => string }) {
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

const eyebrow = 'text-[11.5px] font-semibold tracking-[0.18em] text-white/70 uppercase sm:text-[12.5px]';
const glassCard = 'rounded-2xl bg-white/[0.08] ring-1 ring-white/15 backdrop-blur-md';

/* ----------------------------------------------------------------- Slides */

function IntroSlide({ s, reduced, handle }: { s: WrappedStats; reduced: boolean; handle?: string | null }) {
  const big = s.period === 'year' ? s.label : s.period === '12m' ? '12 months' : s.period === '30d' ? '30 days' : 'All time';
  return (
    <div className="flex flex-col items-start">
      <div className="wr-in inline-flex items-center gap-2 rounded-full bg-white/10 py-1.5 pr-3.5 pl-1.5 text-[12.5px] font-medium ring-1 ring-white/20 backdrop-blur" style={delay(0, reduced)}>
        <Logo className="size-6" />
        twtdash Wrapped{handle ? <span className="text-white/60">· @{handle}</span> : null}
      </div>
      <p className="wr-in mt-6 text-[clamp(26px,5cqw,48px)] leading-[1.05] font-semibold tracking-[-0.04em] text-white/90" style={delay(120, reduced)}>
        {s.period === 'all' ? 'Your X bookmarks,' : 'Your'}
      </p>
      <h2
        className="wr-in serif-accent -my-[0.06em] bg-gradient-to-br from-white via-white to-[#ffc2dc] bg-clip-text pr-[0.08em] text-[clamp(96px,24cqw,280px)] leading-[0.9] tracking-[-0.03em] text-transparent drop-shadow-[0_20px_60px_rgb(255_92_157/0.35)]"
        style={delay(220, reduced)}
      >
        {big}
      </h2>
      <p className="wr-in text-[clamp(26px,5cqw,48px)] leading-[1.05] font-semibold tracking-[-0.04em] text-white/90" style={delay(340, reduced)}>
        {s.period === 'all' ? 'wrapped.' : 'on X, wrapped.'}
      </p>
      <p className="wr-in mt-6 max-w-[520px] text-[15px] leading-relaxed text-white/75 sm:text-[17px]" style={delay(520, reduced)}>
        {fmtNumber(s.total)} saves, {s.categoryCount} {s.categoryCount === 1 ? 'interest' : 'interests'}, {fmtNumber(s.authorCount)} {s.authorCount === 1 ? 'voice' : 'voices'} — and one very specific personality. Let’s unwrap it.
      </p>
      <div className="wr-in mt-8 inline-flex items-center gap-2 text-[13px] font-medium text-white/70" style={delay(700, reduced)}>
        <span className="grid size-8 place-items-center rounded-full bg-white text-[#1c0c44]">
          <ArrowRight className="size-4" />
        </span>
        Tap anywhere or press → to begin
      </div>
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
      <p className={cn(eyebrow, 'wr-in')} style={delay(0, reduced)}>
        {periodPhrase(s)} you saved
      </p>
      <div className="wr-in mt-2 flex flex-wrap items-baseline gap-x-5" style={delay(100, reduced)}>
        <span className="font-serif text-[clamp(96px,22cqw,240px)] leading-[0.86] tracking-[-0.035em] text-white drop-shadow-[0_24px_60px_rgb(20_0_60/0.45)]">
          <CountUp value={s.total} reduced={reduced} />
        </span>
        <span className="serif-accent text-[clamp(34px,6cqw,64px)] text-white/85">{s.total === 1 ? 'post' : 'posts'}</span>
      </div>
      <div className="wr-in mt-5 flex flex-wrap items-center gap-2.5 text-[14px] text-white/80 sm:text-[15.5px]" style={delay(260, reduced)}>
        <span>{perDay ? `That’s ${perDay} a day.` : `About ${perWeek} a week.`}</span>
        {change !== undefined && change !== null && s.previous ? (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1', change >= 0 ? 'bg-emerald-300/15 text-emerald-100 ring-emerald-200/25' : 'bg-white/10 text-white/85 ring-white/20')}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(Math.round(change * 100))}% vs {s.previous.label}
          </span>
        ) : s.previous && s.previous.total === 0 && s.total > 0 ? (
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-white/20">New era — nothing saved {s.previous.label}</span>
        ) : null}
      </div>

      {buckets.length > 1 ? (
        <figure className="wr-in mt-8 sm:mt-10" style={delay(380, reduced)}>
          <div className="flex h-[clamp(88px,18cqh,170px)] items-end gap-[3px] sm:gap-1.5" role="img" aria-label={`Saves per ${unitWord}. Peak: ${buckets[peak]!.label} with ${buckets[peak]!.count}.`}>
            {buckets.map((b, i) => (
              <div key={b.key} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div
                  className={cn('origin-bottom rounded-t-[5px] [animation:wr-grow-y_.9s_cubic-bezier(.16,1,.3,1)_both]', i === peak ? 'bg-white shadow-[0_0_30px_rgb(255_255_255/0.45)]' : 'bg-white/30')}
                  style={{ height: `${Math.max(3, (b.count / max) * 100)}%`, ...delay(420 + i * (600 / buckets.length), reduced) }}
                />
              </div>
            ))}
          </div>
          {buckets.length <= 14 ? (
            <div className="mt-2 flex gap-[3px] sm:gap-1.5">
              {buckets.map((b, i) => (
                <span key={b.key} className={cn('min-w-0 flex-1 truncate text-center text-[10px] sm:text-[11px]', i === peak ? 'font-semibold text-white' : 'text-white/50')}>
                  {b.label}
                </span>
              ))}
            </div>
          ) : null}
          <figcaption className="mt-4 text-[14px] text-white/80 sm:text-[15px]">
            {s.timeline.unit === 'day' ? (
              <>
                Your biggest day: <b className="font-semibold text-white">{buckets[peak]!.label}</b> · {fmtNumber(buckets[peak]!.count)} saves
              </>
            ) : s.busiestMonth ? (
              <>
                <b className="font-semibold text-white">{s.busiestMonth.label.replace(` ${s.year}`, '')}</b> was your biggest month · {fmtNumber(s.busiestMonth.count)} saves
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
      <p className={cn(eyebrow, 'wr-in')} style={delay(0, reduced)}>
        Your feed had a type
      </p>
      <h2 className="wr-in mt-3 text-[clamp(30px,6cqw,60px)] leading-[1.02] font-semibold tracking-[-0.045em]" style={delay(100, reduced)}>
        {top.share >= 0.3 ? 'Mostly' : 'Led by'} <span className="whitespace-nowrap">{top.emoji}</span> <span className="serif-accent font-normal">{top.name}</span>
      </h2>
      <p className="wr-in mt-2 text-[14px] text-white/75 sm:text-[15.5px]" style={delay(180, reduced)}>
        {Math.round(top.share * 100)}% of everything you saved · {s.categoryCount} categories in all
      </p>
      <ol className="mt-7 space-y-2.5 sm:mt-9 sm:space-y-3.5">
        {s.categories.map((c, i) => (
          <li key={c.id} className="wr-in grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[34px_minmax(0,1fr)_auto] sm:gap-x-4" style={delay(260 + i * 110, reduced)}>
            <span className="text-center font-serif text-[22px] text-white/55 tabular-nums sm:text-[26px]">{i + 1}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[15px] font-medium sm:text-[17px]">
                <span aria-hidden>{c.emoji}</span>
                <span className="truncate">{c.name}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/12 sm:h-2.5">
                <div
                  className="h-full origin-left rounded-full [animation:wr-grow-x_1s_cubic-bezier(.16,1,.3,1)_both]"
                  style={{ width: `${Math.max(3, (c.share / max) * 100)}%`, background: `linear-gradient(90deg, color-mix(in oklab, ${c.color} 70%, white), white)`, ...delay(380 + i * 110, reduced) }}
                />
              </div>
            </div>
            <span className="w-14 text-right text-[15px] font-semibold tabular-nums sm:text-[17px]">{Math.max(1, Math.round(c.share * 100))}%</span>
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
      <p className={cn(eyebrow, 'wr-in')} style={delay(0, reduced)}>
        The voices you kept coming back to
      </p>
      <div className="wr-in mt-5 flex items-center gap-4 sm:mt-6 sm:gap-6" style={delay(120, reduced)}>
        <div className="relative shrink-0">
          <span aria-hidden className="absolute -inset-3 rounded-full bg-white/25 blur-xl" />
          <Avatar src={top.avatar} name={top.name} handle={top.handle} size={88} className="relative ring-4 ring-white/70 max-sm:!size-[68px] max-sm:!text-[24px]" />
          <span className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full bg-white text-[13px] font-bold text-[#4d0e52] shadow-lg">#1</span>
        </div>
        <div className="min-w-0">
          <div className="truncate text-[clamp(26px,5.4cqw,52px)] leading-[1.05] font-semibold tracking-[-0.04em]">{top.name || top.handle}</div>
          <div className="mt-1 truncate text-[14px] text-white/70 sm:text-[16px]">@{top.handle}</div>
        </div>
      </div>
      <p className="wr-in mt-4 text-[15px] text-white/85 sm:text-[17px]" style={delay(220, reduced)}>
        <b className="font-serif text-[1.5em] font-normal text-white">{fmtNumber(top.count)}</b> of your saves — that’s 1 in every {Math.max(1, Math.round(s.total / top.count))}.
      </p>
      {rest.length ? (
        <ol className="mt-6 grid gap-2 sm:mt-8 sm:grid-cols-2 sm:gap-3">
          {rest.map((a, i) => (
            <li key={a.handle} className={cn(glassCard, 'wr-in flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3')} style={delay(320 + i * 100, reduced)}>
              <span className="w-5 text-center font-serif text-[20px] text-white/55">{i + 2}</span>
              <Avatar src={a.avatar} name={a.name} handle={a.handle} size={36} className="ring-2 ring-white/30" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{a.name || a.handle}</div>
                <div className="truncate text-[12px] text-white/60">@{a.handle}</div>
              </div>
              <span className="text-[14px] font-semibold tabular-nums">{fmtNumber(a.count)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <p className="wr-in mt-5 text-[13px] text-white/60" style={delay(760, reduced)}>
        You saved posts from {fmtNumber(s.authorCount)} different {s.authorCount === 1 ? 'account' : 'accounts'}.
      </p>
    </div>
  );
}

function timeOfDayLine(h: number): string {
  if (h >= 5 && h < 12) return 'Morning person — you save with your first chai.';
  if (h >= 12 && h < 17) return 'Post-lunch scrolling is your research hour.';
  if (h >= 17 && h < 22) return 'Evenings are when you catch up on the world.';
  return 'Sleep can wait. The timeline can’t.';
}

function HourClock({ hours, peak, reduced }: { hours: number[]; peak: number; reduced: boolean }) {
  const max = Math.max(1, ...hours);
  const r0 = 70;
  const len = 74;
  return (
    <svg viewBox="-182 -182 364 364" className="w-[min(78cqw,330px)] shrink-0 overflow-visible max-sm:w-[min(62cqw,240px)]" role="img" aria-label={`Saves by hour of day. Peak at ${hourLabel(peak)}.`}>
      <circle r={r0 - 10} fill="rgb(255 255 255 / 0.06)" stroke="rgb(255 255 255 / 0.12)" />
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
            stroke={h === peak ? '#fff' : 'rgb(255 255 255 / 0.38)'}
            strokeWidth={h === peak ? 11 : 9}
            strokeLinecap="round"
            style={{ animation: 'wr-dash .8s cubic-bezier(.16,1,.3,1) both', ...delay(300 + h * 35, reduced), filter: h === peak ? 'drop-shadow(0 0 10px rgb(255 255 255 / 0.7))' : undefined }}
          />
        );
      })}
      {[0, 6, 12, 18].map((h) => {
        const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
        return (
          <text key={h} x={Math.cos(a) * 170} y={Math.sin(a) * 170 + 4} textAnchor="middle" fontSize="12" fill="rgb(255 255 255 / 0.55)" fontWeight="600">
            {hourLabel(h).replace(' ', '').toLowerCase()}
          </text>
        );
      })}
      <text y="2" textAnchor="middle" fontSize="38" fill="#fff" style={{ fontFamily: 'var(--font-serif)' }}>
        {hourLabel(peak)}
      </text>
      <text y="26" textAnchor="middle" fontSize="11" fill="rgb(255 255 255 / 0.6)" fontWeight="600" letterSpacing="2">
        PEAK
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
    <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:gap-12">
      <div className="wr-in order-2 flex justify-center sm:order-1" style={delay(160, reduced)}>
        <HourClock hours={s.hours} peak={peak.hour} reduced={reduced} />
      </div>
      <div className="order-1 min-w-0 flex-1 sm:order-2">
        <p className={cn(eyebrow, 'wr-in')} style={delay(0, reduced)}>
          When you save
        </p>
        <h2 className="wr-in mt-3 text-[clamp(30px,5.6cqw,56px)] leading-[1.02] font-semibold tracking-[-0.045em]" style={delay(80, reduced)}>
          Your hour is <span className="serif-accent font-normal whitespace-nowrap">{peak.label}</span>
        </h2>
        <p className="wr-in mt-3 text-[15px] text-white/80 sm:text-[17px]" style={delay(160, reduced)}>
          {timeOfDayLine(peak.hour)}
        </p>
        <div className="wr-in mt-6 sm:mt-8" style={delay(260, reduced)}>
          <div className="flex h-[74px] items-end gap-1.5 sm:h-[96px] sm:gap-2" role="img" aria-label={`Saves by weekday. Busiest: ${day.label}.`}>
            {WEEK_ORDER.map((d, i) => (
              <div key={d} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <div
                  className={cn('w-full origin-bottom rounded-[6px] [animation:wr-grow-y_.8s_cubic-bezier(.16,1,.3,1)_both]', d === day.day ? 'bg-white' : 'bg-white/25')}
                  style={{ height: `${Math.max(4, (s.weekdays[d]! / wmax) * 100)}%`, ...delay(360 + i * 60, reduced) }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5 sm:gap-2">
            {WEEK_ORDER.map((d) => (
              <span key={d} className={cn('flex-1 text-center text-[11px] font-semibold', d === day.day ? 'text-white' : 'text-white/45')}>
                {WEEK_SHORT[d]}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[14px] text-white/80 sm:text-[15px]">
            <b className="font-semibold text-white">{day.label}s</b> are for saving — {fmtNumber(day.count)} of your posts landed on one.
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
      <p className={cn(eyebrow, 'wr-in')} style={delay(0, reduced)}>
        Your longest streak
      </p>
      <div className="wr-in mt-2 flex flex-wrap items-baseline gap-x-4" style={delay(100, reduced)}>
        <span className="font-serif text-[clamp(110px,24cqw,260px)] leading-[0.86] tracking-[-0.035em] drop-shadow-[0_24px_60px_rgb(80_0_20/0.45)]">
          <CountUp value={days} reduced={reduced} duration={1100} />
        </span>
        <span className="serif-accent text-[clamp(32px,6cqw,62px)] text-white/90">{days === 1 ? 'day' : 'days in a row'} 🔥</span>
      </div>
      <p className="wr-in mt-3 text-[15px] text-white/80 sm:text-[17px]" style={delay(200, reduced)}>
        {days > 1 ? (
          <>
            From <b className="font-semibold text-white">{s.streak!.startLabel}</b> to <b className="font-semibold text-white">{s.streak!.endLabel}</b>, you saved something every single day.
          </>
        ) : (
          'Consistency era loading… one save a day and next year’s streak is yours.'
        )}
      </p>
      {days > 1 ? (
        <div className="wr-in mt-5 flex max-w-[620px] flex-wrap gap-1.5" aria-hidden style={delay(260, reduced)}>
          {Array.from({ length: dots }, (_, i) => (
            <span key={i} className="size-3.5 rounded-full bg-gradient-to-br from-[#FFD27A] to-[#FF5C9D] shadow-[0_0_12px_rgb(255_160_80/0.6)] [animation:wr-dot_.45s_ease-out_both] sm:size-4" style={delay(320 + i * 40, reduced)} />
          ))}
          {days > dots ? <span className="ml-1 self-center text-[12px] font-semibold text-white/80">+{days - dots}</span> : null}
        </div>
      ) : null}
      <div className="mt-7 grid grid-cols-2 gap-2.5 sm:mt-9 sm:grid-cols-3 sm:gap-3">
        <div className={cn(glassCard, 'wr-in p-3.5 sm:p-4')} style={delay(520, reduced)}>
          <div className="font-serif text-[34px] leading-none sm:text-[42px]">{Math.round(s.readShare * 100)}%</div>
          <div className="mt-1.5 text-[12.5px] text-white/70">of your saves opened</div>
        </div>
        <div className={cn(glassCard, 'wr-in p-3.5 sm:p-4')} style={delay(600, reduced)}>
          <div className="font-serif text-[34px] leading-none sm:text-[42px]">{fmtNumber(s.activeDays)}</div>
          <div className="mt-1.5 text-[12.5px] text-white/70">days with a save</div>
        </div>
        {liked && liked.likes > 0 ? (
          <a
            href={liked.url}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(glassCard, 'wr-in col-span-2 block p-3.5 transition-colors hover:bg-white/[0.14] sm:col-span-1 sm:p-4')}
            style={delay(680, reduced)}
          >
            <div className="flex items-center gap-1.5 font-serif text-[34px] leading-none sm:text-[42px]">
              {fmtCompact(liked.likes)} <Heart className="size-5 fill-white/90 text-white/90" />
            </div>
            <div className="mt-1.5 truncate text-[12.5px] text-white/70">most-liked save · @{liked.authorHandle}</div>
          </a>
        ) : null}
      </div>
    </div>
  );
}

function PersonaSlide({ s, reduced }: { s: WrappedStats; reduced: boolean }) {
  const p = s.persona;
  const reveal = reduced ? 0 : 1100;
  return (
    <div className="flex flex-col items-center text-center">
      <p className={cn(eyebrow, 'wr-in text-white/80')} style={delay(0, reduced)}>
        Your bookmark persona is…
      </p>
      <div className="wr-pop mt-5 text-[clamp(72px,14cqw,128px)] leading-none drop-shadow-[0_18px_40px_rgb(40_0_80/0.45)] sm:mt-6" style={delay(reveal, reduced)} aria-hidden>
        {p.emoji}
      </div>
      <h2 className="wr-in serif-accent mt-3 max-w-[16ch] pr-[0.06em] text-[clamp(52px,10.5cqw,128px)] leading-[0.95] text-balance text-white drop-shadow-[0_20px_50px_rgb(40_0_80/0.4)]" style={delay(reveal + 150, reduced)}>
        {p.name}
      </h2>
      <p className="wr-in mt-4 max-w-[560px] text-[16px] leading-relaxed font-medium text-white/90 sm:text-[19px]" style={delay(reveal + 300, reduced)}>
        {p.line}
      </p>
      <p className="wr-in mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1 text-[12.5px] text-white/85 ring-1 ring-white/20" style={delay(reveal + 420, reduced)}>
        <Sparkles className="size-3.5" /> {p.reason}
      </p>
      {s.funFacts.length ? (
        <ul className="mt-7 grid w-full max-w-[880px] gap-2.5 text-left sm:mt-9 sm:grid-cols-3 sm:gap-3">
          {s.funFacts.map((f, i) => (
            <li key={f.id} className="wr-in flex items-start gap-2.5 rounded-2xl bg-black/15 p-3.5 ring-1 ring-white/20 backdrop-blur-md sm:p-4" style={delay(reveal + 560 + i * 120, reduced)}>
              <span className="text-[20px] leading-none" aria-hidden>
                {f.emoji}
              </span>
              <span className="text-[13.5px] leading-snug text-white/90 sm:text-[14px]">{f.text}</span>
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
      <div className="wr-in mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8" style={delay(0, reduced)}>
        <div>
          <p className={eyebrow}>That’s a wrap</p>
          <h2 className="mt-2 text-[clamp(28px,4.6cqw,46px)] leading-[1.05] font-semibold tracking-[-0.045em]">
            Share your <span className="serif-accent font-normal">Wrapped</span>
          </h2>
          <p className="mt-1.5 text-[14px] text-white/70 sm:text-[15px]">Show the timeline what you’re made of.</p>
        </div>
        <button type="button" onClick={onReplay} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[13px] font-medium ring-1 ring-white/15 hover:bg-white/15">
          <RotateCcw className="size-3.5" /> Replay
        </button>
      </div>
      <div className="wr-in" style={delay(120, reduced)}>
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
      <div className="wr-pop text-[72px] leading-none" aria-hidden>
        🌱
      </div>
      <h2 className="wr-in mt-5 text-[clamp(34px,6.4cqw,64px)] leading-[1.02] font-semibold tracking-[-0.045em]">
        Your story is <span className="serif-accent font-normal">still being written</span>
      </h2>
      <p className="wr-in mt-4 max-w-[540px] text-[15px] leading-relaxed text-white/80 sm:text-[17px]">
        {libraryEmpty
          ? 'Sync your X bookmarks and Wrapped turns them into a story — your top topics, favourite accounts, saving habits and your bookmark persona.'
          : `You’ve saved ${s.total === 0 ? 'nothing' : s.total === 1 ? 'one post' : `${s.total} posts`} ${periodPhrase(s)}. Wrapped needs at least ${WRAPPED_MIN_POSTS} to find your patterns.`}
      </p>
      <div className="wr-in mt-7 flex flex-wrap gap-2.5">
        {alt ? (
          <button type="button" onClick={() => onPeriod(alt)} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-5 text-[14.5px] font-semibold text-[#1c0c44] hover:brightness-95">
            See {alt === 'year' ? s.year : PERIOD_LABEL[alt].long.toLowerCase()} instead <ArrowRight className="size-4" />
          </button>
        ) : (
          <button type="button" onClick={() => void startSync('bookmark', libraryEmpty ? 'full' : 'quick')} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-5 text-[14.5px] font-semibold text-[#1c0c44] hover:brightness-95">
            Sync my bookmarks <ArrowRight className="size-4" />
          </button>
        )}
        {libraryEmpty ? (
          <button type="button" onClick={() => void tryDemo()} disabled={loadingDemo} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white/10 px-5 text-[14.5px] font-medium ring-1 ring-white/20 hover:bg-white/15 disabled:opacity-60">
            Preview with sample data
          </button>
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

  const usedPalettes = useMemo(() => [...new Set(slides.map((x) => x.id))], [slides]);
  const multi = slides.length > 1;

  return (
    <section
      ref={stageRef}
      aria-roledescription="carousel"
      aria-label="Your Wrapped story"
      className="@container relative isolate flex touch-pan-y flex-col overflow-hidden bg-[#13072e] text-white select-none"
      style={{ height: height ?? 'calc(100dvh - 48px)' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={() => holding && onPointerCancel()}
    >
      <style>{KEYFRAMES}</style>

      {/* Background: per-slide palettes cross-fade, aurora drifts, grain on top. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {usedPalettes.map((id) => (
          <div key={id} className="absolute inset-0 transition-opacity duration-700 ease-out" style={{ background: PALETTES[id], opacity: id === slide.id ? 1 : 0 }} />
        ))}
        <div className="absolute -top-1/3 -left-1/4 size-[85cqw] max-h-[900px] max-w-[900px] rounded-full opacity-50 mix-blend-soft-light [animation:wr-drift-a_22s_ease-in-out_infinite_alternate]" style={{ background: 'radial-gradient(closest-side, rgb(255 255 255 / 0.55), transparent)' }} />
        <div className="absolute -right-1/4 -bottom-1/3 size-[80cqw] max-h-[900px] max-w-[900px] rounded-full opacity-60 mix-blend-screen [animation:wr-drift-b_26s_ease-in-out_infinite_alternate]" style={{ background: 'radial-gradient(closest-side, rgb(255 92 157 / 0.35), transparent)' }} />
        <div className="absolute inset-0 opacity-[0.14] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 40%, transparent 55%, rgb(8 2 24 / 0.38))' }} />
      </div>

      {/* Top chrome: progress + controls */}
      <header className="relative z-10 px-4 pt-3 sm:px-8 sm:pt-5">
        {multi ? (
          <div className="flex gap-1 sm:gap-1.5" aria-hidden>
            {slides.map((x, n) => (
              <div key={x.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
                {n === i && autoplay ? (
                  <div
                    key={run}
                    className="h-full origin-left rounded-full bg-white"
                    style={{ animation: `wr-progress ${x.ms}ms linear both`, animationPlayState: running ? 'running' : 'paused' }}
                    onAnimationEnd={() => go(i + 1, false)}
                  />
                ) : (
                  <div className={cn('h-full origin-left rounded-full bg-white transition-transform duration-300', n <= i ? 'scale-x-100' : 'scale-x-0')} />
                )}
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-2 sm:mt-4">
          <div className="flex min-w-0 items-center gap-2">
            <Logo className="size-6 sm:size-7" />
            <span className="hidden text-[14px] font-semibold tracking-[-0.02em] sm:inline">
              Wrapped
            </span>
          </div>
          <div role="radiogroup" aria-label="Time period" className="ml-auto flex rounded-full bg-black/20 p-0.5 ring-1 ring-white/15 backdrop-blur-md">
            {WRAPPED_PERIODS.map((p) => {
              const label = p === 'year' ? String(s.year) : PERIOD_LABEL[p];
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={period === p}
                  onClick={() => onPeriod(p)}
                  className={cn('h-7 rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap transition-colors sm:h-8 sm:px-3.5 sm:text-[12.5px]', period === p ? 'bg-white text-[#1c0c44]' : 'text-white/75 hover:text-white')}
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
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Play story' : 'Pause story'}
              title={paused ? 'Play (Space)' : 'Pause (Space)'}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-black/20 ring-1 ring-white/15 backdrop-blur-md hover:bg-black/30 sm:size-9"
            >
              {paused ? <Play className="size-4 fill-current" /> : <Pause className="size-4 fill-current" />}
            </button>
          ) : null}
          {multi && slide.id !== 'share' ? (
            <button
              type="button"
              onClick={() => go(slides.length - 1)}
              aria-label="Skip to share"
              title="Skip to share"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#1c0c44] shadow-lg hover:brightness-95 sm:size-9"
            >
              <Share2 className="size-4" />
            </button>
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
          className="mx-auto flex min-h-full w-full max-w-[960px] flex-col justify-center px-5 py-6 sm:px-10 sm:py-8"
        >
          {content}
        </div>
      </div>

      {/* Bottom chrome */}
      {multi ? (
        <footer className="relative z-10 flex items-center justify-between gap-3 px-4 pt-1 pb-3 sm:px-8 sm:pb-5">
          <button type="button" onClick={prev} disabled={i === 0} aria-label="Previous slide" className="grid size-10 place-items-center rounded-full bg-black/20 ring-1 ring-white/15 backdrop-blur-md transition-opacity hover:bg-black/30 disabled:opacity-30">
            <ChevronLeft className="size-5" />
          </button>
          <span className="text-[12px] font-medium text-white/60 tabular-nums">
            <span className="hidden sm:inline">{reduced ? 'Use ← → to move' : paused ? 'Paused · Space to resume' : 'Tap, swipe or use ← →'} · </span>
            {i + 1} / {slides.length}
          </span>
          <button type="button" onClick={next} disabled={i === slides.length - 1} aria-label="Next slide" className="grid size-10 place-items-center rounded-full bg-white/90 text-[#1c0c44] transition-opacity hover:bg-white disabled:opacity-30">
            <ChevronRight className="size-5" />
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
    <div className="relative h-[calc(100dvh-48px)] overflow-hidden bg-[#13072e] lg:h-dvh" aria-busy="true" aria-label="Loading your Wrapped">
      <div className="absolute inset-0" style={{ background: PALETTES.intro }} />
      <div className="relative mx-auto flex h-full max-w-[960px] flex-col justify-center gap-5 px-5 sm:px-10">
        <div className="h-8 w-48 animate-pulse rounded-full bg-white/15" />
        <div className="h-36 w-3/4 animate-pulse rounded-3xl bg-white/10" />
        <div className="h-5 w-1/2 animate-pulse rounded-full bg-white/10" />
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
