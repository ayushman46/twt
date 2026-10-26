import { Bookmark, FileUp, FlaskConical, Languages, Lock, MousePointerClick, RefreshCw, Search, Zap } from 'lucide-react';
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
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { startSync } from '@/components/SyncControl';
import { Button } from '@/components/ui/primitives';

const STEPS: Array<{ icon: ReactNode; title: MessageKey; body: MessageKey }> = [
  { icon: <MousePointerClick />, title: 'welcome.step1', body: 'welcome.step1Body' },
  { icon: <RefreshCw />, title: 'welcome.step2', body: 'welcome.step2Body' },
  { icon: <Search />, title: 'welcome.step3', body: 'welcome.step3Body' },
];

const PREVIEW = [
  { catId: 'ai', cat: () => tOr('cat.ai', 'AI & ML'), name: 'Maya Chen', text: 'welcome.preview1' },
  { catId: 'design', cat: () => tOr('cat.design', 'Design & UI'), name: 'Priya Raman', text: 'welcome.preview2' },
  { catId: 'startups', cat: () => tOr('cat.startups', 'Startups'), name: 'Leo Fischer', text: 'welcome.preview3' },
] as const;

/** First-run language switch (the full picker lives in Settings → General). */
function LanguageSwitch({ settings }: { settings: Settings }) {
  const locale = useLocale();
  return (
    <label className="absolute top-4 right-4 z-10 inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-panel pr-1 pl-2.5 text-[12.5px] text-muted">
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

/** A static sample of saved posts, drawn as a flat strip (aria-hidden: illustration only). */
function PreviewCards() {
  const t = useT();
  return (
    <div className="mt-14 hidden w-full overflow-hidden rounded-xl border border-line bg-line text-left sm:grid sm:grid-cols-3 sm:gap-px" aria-hidden>
      {PREVIEW.map((p) => (
        <div key={p.name} className="flex flex-col bg-panel p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-panel-2 text-[12px] font-semibold text-muted">
              {p.name
                .split(' ')
                .map((w) => w[0])
                .join('')}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">{p.name}</div>
              <div className="text-[12px] text-muted">{t('welcome.savedAgo')}</div>
            </div>
          </div>
          <p className="mt-3 flex-1 text-[13px] leading-relaxed text-fg-2">{t(p.text)}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-muted">
            <CategoryGlyph category={{ id: p.catId, builtin: true }} />
            {p.cat()}
          </div>
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
    <div className="relative min-h-full">
      <LanguageSwitch settings={settings} />
      <div className="mx-auto flex max-w-3xl flex-col items-center px-5 pt-16 pb-20 text-center sm:px-6 sm:pt-20">
        <Logo className="size-10" />
        <p className="mt-6 text-[13px] text-muted">{t('welcome.eyebrow')}</p>
        <h1 className="mt-2 text-[32px] leading-[1.15] font-semibold tracking-[-0.03em] text-balance sm:text-[40px]">
          {t('welcome.title1')}
          <br />
          {t('welcome.title2')}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted">{t('welcome.lead')}</p>

        <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button size="lg" variant="primary" className="w-full sm:w-auto sm:px-6" loading={syncing} onClick={() => void startSync('bookmark', 'full')}>
            {!syncing ? <Bookmark /> : null}
            {syncing ? (sync.found ? t('sync.syncingCount', { count: fmtNumber(sync.found) }) : t('sync.syncing')) : t('welcome.sync')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto sm:px-6"
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
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 transition-colors hover:text-fg">
            <FileUp className="size-3.5" aria-hidden /> {t('welcome.restore')}
          </button>
          <span className="text-faint" aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" aria-hidden /> {t('welcome.private')}
          </span>
        </div>
        {!embedded && lib.counts.total ? (
          <button type="button" onClick={() => navigate('#/home')} className="mt-4 text-[13px] text-accent hover:underline">
            {t('welcome.goToLibrary', { count: fmtNumber(lib.counts.total) })}
          </button>
        ) : null}

        <PreviewCards />

        <ol className="mt-14 grid w-full grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line text-left sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col bg-panel p-5">
              <div className="flex items-center justify-between">
                <span className="grid size-8 place-items-center rounded-lg bg-panel-2 text-fg-2 [&_svg]:size-4">{s.icon}</span>
                <span className="text-[12px] font-medium text-faint tabular-nums">0{i + 1}</span>
              </div>
              <div className="mt-4 text-[14px] font-semibold tracking-[-0.01em]">{t(s.title)}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{t(s.body)}</p>
            </li>
          ))}
        </ol>

        <div className="mt-14 w-full">
          <p className="text-[13px] text-muted">{t('welcome.sortedInto')}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {DEFAULT_CATEGORIES.filter((c) => c.id !== 'other').map((c) => {
              const cat = { ...c, builtin: true };
              return (
                <span key={c.id} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-panel-2 px-3 text-[13px] text-fg-2">
                  <CategoryGlyph category={cat} className="text-muted" />
                  {catName(cat)}
                </span>
              );
            })}
          </div>
        </div>

        <div className="mt-14 grid w-full grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line text-left sm:grid-cols-2">
          <div className="flex gap-3 bg-panel p-5">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <div>
              <div className="text-[14px] font-semibold">{t('welcome.private')}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{t('welcome.privateBody')}</p>
            </div>
          </div>
          <div className="flex gap-3 bg-panel p-5">
            <Zap className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
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
