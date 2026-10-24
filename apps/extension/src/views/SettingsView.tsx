import { AI_BATCH_SIZE, AI_MODELS, BRAND, FALLBACK_CATEGORY_ID, NVIDIA_KEY_PREFIX, NVIDIA_KEYS_URL, PRICING } from '@twtdash/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bot,
  Check,
  Crown,
  Database,
  Download,
  ExternalLink,
  FileUp,
  Keyboard,
  KeyRound,
  Layers,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { browser } from 'wxt/browser';
import { catName, LANGUAGES, resolveLocale, rich, setLocale, t, useT, type LanguagePref, type MessageKey } from '@/i18n';
import { COLLECTION_COLORS, createCategory, deleteCategory, updateCategory, wipeLibrary } from '@/lib/actions';
import { db } from '@/lib/db';
import { exportCsv, exportJson, exportMarkdown, importJson } from '@/lib/export';
import { fmtDate, fmtLongDate, fmtNumber } from '@/lib/format';
import { activateLicense, validateLicense } from '@/lib/license';
import { numberFormat } from '@/i18n/core';
import { usePaintMark } from '@/lib/perf';
import { send } from '@/lib/messages';
import type { AiProvider, Settings, ViewMode } from '@/lib/storage';
import type { Category } from '@/lib/types';
import { navigate, type Route } from '@/hooks/route';
import { useLibrary } from '@/hooks/library';
import { useUi } from '@/store/ui';
import { startSync } from '@/components/SyncControl';
import { Switch } from '@/components/ui/overlays';
import { Badge, Button, Input, cn } from '@/components/ui/primitives';

type Update = (patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) => Promise<Settings>;

const SECTIONS: Array<{ id: string; label: MessageKey; icon: ReactNode }> = [
  { id: 'general', label: 'settings.general', icon: <SlidersHorizontal /> },
  { id: 'categories', label: 'settings.categories', icon: <Layers /> },
  { id: 'ai', label: 'settings.ai', icon: <Sparkles /> },
  { id: 'sync', label: 'settings.sync', icon: <RefreshCw /> },
  { id: 'data', label: 'settings.data', icon: <Database /> },
  { id: 'plan', label: 'settings.plan', icon: <Crown /> },
  { id: 'about', label: 'settings.about', icon: <Keyboard /> },
];

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="animate-rise">
      <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-1 text-[13.5px] text-muted">{description}</p> : null}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Group({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div>
      {title ? <div className="mb-2 px-1 text-[11.5px] font-semibold tracking-[0.06em] text-faint uppercase">{title}</div> : null}
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel shadow-card">{children}</div>
    </div>
  );
}

function Row({ label, description, children, htmlFor }: { label: ReactNode; description?: ReactNode; children?: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 px-4 py-3.5">
      <label htmlFor={htmlFor} className="min-w-0 flex-[1_1_260px]">
        <div className="text-[13.5px] font-medium text-fg">{label}</div>
        {description ? <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{description}</div> : null}
      </label>
      <div className="ml-auto shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; icon?: ReactNode }> }) {
  return (
    <div className="flex max-w-full flex-wrap justify-end rounded-xl border border-line-strong bg-panel-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn('inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[12.5px] font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5', value === o.value ? 'bg-panel text-fg shadow-card' : 'text-muted hover:text-fg')}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- General */

function LanguagePicker({ settings, update }: { settings: Settings; update: Update }) {
  const t = useT();
  const browserLocale = resolveLocale('auto');
  const browserLang = LANGUAGES.find((l) => l.code === browserLocale);
  const options: Array<{ value: LanguagePref; native: string; sub: string; beta: boolean }> = [
    { value: 'auto', native: t('settings.languageAuto'), sub: `${t('settings.languageAutoDesc')} · ${browserLang?.native ?? 'English'}`, beta: false },
    ...LANGUAGES.map((l) => ({ value: l.code, native: l.native, sub: l.native === l.name ? '' : l.name, beta: l.beta })),
  ];
  const choose = (language: LanguagePref) => {
    // Apply right away; the stored setting keeps other open pages in sync.
    void setLocale(language);
    void update({ language });
  };
  const current = LANGUAGES.find((l) => l.code === (settings.language === 'auto' ? browserLocale : settings.language));
  return (
    <div className="px-4 py-3.5">
      <div className="text-[13.5px] font-medium text-fg">{t('settings.language')}</div>
      <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t('settings.languageDesc')}</div>
      <div role="radiogroup" aria-label={t('settings.language')} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {options.map((o) => {
          const on = settings.language === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(o.value)}
              className={cn(
                'relative flex min-h-[54px] flex-col justify-center rounded-xl border px-3 py-2 text-left transition-colors',
                on ? 'border-accent bg-accent-soft ring-2 ring-accent/15' : 'border-line bg-panel hover:border-line-strong hover:bg-panel-2/60',
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5 pr-4">
                <span lang={o.value === 'auto' ? undefined : o.value} className="truncate text-[14px] font-medium text-fg">
                  {o.native}
                </span>
                {o.beta ? <span className="shrink-0 rounded-full bg-panel-3 px-1.5 text-[10px] leading-[16px] font-semibold text-muted">{t('settings.beta')}</span> : null}
              </span>
              {o.sub ? <span className="truncate text-[11.5px] text-muted">{o.sub}</span> : null}
              {on ? <Check className="absolute top-2 right-2 size-3.5 text-accent" strokeWidth={3} /> : null}
            </button>
          );
        })}
      </div>
      {current?.beta ? <p className="mt-2.5 text-[12px] text-muted">{t('settings.languageBetaNote')}</p> : null}
    </div>
  );
}

function GeneralSection({ settings, update }: { settings: Settings; update: Update }) {
  const t = useT();
  return (
    <Section title={t('settings.general')} description={t('settings.generalDesc')}>
      <Group>
        <LanguagePicker settings={settings} update={update} />
      </Group>
      <Group>
        <Row label={t('settings.theme')}>
          <Segmented
            value={settings.theme}
            onChange={(theme) => void update({ theme })}
            options={[
              { value: 'system', label: t('settings.themeSystem'), icon: <Monitor /> },
              { value: 'light', label: t('settings.themeLight'), icon: <Sun /> },
              { value: 'dark', label: t('settings.themeDark'), icon: <Moon /> },
            ]}
          />
        </Row>
        <Row label={t('settings.defaultLayout')} description={t('settings.defaultLayoutDesc')}>
          <Segmented<ViewMode>
            value={settings.defaultView}
            onChange={(defaultView) => {
              void update({ defaultView });
              useUi.getState().setView(defaultView);
            }}
            options={[
              { value: 'grid', label: t('view.grid') },
              { value: 'list', label: t('view.list') },
              { value: 'table', label: t('view.table') },
              { value: 'gallery', label: t('view.gallery') },
            ]}
          />
        </Row>
        <Row label={t('settings.showGists')} description={t('settings.showGistsDesc')}>
          <Switch checked={settings.showSummaries} onCheckedChange={(v) => void update({ showSummaries: v })} />
        </Row>
        <Row label={t('settings.showStats')} description={t('settings.showStatsDesc')}>
          <Switch checked={settings.showMetrics} onCheckedChange={(v) => void update({ showMetrics: v })} />
        </Row>
      </Group>
    </Section>
  );
}

/* ------------------------------------------------------------- Categories */

function CategoryRow({ c, count }: { c: Category; count: number }) {
  const t = useT();
  // Built-in names show translated; typing a new name stores it as a rename.
  const shownName = catName(c);
  const [name, setName] = useState(shownName);
  const [emoji, setEmoji] = useState(c.emoji);
  const [keywords, setKeywords] = useState(c.keywords);
  useEffect(() => {
    setName(shownName);
    setEmoji(c.emoji);
    setKeywords(c.keywords);
  }, [c, shownName]);
  const isOther = c.id === FALLBACK_CATEGORY_ID;
  return (
    <div className={cn('grid grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-3', !c.enabled && 'opacity-55')}>
      <input
        value={emoji}
        onChange={(e) => setEmoji(e.target.value)}
        onBlur={() => emoji.trim() && emoji !== c.emoji && void updateCategory(c.id, { emoji: emoji.trim() })}
        className="h-9 w-11 rounded-[10px] border border-line bg-panel-2 text-center text-lg outline-none focus:border-accent/60"
        aria-label={t('settings.emoji')}
        maxLength={4}
      />
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== shownName && void updateCategory(c.id, { name: name.trim() })}
            className="h-9 min-w-0 flex-1 rounded-[10px] border border-transparent bg-transparent px-2 text-[13.5px] font-medium outline-none hover:border-line focus:border-accent/60"
            aria-label={t('settings.categoryName')}
          />
          <span className="text-[12px] text-faint tabular-nums">{fmtNumber(count)}</span>
          <div className="flex gap-1">
            {COLLECTION_COLORS.slice(0, 6).map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => void updateCategory(c.id, { color: col })}
                className={cn('size-4 rounded-full ring-offset-2 ring-offset-panel', c.color === col && 'ring-2 ring-fg/50')}
                style={{ background: col }}
                aria-label={t('collection.colorLabel', { color: col })}
              />
            ))}
          </div>
        </div>
        {!isOther ? (
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            onBlur={() => keywords !== c.keywords && void updateCategory(c.id, { keywords })}
            placeholder={c.builtin ? t('settings.keywordsBuiltin') : t('settings.keywordsCustom')}
            className="h-8 w-full rounded-lg border border-line bg-panel-2/60 px-2.5 text-[12.5px] outline-none placeholder:text-faint focus:border-accent/60"
          />
        ) : (
          <div className="px-2 text-[12px] text-muted">{t('settings.otherNote')}</div>
        )}
      </div>
      <div className="flex items-center gap-2 pt-1.5">
        {!isOther ? <Switch checked={c.enabled} onCheckedChange={(v) => void updateCategory(c.id, { enabled: v })} /> : null}
        {!c.builtin ? (
          <button
            type="button"
            onClick={() => {
              if (confirm(t('settings.deleteCategoryConfirm', { name: c.name }))) void deleteCategory(c.id);
            }}
            className="grid size-7 place-items-center rounded-lg text-muted hover:bg-bad/10 hover:text-bad"
            aria-label={t('settings.deleteCategory')}
          >
            <Trash className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CategoriesSection() {
  const t = useT();
  const lib = useLibrary();
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [busy, setBusy] = useState(false);
  const [keepAi, setKeepAi] = useState(true);

  const resort = async () => {
    setBusy(true);
    try {
      const r = await send('library/recategorize', { keepAi });
      toast.success(r.updated ? t('settings.resorted', { count: r.updated }) : t('settings.alreadySorted'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={t('settings.categories')} description={t('settings.categoriesDesc')}>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent/25 bg-accent-soft px-4 py-3">
        <RefreshCw className="size-4 text-accent" />
        <div className="min-w-0 flex-1 text-[13px]">
          <div className="font-medium">{t('settings.resortTitle')}</div>
          <div className="text-[12.5px] text-muted">{t('settings.resortDesc')}</div>
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          <Switch checked={keepAi} onCheckedChange={setKeepAi} /> {t('settings.keepAi')}
        </label>
        <Button variant="primary" size="sm" loading={busy} onClick={() => void resort()}>
          {t('settings.resortNow')}
        </Button>
      </div>

      <Group title={t('settings.addCategory')}>
        <form
          className="flex flex-wrap items-center gap-2 px-4 py-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await createCategory({ name: name.trim(), emoji: '🏷️', color: COLLECTION_COLORS[lib.categories.length % COLLECTION_COLORS.length]!, keywords });
            toast.success(t('settings.categoryAdded', { name: name.trim() }));
            setName('');
            setKeywords('');
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('settings.newCategoryName')} className="w-48 flex-none" />
          <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t('settings.newCategoryKeywords')} className="min-w-[200px] flex-1" />
          <Button type="submit" variant="secondary" disabled={!name.trim()}>
            <Plus /> {t('common.add')}
          </Button>
        </form>
      </Group>

      <Group title={t('settings.yourCategories')}>
        {lib.categories.map((c) => (
          <CategoryRow key={c.id} c={c} count={lib.counts.categories.get(c.id) ?? 0} />
        ))}
      </Group>
    </Section>
  );
}

/* --------------------------------------------------------------------- AI */

function ProviderCard({ active, onClick, icon, title, body, badge }: { active: boolean; onClick: () => void; icon: ReactNode; title: string; body: string; badge?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('relative rounded-2xl border p-4 text-left transition-all', active ? 'border-accent bg-accent-soft ring-4 ring-accent/10' : 'border-line bg-panel hover:border-line-strong')}
    >
      <div className="flex items-center gap-2">
        <span className={cn('grid size-8 place-items-center rounded-lg [&_svg]:size-4', active ? 'bg-accent text-white' : 'bg-panel-2 text-muted')}>{icon}</span>
        <span className="text-[13.5px] font-semibold whitespace-nowrap">{title}</span>
        {badge}
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{body}</p>
      {active ? <Check className="absolute top-4 right-4 size-4 text-accent" strokeWidth={3} /> : null}
    </button>
  );
}

function AiSection({ settings, update, onAi }: { settings: Settings; update: Update; onAi: (ids?: string[], force?: boolean) => void }) {
  const t = useT();
  const ai = useUi((s) => s.ai);
  const pending = useLiveQuery(() => db.bookmarks.filter((b) => !b.aiAt && !b.partial).count(), []) ?? 0;
  const [key, setKey] = useState(settings.ai.apiKey);
  useEffect(() => setKey(settings.ai.apiKey), [settings.ai.apiKey]);
  const isPro = settings.license?.status === 'active';
  const setProvider = (provider: AiProvider) => void update((s) => ({ ai: { ...s.ai, provider } }));
  const ready = settings.ai.provider === 'byok' ? !!settings.ai.apiKey : settings.ai.provider === 'pro' ? isPro : false;
  const requests = Math.ceil(Math.max(pending, 1000) / AI_BATCH_SIZE);
  const [checking, setChecking] = useState(false);

  const saveKey = async () => {
    const trimmed = key.trim();
    if (trimmed && !trimmed.startsWith(NVIDIA_KEY_PREFIX)) {
      toast.error(t('settings.notNvidiaKey', { prefix: NVIDIA_KEY_PREFIX }));
      return;
    }
    if (!trimmed) {
      await update((s) => ({ ai: { ...s.ai, apiKey: '' } }));
      toast.success(t('settings.keyRemoved'));
      return;
    }
    // Optional permission lets the extension call integrate.api.nvidia.com directly.
    await browser.permissions?.request({ origins: ['https://integrate.api.nvidia.com/*'] }).catch(() => false);
    setChecking(true);
    try {
      const { testApiKey } = await import('@/lib/ai');
      await testApiKey(trimmed, settings.ai.model);
      await update((s) => ({ ai: { ...s.ai, apiKey: trimmed } }));
      toast.success(t('settings.keyWorks'));
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth') {
        toast.error(err instanceof Error ? err.message : t('settings.keyRejected'));
      } else {
        // Couldn't confirm (offline, busy, model hiccup) — keep the key; the run will report real problems.
        await update((s) => ({ ai: { ...s.ai, apiKey: trimmed } }));
        toast.warning(t('settings.keyUnconfirmed', { error: err instanceof Error ? err.message : t('settings.unknownError') }));
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <Section title={t('settings.ai')} description={t('settings.aiDesc')}>
      <div className="grid gap-3 md:grid-cols-3">
        <ProviderCard active={settings.ai.provider === 'off'} onClick={() => setProvider('off')} icon={<ShieldCheck />} title={t('settings.aiOff')} body={t('settings.aiOffBody')} />
        <ProviderCard
          active={settings.ai.provider === 'pro'}
          onClick={() => setProvider('pro')}
          icon={<Crown />}
          title="twtdash Pro"
          badge={<Badge className="ml-auto hidden bg-accent text-white xl:inline-flex">{t('settings.noKeyNeeded')}</Badge>}
          body={t('settings.aiProBody')}
        />
        <ProviderCard active={settings.ai.provider === 'byok'} onClick={() => setProvider('byok')} icon={<KeyRound />} title={t('settings.aiByok')} body={t('settings.aiByokBody')} />
      </div>

      {settings.ai.provider === 'pro' && !isPro ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel p-4">
          <Crown className="size-5 text-accent" />
          <div className="min-w-0 flex-1 text-[13px]">
            <div className="font-medium">{t('settings.activatePro')}</div>
            <div className="text-muted">{t('settings.activateProBody', { monthly: PRICING.pro.monthly, yearly: PRICING.pro.yearly })}</div>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate('#/settings/plan')}>
            {t('settings.goToPlan')}
          </Button>
        </div>
      ) : null}

      {settings.ai.provider === 'byok' ? (
        <Group title={t('settings.nvidiaGroup')}>
          <div className="space-y-3 px-4 py-4">
            <div className="flex gap-2">
              <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="nvapi-…" autoComplete="off" spellCheck={false} className="font-mono text-[13px]" />
              <Button variant="primary" onClick={() => void saveKey()} disabled={checking || key.trim() === settings.ai.apiKey}>
                {checking ? t('settings.checking') : t('settings.saveKey')}
              </Button>
            </div>
            <p className="text-[12px] text-muted">
              {rich(t('settings.keyHelp'), {
                a: (s) => (
                  <a href={NVIDIA_KEYS_URL} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {s}
                  </a>
                ),
              })}
            </p>
          </div>
          <Row label={t('settings.model')} description={t('settings.modelDesc', { requests, posts: Math.max(pending, 1000) })}>
            <select
              value={settings.ai.model}
              onChange={(e) => void update((s) => ({ ai: { ...s.ai, model: e.target.value } }))}
              className="h-9 rounded-[10px] border border-line-strong bg-panel px-2.5 text-[13px] outline-none focus:border-accent/60"
            >
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.note}
                </option>
              ))}
            </select>
          </Row>
        </Group>
      ) : null}

      {settings.ai.provider !== 'off' ? (
        <>
          <Group title={t('settings.options')}>
            <Row label={t('settings.writeGists')} description={t('settings.writeGistsDesc')}>
              <Switch checked={settings.ai.summaries} onCheckedChange={(v) => void update((s) => ({ ai: { ...s.ai, summaries: v } }))} />
            </Row>
            <Row label={t('settings.autoOrganize')} description={t('settings.autoOrganizeDesc')}>
              <Switch checked={settings.ai.autoRun} onCheckedChange={(v) => void update((s) => ({ ai: { ...s.ai, autoRun: v } }))} />
            </Row>
          </Group>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel p-4 shadow-card">
            <Bot className="size-5 text-accent" />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium">{ai.running ? t('settings.organizing', { done: ai.done, total: ai.total }) : pending ? t('settings.waitingForAi', { count: pending }) : t('settings.allOrganized')}</div>
              {ai.running ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
                  <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${ai.total ? (ai.done / ai.total) * 100 : 0}%` }} />
                </div>
              ) : ai.error ? (
                <div className="mt-0.5 text-[12.5px] text-bad">{ai.error}</div>
              ) : (
                <div className="mt-0.5 text-[12.5px] text-muted">{t('settings.handSorted')}</div>
              )}
            </div>
            <Button variant="primary" size="sm" disabled={!ready || ai.running || !pending} onClick={() => onAi()}>
              <Sparkles /> {t('settings.organizeNow')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!ready || ai.running}
              onClick={() => {
                if (confirm(t('settings.rerunConfirm'))) onAi(undefined, true);
              }}
            >
              {t('settings.rerunAll')}
            </Button>
          </div>
        </>
      ) : null}
    </Section>
  );
}

/* ------------------------------------------------------------------- Sync */

function SyncSection({ settings, update }: { settings: Settings; update: Update }) {
  const t = useT();
  const runs = useLiveQuery(() => db.syncRuns.orderBy('startedAt').reverse().limit(8).toArray(), []) ?? [];
  return (
    <Section title={t('settings.sync')} description={t('settings.syncDesc')}>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void startSync('bookmark', 'quick')}>
          <RefreshCw /> {t('sync.quick')}
        </Button>
        <Button variant="outline" onClick={() => void startSync('bookmark', 'full')}>
          {t('sync.full')}
        </Button>
        <Button variant="outline" onClick={() => void startSync('like', 'full')}>
          {t('sync.importLikes')}
        </Button>
      </div>
      <Group>
        <Row label={t('settings.mirror')} description={t('settings.mirrorDesc')}>
          <Switch checked={settings.mirrorDeletions} onCheckedChange={(v) => void update({ mirrorDeletions: v })} />
        </Row>
        <Row label={t('settings.captureLikes')} description={t('settings.captureLikesDesc')}>
          <Switch checked={settings.captureLikes} onCheckedChange={(v) => void update({ captureLikes: v })} />
        </Row>
        <Row label={t('settings.toasts')} description={t('settings.toastsDesc')}>
          <Switch checked={settings.toasts} onCheckedChange={(v) => void update({ toasts: v })} />
        </Row>
        <Row label={t('settings.pageButton')} description={t('settings.pageButtonDesc')}>
          <Switch checked={settings.pageButton} onCheckedChange={(v) => void update({ pageButton: v })} />
        </Row>
      </Group>
      {runs.length ? (
        <Group title={t('settings.recentSyncs')}>
          {runs.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]">
              <span className={cn('size-2 rounded-full', r.status === 'done' ? 'bg-good' : r.status === 'error' ? 'bg-bad' : 'bg-faint')} />
              <span className="w-44 shrink-0 text-fg-2">{fmtLongDate(r.startedAt)}</span>
              <span className="text-muted">
                {t(r.mode === 'quick' ? (r.source === 'like' ? 'settings.runQuickLikes' : 'settings.runQuickBookmarks') : r.source === 'like' ? 'settings.runFullLikes' : 'settings.runFullBookmarks')}
              </span>
              <span className="ml-auto text-muted tabular-nums">
                {rich(t('settings.runCounts', { found: r.found, added: r.added }), { b: (s) => <b className="font-medium text-fg">{s}</b> })}
              </span>
            </div>
          ))}
        </Group>
      ) : null}
    </Section>
  );
}

/* ------------------------------------------------------------------- Data */

function DataSection() {
  const t = useT();
  const lib = useLibrary();
  const fileRef = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<string | null>(null);
  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => e.usage && setUsage(numberFormat({ style: 'unit', unit: 'megabyte', maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(e.usage / 1024 / 1024)));
  }, [lib.counts.total]);

  return (
    <Section title={t('settings.data')} description={t('settings.dataDesc')}>
      <Group title={t('settings.export')}>
        <Row label={t('settings.markdown')} description={t('settings.markdownDesc')}>
          <Button variant="outline" size="sm" onClick={() => void exportMarkdown()}>
            <Download /> .md
          </Button>
        </Row>
        <Row label={t('settings.spreadsheet')} description={t('settings.spreadsheetDesc')}>
          <Button variant="outline" size="sm" onClick={() => void exportCsv()}>
            <Download /> .csv
          </Button>
        </Row>
        <Row label={t('settings.backup')} description={t('settings.backupDesc')}>
          <Button variant="outline" size="sm" onClick={() => void exportJson()}>
            <Download /> .json
          </Button>
        </Row>
      </Group>
      <Group title={t('settings.import')}>
        <Row label={t('settings.restore')} description={t('settings.restoreDesc')}>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp /> {t('settings.chooseFile')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const r = await importJson(f);
                toast.success(t('settings.imported', { posts: r.bookmarks, collections: r.collections }));
              } catch (err) {
                toast.error(err instanceof Error ? err.message : t('common.importFailed'));
              }
              e.target.value = '';
            }}
          />
        </Row>
      </Group>
      <Group title={t('settings.storage')}>
        <Row label={t('settings.storageSummary', { posts: lib.counts.total, collections: lib.collections.length })} description={usage ? t('settings.usage', { size: usage }) : t('settings.storedHere')} />
        <Row label={<span className="text-bad">{t('settings.deleteEverything')}</span>} description={t('settings.deleteEverythingDesc')}>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (!confirm(t('settings.deleteConfirm'))) return;
              await wipeLibrary();
              toast(t('settings.libraryDeleted'));
              navigate('#/home');
            }}
          >
            <Trash /> {t('common.delete')}
          </Button>
        </Row>
      </Group>
    </Section>
  );
}

/* ------------------------------------------------------------------- Plan */

function PlanSection({ settings, update }: { settings: Settings; update: Update }) {
  const t = useT();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const lic = settings.license;
  const isPro = lic?.status === 'active';

  return (
    <Section title={t('settings.plan')} description={t('settings.planDesc')}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className={cn('rounded-2xl border p-5', !isPro ? 'border-line-strong bg-panel' : 'border-line bg-panel')}>
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">{t('common.free')}</span>
            {!isPro ? <Badge>{t('settings.currentPlan')}</Badge> : null}
          </div>
          <div className="mt-1 text-[26px] font-semibold tracking-tight">$0</div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-fg-2">
            {(['settings.freeFeature1', 'settings.freeFeature2', 'settings.freeFeature3', 'settings.freeFeature4', 'settings.freeFeature5'] as const).map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-good" /> {t(f)}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-accent/40 bg-accent-soft p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[15px] font-semibold">
              <Crown className="size-4 text-accent" /> Pro
            </span>
            {isPro ? <Badge className="bg-accent text-white">{t('settings.active')}</Badge> : null}
          </div>
          <div className="mt-1 text-[26px] font-semibold tracking-tight">
            ${PRICING.pro.monthly}
            <span className="text-[14px] font-normal text-muted">{t('settings.perMonth', { yearly: PRICING.pro.yearly })}</span>
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-fg-2">
            {(['settings.proFeature1', 'settings.proFeature2', 'settings.proFeature3', 'settings.proFeature4'] as const).map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-accent" /> {t(f)}
              </li>
            ))}
          </ul>
          {!isPro ? (
            <Button variant="primary" className="mt-4 w-full" onClick={() => window.open(`${BRAND.website}/#pricing`, '_blank', 'noopener')}>
              {t('settings.upgrade')} <ExternalLink />
            </Button>
          ) : null}
        </div>
      </div>

      <Group title={t('settings.license')}>
        {lic ? (
          <>
            <Row label={isPro ? t('settings.proActive') : t('settings.licenseStatus', { status: lic.status })} description={[lic.plan, lic.email, lic.expiresAt ? t('settings.renews', { date: fmtDate(new Date(lic.expiresAt), { dateStyle: 'medium' }) }) : null].filter(Boolean).join(' · ') || undefined}>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const next = await validateLicense(lic);
                      await update({ license: next });
                      toast.success(next.status === 'active' ? t('settings.licenseActive') : t('settings.licenseIs', { status: next.status }));
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : t('settings.licenseCheckFailed'));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t('settings.recheck')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void update((s) => ({ license: null, ai: { ...s.ai, provider: s.ai.provider === 'pro' ? 'off' : s.ai.provider } }))}>
                  {t('common.remove')}
                </Button>
              </div>
            </Row>
            <div className="px-4 py-2.5 font-mono text-[12px] text-faint">{lic.key.replace(/.(?=.{4})/g, '•')}</div>
          </>
        ) : (
          <form
            className="flex gap-2 px-4 py-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!key.trim()) return;
              setBusy(true);
              try {
                const license = await activateLicense(key);
                await update((s) => ({ license, ai: { ...s.ai, provider: s.ai.provider === 'off' ? 'pro' : s.ai.provider } }));
                setKey('');
                toast.success(t('settings.welcomePro'));
              } catch (err) {
                toast.error(err instanceof Error ? err.message : t('settings.activationFailed'));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder={t('settings.pasteKey')} className="font-mono text-[13px]" spellCheck={false} />
            <Button type="submit" variant="primary" loading={busy} disabled={!key.trim()}>
              {t('settings.activate')}
            </Button>
          </form>
        )}
      </Group>
    </Section>
  );
}

/* ------------------------------------------------------------------ About */

function AboutSection() {
  const t = useT();
  const setShortcutsOpen = useUi((s) => s.setShortcutsOpen);
  const version = browser.runtime.getManifest?.()?.version ?? '1.0.0';
  return (
    <Section title={t('settings.about')} description={`${BRAND.name} ${version}`}>
      <Group>
        <Row label={t('shortcuts.title')} description={t('settings.shortcutsDesc')}>
          <Button size="sm" variant="outline" onClick={() => setShortcutsOpen(true)}>
            <Keyboard /> {t('common.view')}
          </Button>
        </Row>
        <Row label={t('settings.openAnywhere')} description={t('settings.openAnywhereDesc')} />
        <Row label={t('settings.website')} description={BRAND.website.replace('https://', '')}>
          <Button size="sm" variant="ghost" onClick={() => window.open(BRAND.website, '_blank', 'noopener')}>
            <ExternalLink />
          </Button>
        </Row>
        <Row label={t('settings.privacy')} description={t('settings.privacyDesc')}>
          <Button size="sm" variant="ghost" onClick={() => window.open(`${BRAND.website}/privacy`, '_blank', 'noopener')}>
            <ExternalLink />
          </Button>
        </Row>
        <Row label={t('settings.support')} description={BRAND.supportLabel}>
          <Button size="sm" variant="ghost" onClick={() => window.open(BRAND.supportUrl, '_blank', 'noopener')}>
            <ExternalLink />
          </Button>
        </Row>
      </Group>
      <p className="px-1 text-[12px] text-faint">{t('settings.notAffiliated')}</p>
    </Section>
  );
}

export function SettingsView({ route, settings, update, onAi }: { route: Route; settings: Settings; update: Update; onAi: (ids?: string[], force?: boolean) => void }) {
  useT();
  const section = SECTIONS.some((s) => s.id === route.section) ? route.section! : 'general';
  usePaintMark('route:settings:painted', true);
  return (
    <div className="mx-auto flex w-full max-w-[1100px] gap-8 px-5 pt-8 pb-16 sm:px-8">
      <nav className="sticky top-8 hidden h-fit w-52 shrink-0 space-y-0.5 md:block" aria-label={t('settings.sections')}>
        <h1 className="mb-4 px-2.5 text-[22px] font-semibold tracking-tight">{t('nav.settings')}</h1>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => navigate(`#/settings/${s.id}`)}
            className={cn(
              'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors [&_svg]:size-4',
              section === s.id ? 'bg-panel font-medium text-fg shadow-card [&_svg]:text-accent' : 'text-fg-2 hover:bg-panel-2/70 [&_svg]:text-muted',
            )}
          >
            {s.icon}
            <span className="min-w-0 truncate">{t(s.label)}</span>
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <div className="mb-6 flex gap-1 overflow-x-auto md:hidden">
          {SECTIONS.map((s) => (
            <button key={s.id} type="button" onClick={() => navigate(`#/settings/${s.id}`)} className={cn('h-8 shrink-0 rounded-full px-3 text-[13px]', section === s.id ? 'bg-accent text-white' : 'bg-panel-2 text-fg-2')}>
              {t(s.label)}
            </button>
          ))}
        </div>
        {section === 'general' ? <GeneralSection settings={settings} update={update} /> : null}
        {section === 'categories' ? <CategoriesSection /> : null}
        {section === 'ai' ? <AiSection settings={settings} update={update} onAi={onAi} /> : null}
        {section === 'sync' ? <SyncSection settings={settings} update={update} /> : null}
        {section === 'data' ? <DataSection /> : null}
        {section === 'plan' ? <PlanSection settings={settings} update={update} /> : null}
        {section === 'about' ? <AboutSection /> : null}
      </div>
    </div>
  );
}
