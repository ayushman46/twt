import { AI_MODELS, BRAND, FALLBACK_CATEGORY_ID, PRICING, estimateCostUsd } from '@twtdash/shared';
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
import { COLLECTION_COLORS, createCategory, deleteCategory, updateCategory, wipeLibrary } from '@/lib/actions';
import { db } from '@/lib/db';
import { exportCsv, exportJson, exportMarkdown, importJson } from '@/lib/export';
import { fmtLongDate, fmtNumber } from '@/lib/format';
import { activateLicense, validateLicense } from '@/lib/license';
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

const SECTIONS: Array<{ id: string; label: string; icon: ReactNode }> = [
  { id: 'general', label: 'General', icon: <SlidersHorizontal /> },
  { id: 'categories', label: 'Categories', icon: <Layers /> },
  { id: 'ai', label: 'AI organization', icon: <Sparkles /> },
  { id: 'sync', label: 'Sync & capture', icon: <RefreshCw /> },
  { id: 'data', label: 'Data & export', icon: <Database /> },
  { id: 'plan', label: 'Plan', icon: <Crown /> },
  { id: 'about', label: 'About', icon: <Keyboard /> },
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
    <div className="flex items-center justify-between gap-6 px-4 py-3.5">
      <label htmlFor={htmlFor} className="min-w-0">
        <div className="text-[13.5px] font-medium text-fg">{label}</div>
        {description ? <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{description}</div> : null}
      </label>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; icon?: ReactNode }> }) {
  return (
    <div className="flex rounded-xl border border-line-strong bg-panel-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn('inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[12.5px] font-medium transition-colors [&_svg]:size-3.5', value === o.value ? 'bg-panel text-fg shadow-card' : 'text-muted hover:text-fg')}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- General */

function GeneralSection({ settings, update }: { settings: Settings; update: Update }) {
  return (
    <Section title="General" description="How twtdash looks and feels.">
      <Group>
        <Row label="Theme">
          <Segmented
            value={settings.theme}
            onChange={(theme) => void update({ theme })}
            options={[
              { value: 'system', label: 'System', icon: <Monitor /> },
              { value: 'light', label: 'Light', icon: <Sun /> },
              { value: 'dark', label: 'Dark', icon: <Moon /> },
            ]}
          />
        </Row>
        <Row label="Default layout" description="You can switch any time with keys 1–4.">
          <Segmented<ViewMode>
            value={settings.defaultView}
            onChange={(defaultView) => {
              void update({ defaultView });
              useUi.getState().setView(defaultView);
            }}
            options={[
              { value: 'grid', label: 'Grid' },
              { value: 'list', label: 'List' },
              { value: 'table', label: 'Table' },
              { value: 'gallery', label: 'Media' },
            ]}
          />
        </Row>
        <Row label="Show AI gists on cards" description="One-line summaries written by AI, when available.">
          <Switch checked={settings.showSummaries} onCheckedChange={(v) => void update({ showSummaries: v })} />
        </Row>
        <Row label="Show engagement stats" description="Likes, reposts and views on each card.">
          <Switch checked={settings.showMetrics} onCheckedChange={(v) => void update({ showMetrics: v })} />
        </Row>
      </Group>
    </Section>
  );
}

/* ------------------------------------------------------------- Categories */

function CategoryRow({ c, count }: { c: Category; count: number }) {
  const [name, setName] = useState(c.name);
  const [emoji, setEmoji] = useState(c.emoji);
  const [keywords, setKeywords] = useState(c.keywords);
  useEffect(() => {
    setName(c.name);
    setEmoji(c.emoji);
    setKeywords(c.keywords);
  }, [c]);
  const isOther = c.id === FALLBACK_CATEGORY_ID;
  return (
    <div className={cn('grid grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-3', !c.enabled && 'opacity-55')}>
      <input
        value={emoji}
        onChange={(e) => setEmoji(e.target.value)}
        onBlur={() => emoji.trim() && emoji !== c.emoji && void updateCategory(c.id, { emoji: emoji.trim() })}
        className="h-9 w-11 rounded-[10px] border border-line bg-panel-2 text-center text-lg outline-none focus:border-accent/60"
        aria-label="Emoji"
        maxLength={4}
      />
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== c.name && void updateCategory(c.id, { name: name.trim() })}
            className="h-9 min-w-0 flex-1 rounded-[10px] border border-transparent bg-transparent px-2 text-[13.5px] font-medium outline-none hover:border-line focus:border-accent/60"
            aria-label="Category name"
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
                aria-label={`Color ${col}`}
              />
            ))}
          </div>
        </div>
        {!isOther ? (
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            onBlur={() => keywords !== c.keywords && void updateCategory(c.id, { keywords })}
            placeholder={c.builtin ? 'Extra keywords, comma separated (e.g. cursor, vercel, “edge functions”)' : 'Keywords that belong here, comma separated'}
            className="h-8 w-full rounded-lg border border-line bg-panel-2/60 px-2.5 text-[12.5px] outline-none placeholder:text-faint focus:border-accent/60"
          />
        ) : (
          <div className="px-2 text-[12px] text-muted">Posts that don’t match anything land here.</div>
        )}
      </div>
      <div className="flex items-center gap-2 pt-1.5">
        {!isOther ? <Switch checked={c.enabled} onCheckedChange={(v) => void updateCategory(c.id, { enabled: v })} /> : null}
        {!c.builtin ? (
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete “${c.name}”? Its posts move to Other.`)) void deleteCategory(c.id);
            }}
            className="grid size-7 place-items-center rounded-lg text-muted hover:bg-bad/10 hover:text-bad"
            aria-label="Delete category"
          >
            <Trash className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CategoriesSection() {
  const lib = useLibrary();
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [busy, setBusy] = useState(false);
  const [keepAi, setKeepAi] = useState(true);

  const resort = async () => {
    setBusy(true);
    try {
      const r = await send('library/recategorize', { keepAi });
      toast.success(r.updated ? `Re-sorted ${fmtNumber(r.updated)} posts` : 'Everything is already in the right place');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Categories" description="twtdash sorts posts on your device using keyword rules. Add your own keywords or create custom categories — then re-sort.">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent/25 bg-accent-soft px-4 py-3">
        <RefreshCw className="size-4 text-accent" />
        <div className="min-w-0 flex-1 text-[13px]">
          <div className="font-medium">Re-sort your library</div>
          <div className="text-[12.5px] text-muted">Applies your latest categories to every post you haven’t sorted by hand.</div>
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          <Switch checked={keepAi} onCheckedChange={setKeepAi} /> Keep AI decisions
        </label>
        <Button variant="primary" size="sm" loading={busy} onClick={() => void resort()}>
          Re-sort now
        </Button>
      </div>

      <Group title="Add a category">
        <form
          className="flex flex-wrap items-center gap-2 px-4 py-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await createCategory({ name: name.trim(), emoji: '🏷️', color: COLLECTION_COLORS[lib.categories.length % COLLECTION_COLORS.length]!, keywords });
            toast.success(`Added ${name.trim()} — re-sort to apply it`);
            setName('');
            setKeywords('');
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Climbing" className="w-48 flex-none" />
          <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Keywords: bouldering, crag, belay" className="min-w-[200px] flex-1" />
          <Button type="submit" variant="secondary" disabled={!name.trim()}>
            <Plus /> Add
          </Button>
        </form>
      </Group>

      <Group title="Your categories">
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
  const ai = useUi((s) => s.ai);
  const pending = useLiveQuery(() => db.bookmarks.filter((b) => !b.aiAt && !b.partial).count(), []) ?? 0;
  const [key, setKey] = useState(settings.ai.apiKey);
  useEffect(() => setKey(settings.ai.apiKey), [settings.ai.apiKey]);
  const isPro = settings.license?.status === 'active';
  const setProvider = (provider: AiProvider) => void update((s) => ({ ai: { ...s.ai, provider } }));
  const ready = settings.ai.provider === 'byok' ? !!settings.ai.apiKey : settings.ai.provider === 'pro' ? isPro : false;
  const cost = estimateCostUsd(Math.max(pending, 1000), settings.ai.model, settings.ai.summaries);

  const saveKey = async () => {
    const trimmed = key.trim();
    if (trimmed && !trimmed.startsWith('sk-ant-')) {
      toast.error('That doesn’t look like an Anthropic API key (it should start with sk-ant-).');
      return;
    }
    // Optional permission lets the extension call api.anthropic.com directly.
    await browser.permissions?.request({ origins: ['https://api.anthropic.com/*'] }).catch(() => false);
    await update((s) => ({ ai: { ...s.ai, apiKey: trimmed } }));
    toast.success(trimmed ? 'API key saved on this device' : 'API key removed');
  };

  return (
    <Section title="AI organization" description="Let Claude read your saved posts and pick categories, add topical tags and write one-line gists. Far more accurate than keyword rules.">
      <div className="grid gap-3 md:grid-cols-3">
        <ProviderCard active={settings.ai.provider === 'off'} onClick={() => setProvider('off')} icon={<ShieldCheck />} title="Off" body="On-device keyword sorting only. Nothing leaves your browser." />
        <ProviderCard
          active={settings.ai.provider === 'pro'}
          onClick={() => setProvider('pro')}
          icon={<Crown />}
          title="twtdash Pro"
          badge={<Badge className="ml-auto hidden bg-accent text-white xl:inline-flex">No key needed</Badge>}
          body="Works instantly with your Pro plan. Posts are processed and never stored."
        />
        <ProviderCard active={settings.ai.provider === 'byok'} onClick={() => setProvider('byok')} icon={<KeyRound />} title="Your Anthropic key" body="Free. Requests go straight from your browser to Anthropic, billed to your account." />
      </div>

      {settings.ai.provider === 'pro' && !isPro ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel p-4">
          <Crown className="size-5 text-accent" />
          <div className="min-w-0 flex-1 text-[13px]">
            <div className="font-medium">Activate twtdash Pro to use hosted AI</div>
            <div className="text-muted">
              ${PRICING.pro.monthly}/month or ${PRICING.pro.yearly}/year. Paste your license key in Plan.
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate('#/settings/plan')}>
            Go to Plan
          </Button>
        </div>
      ) : null}

      {settings.ai.provider === 'byok' ? (
        <Group title="Anthropic API">
          <div className="space-y-3 px-4 py-4">
            <div className="flex gap-2">
              <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" spellCheck={false} className="font-mono text-[13px]" />
              <Button variant="primary" onClick={() => void saveKey()} disabled={key.trim() === settings.ai.apiKey}>
                Save key
              </Button>
            </div>
            <p className="text-[12px] text-muted">
              Stored only in this browser’s extension storage and sent only to api.anthropic.com. Create a key at{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                console.anthropic.com
              </a>
              .
            </p>
          </div>
          <Row label="Model" description={`≈ $${cost < 0.1 ? cost.toFixed(3) : cost.toFixed(2)} per ${fmtNumber(Math.max(pending, 1000))} posts`}>
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
          <Group title="Options">
            <Row label="Write one-line gists" description="A short summary on longer posts, shown on cards.">
              <Switch checked={settings.ai.summaries} onCheckedChange={(v) => void update((s) => ({ ai: { ...s.ai, summaries: v } }))} />
            </Row>
            <Row label="Organize new posts automatically" description="Runs whenever you open twtdash and there are new posts.">
              <Switch checked={settings.ai.autoRun} onCheckedChange={(v) => void update((s) => ({ ai: { ...s.ai, autoRun: v } }))} />
            </Row>
          </Group>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel p-4 shadow-card">
            <Bot className="size-5 text-accent" />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium">{ai.running ? `Organizing… ${fmtNumber(ai.done)} of ${fmtNumber(ai.total)}` : pending ? `${fmtNumber(pending)} posts waiting for AI` : 'All posts organized ✨'}</div>
              {ai.running ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
                  <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${ai.total ? (ai.done / ai.total) * 100 : 0}%` }} />
                </div>
              ) : ai.error ? (
                <div className="mt-0.5 text-[12.5px] text-bad">{ai.error}</div>
              ) : (
                <div className="mt-0.5 text-[12.5px] text-muted">Posts you’ve categorized by hand keep your choice — AI only adds tags to them.</div>
              )}
            </div>
            <Button variant="primary" size="sm" disabled={!ready || ai.running || !pending} onClick={() => onAi()}>
              <Sparkles /> Organize now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!ready || ai.running}
              onClick={() => {
                if (confirm('Re-run AI on every post in your library?')) onAi(undefined, true);
              }}
            >
              Re-run all
            </Button>
          </div>
        </>
      ) : null}
    </Section>
  );
}

/* ------------------------------------------------------------------- Sync */

function SyncSection({ settings, update }: { settings: Settings; update: Update }) {
  const runs = useLiveQuery(() => db.syncRuns.orderBy('startedAt').reverse().limit(8).toArray(), []) ?? [];
  return (
    <Section title="Sync & capture" description="twtdash reads your bookmarks from X’s own pages — no API keys, no passwords.">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void startSync('bookmark', 'quick')}>
          <RefreshCw /> Quick sync
        </Button>
        <Button variant="outline" onClick={() => void startSync('bookmark', 'full')}>
          Full sync
        </Button>
        <Button variant="outline" onClick={() => void startSync('like', 'full')}>
          Import likes
        </Button>
      </div>
      <Group>
        <Row label="Mirror removals from X" description="When you un-bookmark a post on X, remove it here too.">
          <Switch checked={settings.mirrorDeletions} onCheckedChange={(v) => void update({ mirrorDeletions: v })} />
        </Row>
        <Row label="Capture likes in real time" description="Posts you like on X are added to your Likes view.">
          <Switch checked={settings.captureLikes} onCheckedChange={(v) => void update({ captureLikes: v })} />
        </Row>
        <Row label="Confirmation toasts on X" description="A small “Saved to twtdash” note when you bookmark.">
          <Switch checked={settings.toasts} onCheckedChange={(v) => void update({ toasts: v })} />
        </Row>
        <Row label="twtdash button on the bookmarks page" description="A small floating button to sync or open your library.">
          <Switch checked={settings.pageButton} onCheckedChange={(v) => void update({ pageButton: v })} />
        </Row>
      </Group>
      {runs.length ? (
        <Group title="Recent syncs">
          {runs.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <span className={cn('size-2 rounded-full', r.status === 'done' ? 'bg-good' : r.status === 'error' ? 'bg-bad' : 'bg-faint')} />
              <span className="w-40 shrink-0 text-fg-2">{fmtLongDate(r.startedAt)}</span>
              <span className="text-muted">
                {r.mode === 'quick' ? 'Quick' : 'Full'} · {r.source === 'like' ? 'likes' : 'bookmarks'}
              </span>
              <span className="ml-auto text-muted tabular-nums">
                {fmtNumber(r.found)} found · <b className="font-medium text-fg">{fmtNumber(r.added)} new</b>
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
  const lib = useLibrary();
  const fileRef = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<string | null>(null);
  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => e.usage && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB`));
  }, [lib.counts.total]);

  return (
    <Section title="Data & export" description="Your library is yours. Take it anywhere, any time.">
      <Group title="Export">
        <Row label="Markdown" description="Grouped by category — perfect for Obsidian, Notion or a reading list.">
          <Button variant="outline" size="sm" onClick={() => void exportMarkdown()}>
            <Download /> .md
          </Button>
        </Row>
        <Row label="Spreadsheet" description="Every field, one row per post. Opens in Excel, Numbers, Sheets.">
          <Button variant="outline" size="sm" onClick={() => void exportCsv()}>
            <Download /> .csv
          </Button>
        </Row>
        <Row label="Full backup" description="Everything including notes, tags, collections and categories. Re-import any time.">
          <Button variant="outline" size="sm" onClick={() => void exportJson()}>
            <Download /> .json
          </Button>
        </Row>
      </Group>
      <Group title="Import">
        <Row label="Restore a twtdash backup" description="Merges with what you have — nothing is overwritten except post data.">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp /> Choose file
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
                toast.success(`Imported ${fmtNumber(r.bookmarks)} posts and ${fmtNumber(r.collections)} collections`);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Import failed');
              }
              e.target.value = '';
            }}
          />
        </Row>
      </Group>
      <Group title="Storage">
        <Row label={`${fmtNumber(lib.counts.total)} posts · ${fmtNumber(lib.collections.length)} collections`} description={usage ? `Using about ${usage} in this browser.` : 'Stored in this browser.'} />
        <Row label={<span className="text-bad">Delete everything</span>} description="Removes all posts, notes and collections from twtdash. Your X bookmarks are not touched.">
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (!confirm('Delete your entire twtdash library? This cannot be undone. (Tip: export a backup first.)')) return;
              await wipeLibrary();
              toast('Library deleted');
              navigate('#/home');
            }}
          >
            <Trash /> Delete
          </Button>
        </Row>
      </Group>
    </Section>
  );
}

/* ------------------------------------------------------------------- Plan */

function PlanSection({ settings, update }: { settings: Settings; update: Update }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const lic = settings.license;
  const isPro = lic?.status === 'active';

  return (
    <Section title="Plan" description="twtdash is free forever. Pro adds hosted AI so you never need an API key.">
      <div className="grid gap-3 md:grid-cols-2">
        <div className={cn('rounded-2xl border p-5', !isPro ? 'border-line-strong bg-panel' : 'border-line bg-panel')}>
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">Free</span>
            {!isPro ? <Badge>Current plan</Badge> : null}
          </div>
          <div className="mt-1 text-[26px] font-semibold tracking-tight">$0</div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-fg-2">
            {['Unlimited bookmarks & sync', 'On-device smart categories', 'Search operators, collections, tags, notes', 'Insights & exports', 'AI with your own Anthropic key'].map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-good" /> {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-accent/40 bg-accent-soft p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[15px] font-semibold">
              <Crown className="size-4 text-accent" /> Pro
            </span>
            {isPro ? <Badge className="bg-accent text-white">Active</Badge> : null}
          </div>
          <div className="mt-1 text-[26px] font-semibold tracking-tight">
            ${PRICING.pro.monthly}
            <span className="text-[14px] font-normal text-muted">/mo · or ${PRICING.pro.yearly}/yr</span>
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-fg-2">
            {['Everything in Free', 'Hosted AI categorization — no API key', 'Auto-tags & one-line gists', 'Priority support & early features'].map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-accent" /> {f}
              </li>
            ))}
          </ul>
          {!isPro ? (
            <Button variant="primary" className="mt-4 w-full" onClick={() => window.open(`${BRAND.website}/#pricing`, '_blank', 'noopener')}>
              Upgrade to Pro <ExternalLink />
            </Button>
          ) : null}
        </div>
      </div>

      <Group title="License">
        {lic ? (
          <>
            <Row label={isPro ? 'twtdash Pro is active' : `License ${lic.status}`} description={[lic.plan, lic.email, lic.expiresAt ? `renews/expires ${new Date(lic.expiresAt).toLocaleDateString()}` : null].filter(Boolean).join(' · ') || undefined}>
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
                      toast.success(next.status === 'active' ? 'License is active' : `License is ${next.status}`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Could not check license');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Re-check
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void update((s) => ({ license: null, ai: { ...s.ai, provider: s.ai.provider === 'pro' ? 'off' : s.ai.provider } }))}>
                  Remove
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
                toast.success('Welcome to twtdash Pro! 🎉');
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Activation failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste your license key" className="font-mono text-[13px]" spellCheck={false} />
            <Button type="submit" variant="primary" loading={busy} disabled={!key.trim()}>
              Activate
            </Button>
          </form>
        )}
      </Group>
    </Section>
  );
}

/* ------------------------------------------------------------------ About */

function AboutSection() {
  const setShortcutsOpen = useUi((s) => s.setShortcutsOpen);
  const version = browser.runtime.getManifest?.()?.version ?? '1.0.0';
  return (
    <Section title="About" description={`${BRAND.name} ${version}`}>
      <Group>
        <Row label="Keyboard shortcuts" description="Navigate your library without touching the mouse.">
          <Button size="sm" variant="outline" onClick={() => setShortcutsOpen(true)}>
            <Keyboard /> View
          </Button>
        </Row>
        <Row label="Open dashboard from anywhere" description="Default shortcut Alt+Shift+S. Change it in your browser’s extension shortcuts page." />
        <Row label="Website" description={BRAND.website.replace('https://', '')}>
          <Button size="sm" variant="ghost" onClick={() => window.open(BRAND.website, '_blank', 'noopener')}>
            <ExternalLink />
          </Button>
        </Row>
        <Row label="Privacy policy" description="What twtdash does — and doesn’t do — with your data.">
          <Button size="sm" variant="ghost" onClick={() => window.open(`${BRAND.website}/privacy`, '_blank', 'noopener')}>
            <ExternalLink />
          </Button>
        </Row>
        <Row label="Support" description={BRAND.supportEmail}>
          <Button size="sm" variant="ghost" onClick={() => window.open(`mailto:${BRAND.supportEmail}`)}>
            <ExternalLink />
          </Button>
        </Row>
      </Group>
      <p className="px-1 text-[12px] text-faint">twtdash is not affiliated with or endorsed by X Corp.</p>
    </Section>
  );
}

export function SettingsView({ route, settings, update, onAi }: { route: Route; settings: Settings; update: Update; onAi: (ids?: string[], force?: boolean) => void }) {
  const section = SECTIONS.some((s) => s.id === route.section) ? route.section! : 'general';
  usePaintMark('route:settings:painted', true);
  return (
    <div className="mx-auto flex w-full max-w-[1100px] gap-8 px-5 pt-8 pb-16 sm:px-8">
      <nav className="sticky top-8 hidden h-fit w-52 shrink-0 space-y-0.5 md:block" aria-label="Settings sections">
        <h1 className="mb-4 px-2.5 text-[22px] font-semibold tracking-tight">Settings</h1>
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
            {s.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <div className="mb-6 flex gap-1 overflow-x-auto md:hidden">
          {SECTIONS.map((s) => (
            <button key={s.id} type="button" onClick={() => navigate(`#/settings/${s.id}`)} className={cn('h-8 shrink-0 rounded-full px-3 text-[13px]', section === s.id ? 'bg-accent text-white' : 'bg-panel-2 text-fg-2')}>
              {s.label}
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
