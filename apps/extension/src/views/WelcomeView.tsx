import { ArrowRight, Bookmark, FileUp, FlaskConical, Languages, Lock, MousePointerClick, RefreshCw, Sparkles, Zap } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { DEFAULT_CATEGORIES } from '@twtdash/shared';
import { catName, isLocale, LANGUAGES, setLocale, t, tOr, useLocale, useT, type MessageKey } from '@/i18n';
import { loadDemoLibrary } from '@/lib/demo';
import { importJson } from '@/lib/export';
import { fmtNumber } from '@/lib/format';
import { isSyncActive, updateSettings, type Settings } from '@/lib/storage';
import { navigate } from '@/hooks/route';
import { useLibrary } from '@/hooks/library';
import { useSyncState } from '@/hooks/data';
import { Logo } from '@/components/Brand';
import { startSync } from '@/components/SyncControl';
import { Button, Eyebrow } from '@/components/ui/primitives';

const STEPS: Array<{ icon: ReactNode; title: MessageKey; body: MessageKey }> = [
  { icon: <MousePointerClick />, title: 'welcome.step1', body: 'welcome.step1Body' },
  { icon: <RefreshCw />, title: 'welcome.step2', body: 'welcome.step2Body' },
  { icon: <Sparkles />, title: 'welcome.step3', body: 'welcome.step3Body' },
];

const PREVIEW = [
  { emoji: '🤖', cat: () => tOr('cat.ai', 'AI & ML'), color: '#8B5CF6', name: 'Maya Chen', text: 'welcome.preview1' },
  { emoji: '🎨', cat: () => tOr('cat.design', 'Design & UI'), color: '#EC4899', name: 'Priya Raman', text: 'welcome.preview2' },
  { emoji: '🚀', cat: () => tOr('cat.startups', 'Startups'), color: '#F97316', name: 'Leo Fischer', text: 'welcome.preview3' },
] as const;

/** First-run language switch (the full picker lives in Settings → General). */
function LanguageSwitch({ settings }: { settings: Settings }) {
  const locale = useLocale();
  return (
    <label className="absolute top-4 right-4 z-10 inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-panel/80 pr-1 pl-2.5 text-[12.5px] text-muted shadow-card backdrop-blur">
      <Languages className="size-3.5" aria-hidden />
      <span className="sr-only">{t('settings.language')}</span>
      <select
        value={settings.language === 'auto' ? locale : settings.language}
        onChange={(e) => {
          const v = e.target.value;
          if (!isLocale(v)) return;
          void setLocale(v);
          void updateSettings({ language: v });
        }}
        className="h-full cursor-pointer rounded-full bg-transparent pr-1 text-fg outline-none"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.native}
            {l.native !== l.name ? ` · ${l.name}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function PreviewStack() {
  const t = useT();
  return (
    <div className="relative mx-auto h-[230px] w-full max-w-[560px]" aria-hidden>
      {PREVIEW.map((p, i) => (
        <div
          key={p.name}
          className="absolute left-1/2 w-[330px] max-w-[86vw] rounded-2xl border border-line bg-panel p-4 text-left shadow-pop"
          style={{
            transform: `translateX(calc(-50% + ${(i - 1) * 120}px)) translateY(${i === 1 ? 0 : 34}px) rotate(${(i - 1) * 5}deg)`,
            zIndex: i === 1 ? 3 : 1,
          }}
        >
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full text-[12px] font-semibold text-white" style={{ background: `linear-gradient(135deg, ${p.color}, #22D3EE)` }}>
              {p.name
                .split(' ')
                .map((w) => w[0])
                .join('')}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">{p.name}</div>
              <div className="text-[11.5px] text-muted">{t('welcome.savedAgo')}</div>
            </div>
            <span
              className="ml-auto inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium"
              style={{ background: `color-mix(in oklab, ${p.color} 16%, transparent)`, color: `color-mix(in oklab, ${p.color} 75%, var(--fg))` }}
            >
              {p.emoji} {p.cat()}
            </span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-fg-2">{t(p.text)}</p>
        </div>
      ))}
    </div>
  );
}

export function WelcomeView({ embedded, settings }: { embedded?: boolean; settings: Settings }) {
  const t = useT();
  const lib = useLibrary();
  const sync = useSyncState();
  const fileRef = useRef<HTMLInputElement>(null);
  const syncing = isSyncActive(sync);
  const [loadingDemo, setLoadingDemo] = useState(false);

  return (
    <div className="relative min-h-full overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 animate-float rounded-full bg-[radial-gradient(closest-side,rgb(123_97_255/0.28),transparent)] blur-2xl" />
        <div className="absolute top-20 -right-40 h-[420px] w-[520px] animate-float rounded-full bg-[radial-gradient(closest-side,rgb(255_92_157/0.16),transparent)] blur-2xl [animation-delay:-3s]" />
        <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_65%)] opacity-50" />
      </div>

      <LanguageSwitch settings={settings} />
      <div className="relative mx-auto max-w-4xl px-6 pt-16 pb-24 text-center">
        <div className="mx-auto grid size-[72px] animate-rise place-items-center rounded-[22px] bg-panel shadow-pop ring-1 ring-line">
          <Logo className="size-12 drop-shadow-[0_10px_24px_rgb(150_80_255/0.55)]" />
        </div>
        <Eyebrow className="mt-7 animate-rise">{t('welcome.eyebrow')}</Eyebrow>
        <h1 className="mt-3 animate-rise text-[44px] leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-[58px]">
          {t('welcome.title1')}
          <br />
          <span className="serif-accent text-brand pr-2 text-[1.12em]">{t('welcome.title2')}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl animate-rise text-[16px] leading-relaxed text-muted">{t('welcome.lead')}</p>

        <div className="mt-9 flex animate-rise flex-wrap items-center justify-center gap-3">
          <Button size="lg" variant="primary" className="h-12 rounded-2xl px-6 text-[15px]" loading={syncing} onClick={() => void startSync('bookmark', 'full')}>
            {!syncing ? <Bookmark /> : null}
            {syncing ? (sync.found ? t('sync.syncingCount', { count: fmtNumber(sync.found) }) : t('sync.syncing')) : t('welcome.sync')}
            {!syncing ? <ArrowRight /> : null}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 rounded-2xl px-6 text-[15px]"
            loading={loadingDemo}
            onClick={async () => {
              setLoadingDemo(true);
              try {
                const n = await loadDemoLibrary();
                toast.success(t('welcome.demoLoaded', { count: n }), { description: t('welcome.demoLoadedDesc') });
                navigate('#/home');
              } finally {
                setLoadingDemo(false);
              }
            }}
          >
            {!loadingDemo ? <FlaskConical /> : null} {t('welcome.demo')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const r = await importJson(f);
                toast.success(t('welcome.imported', { count: r.bookmarks }));
                navigate('#/home');
              } catch (err) {
                toast.error(err instanceof Error ? err.message : t('common.importFailed'));
              }
              e.target.value = '';
            }}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] text-muted">
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 hover:text-fg">
            <FileUp className="size-3.5" /> {t('welcome.restore')}
          </button>
          <span className="text-faint">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" /> {t('welcome.private')}
          </span>
        </div>
        {!embedded && lib.counts.total ? (
          <button type="button" onClick={() => navigate('#/home')} className="mt-4 block w-full text-[13px] text-accent hover:underline">
            {t('welcome.goToLibrary', { count: fmtNumber(lib.counts.total) })}
          </button>
        ) : null}

        <div className="mt-14 hidden sm:block">
          <PreviewStack />
        </div>

        <ol className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="animate-rise rounded-2xl border border-line bg-panel p-5 shadow-card" style={{ animationDelay: `${300 + i * 80}ms` }}>
              <div className="flex items-center justify-between">
                <span className="btn-brand grid size-9 place-items-center rounded-xl [&_svg]:size-4">{s.icon}</span>
                <span className="serif-accent text-[28px] leading-none text-faint">0{i + 1}</span>
              </div>
              <div className="mt-4 text-[15px] font-semibold tracking-[-0.02em]">{t(s.title)}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{t(s.body)}</p>
            </li>
          ))}
        </ol>

        <div className="mt-14">
          <Eyebrow>{t('welcome.sortedInto')}</Eyebrow>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {DEFAULT_CATEGORIES.filter((c) => c.id !== 'other').map((c) => (
              <span
                key={c.id}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] shadow-card"
                style={{ background: `color-mix(in oklab, ${c.color} 9%, var(--panel))` }}
              >
                {c.emoji} {catName({ ...c, builtin: true })}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-3 text-left sm:grid-cols-2">
          <div className="flex gap-3 rounded-2xl border border-line bg-panel p-5 shadow-card">
            <Lock className="mt-0.5 size-4 shrink-0 text-good" />
            <div>
              <div className="text-[14px] font-semibold">{t('welcome.private')}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{t('welcome.privateBody')}</p>
            </div>
          </div>
          <div className="flex gap-3 rounded-2xl border border-line bg-panel p-5 shadow-card">
            <Zap className="mt-0.5 size-4 shrink-0 text-accent" />
            <div>
              <div className="text-[14px] font-semibold">{t('welcome.upToDate')}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{t('welcome.upToDateBody')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
