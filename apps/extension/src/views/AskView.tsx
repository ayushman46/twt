import { AI_MODELS, ASK_LIMITS, detectQuestionLanguage } from '@twtdash/shared';
import { HoverCard } from 'radix-ui';
import {
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Crown,
  KeyRound,
  Languages,
  MessagesSquare,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  SquarePen,
  Trash,
  TriangleAlert,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { toast } from 'sonner';
import { create } from 'zustand';
import { AiError, aiReady, type AiErrorCode } from '@/lib/ai-config';
import {
  answerToClipboard,
  askAi,
  clearAskHistory,
  ensureNvidiaAccess,
  loadAskHistory,
  noMatchMessage,
  parseMarkdownLite,
  retrieveForQuestion,
  safeHref,
  saveToAskHistory,
  suggestQuestions,
  warmAskIndex,
  type MdBlock,
  type MdInline,
  type SavedAnswer,
  type Suggestion,
} from '@/lib/ask';
import { fmtNumber, fmtRelative, fmtShortDate, plural } from '@/lib/format';
import { usePaintMark } from '@/lib/perf';
import { searchIndex } from '@/lib/scan-search';
import type { Settings } from '@/lib/storage';
import type { Bookmark } from '@/lib/types';
import { useLibrary } from '@/hooks/library';
import { navigate, type Route } from '@/hooks/route';
import { useUi } from '@/store/ui';
import { Avatar, Logo } from '@/components/Brand';
import { DetailPanel } from '@/components/DetailPanel';
import { CategoryChip } from '@/components/TweetCard';
import { VoiceSearchButton } from '@/components/VoiceSearchButton';
import { Tip } from '@/components/ui/overlays';
import { Button, EmptyState, Eyebrow, Kbd, cn } from '@/components/ui/primitives';

/* ------------------------------------------------------------------ State */

type TurnStatus = 'searching' | 'thinking' | 'streaming' | 'done' | 'stopped' | 'error';

interface Turn {
  id: string;
  question: string;
  at: number;
  status: TurnStatus;
  /** ai: an AI answer · matches: AI off, showing matching posts · empty: nothing matched */
  mode: 'ai' | 'matches' | 'empty';
  answer: string;
  /** Posts given to the model, in [n] order. */
  contextIds: string[];
  citedIds: string[];
  /** "matches" mode: best matching posts. */
  matchIds: string[];
  matchTotal?: number;
  matchQuery?: string;
  error?: string;
  errorCode?: AiErrorCode;
  model?: string;
  truncated?: boolean;
  windowEmpty?: boolean;
  /** Re-opened from saved history (no new request was made). */
  restoredAt?: number;
}

interface AskStore {
  turns: Turn[];
  add: (t: Turn) => void;
  patch: (id: string, p: Partial<Turn>) => void;
  remove: (id: string) => void;
  reset: () => void;
}

const SESSION_KEY = 'twtdash:ask:session';
const settled = (t: Turn) => t.status === 'done' || t.status === 'stopped';

function loadSession(): Turn[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const list = raw ? (JSON.parse(raw) as Turn[]) : [];
    return Array.isArray(list) ? list.filter((t) => t && typeof t.id === 'string' && typeof t.question === 'string' && settled(t)) : [];
  } catch {
    return [];
  }
}

/** The conversation lives for the browser session (it survives switching screens and reloads). */
const useAsk = create<AskStore>((set) => ({
  turns: loadSession(),
  add: (t) => set((s) => ({ turns: [...s.turns, t] })),
  patch: (id, p) => set((s) => ({ turns: s.turns.map((t) => (t.id === id ? { ...t, ...p } : t)) })),
  remove: (id) => set((s) => ({ turns: s.turns.filter((t) => t.id !== id) })),
  reset: () => set({ turns: [] }),
}));

function persistSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(useAsk.getState().turns.filter(settled).slice(-30)));
  } catch {
    /* storage full or blocked */
  }
}

/** In-flight requests by turn id (kept outside React so stop works from anywhere). */
const controllers = new Map<string, AbortController>();

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/* ------------------------------------------------------------ Rendering */

function postText(b: Bookmark): string {
  return b.text || b.article?.title || b.card?.title || 'Media post';
}

function PostPreview({ b }: { b: Bookmark }) {
  const lib = useLibrary();
  return (
    <div className="text-left">
      <div className="flex items-center gap-2.5">
        <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-fg">{b.author.name}</div>
          <div className="truncate text-[12px] text-muted">
            @{b.author.handle} · saved {fmtShortDate(b.savedAt)}
          </div>
        </div>
      </div>
      <p dir="auto" className="mt-2.5 line-clamp-6 text-[13px] leading-relaxed whitespace-pre-line text-fg-2">
        {postText(b)}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <CategoryChip category={lib.categoryMap.get(b.category)} />
        <span className="text-[11.5px] text-faint">Click to open</span>
      </div>
    </div>
  );
}

function CitationChip({ n, b, onOpen }: { n: number; b?: Bookmark; onOpen: (id: string) => void }) {
  const chip = 'mx-[1px] inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[6px] px-1 align-[1.5px] text-[10.5px] leading-none font-semibold tabular-nums transition-colors';
  if (!b) {
    return (
      <span className={cn(chip, 'bg-panel-2 text-faint')} title="This post is no longer in your library">
        {n}
      </span>
    );
  }
  return (
    <HoverCard.Root openDelay={150} closeDelay={60}>
      <HoverCard.Trigger asChild>
        <button
          type="button"
          onClick={() => onOpen(b.id)}
          aria-label={`Source ${n}: post by @${b.author.handle}`}
          className={cn(chip, 'bg-accent-soft text-accent hover:bg-accent hover:text-white focus-visible:bg-accent focus-visible:text-white')}
        >
          {n}
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content side="top" sideOffset={6} collisionPadding={12} className="z-[80] w-[320px] max-w-[calc(100vw-24px)] animate-fade-in rounded-2xl border border-line bg-panel p-3.5 shadow-pop outline-none">
          <PostPreview b={b} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

interface RenderCtx {
  cite: (n: number) => ReactNode;
  allowLink: (href: string) => boolean;
}

function Inline({ nodes, ctx }: { nodes: MdInline[]; ctx: RenderCtx }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.t) {
          case 'text':
            return <Fragment key={i}>{node.v}</Fragment>;
          case 'strong':
            return (
              <strong key={i} className="font-semibold text-fg">
                <Inline nodes={node.c} ctx={ctx} />
              </strong>
            );
          case 'em':
            return (
              <em key={i}>
                <Inline nodes={node.c} ctx={ctx} />
              </em>
            );
          case 'code':
            return (
              <code key={i} className="rounded-md bg-panel-2 px-1.5 py-0.5 font-mono text-[0.88em] text-fg">
                {node.v}
              </code>
            );
          case 'link':
            return ctx.allowLink(node.href) ? (
              <a key={i} href={node.href} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
                <Inline nodes={node.c} ctx={ctx} />
              </a>
            ) : (
              <span key={i} title="This link isn’t in your saved posts">
                <Inline nodes={node.c} ctx={ctx} />
              </span>
            );
          case 'cite':
            return <Fragment key={i}>{ctx.cite(node.n)}</Fragment>;
        }
      })}
    </>
  );
}

const caret = <span aria-hidden className="ml-0.5 inline-block h-[1.1em] w-[3px] translate-y-[3px] animate-pulse rounded-full bg-accent" />;

function Markdown({ blocks, ctx, streaming }: { blocks: MdBlock[]; ctx: RenderCtx; streaming?: boolean }) {
  if (!blocks.length) return streaming ? <p>{caret}</p> : null;
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const tail = streaming && i === blocks.length - 1 ? caret : null;
        switch (block.t) {
          case 'p':
            return (
              <p key={i} dir="auto" className="whitespace-pre-line">
                <Inline nodes={block.c} ctx={ctx} />
                {tail}
              </p>
            );
          case 'h':
            return (
              <p key={i} dir="auto" className="pt-1 font-semibold text-fg">
                <Inline nodes={block.c} ctx={ctx} />
                {tail}
              </p>
            );
          case 'quote':
            return (
              <blockquote key={i} dir="auto" className="border-l-2 border-accent/40 pl-3.5 text-fg-2 italic">
                <Inline nodes={block.c} ctx={ctx} />
                {tail}
              </blockquote>
            );
          case 'pre':
            return (
              <pre key={i} className="overflow-x-auto rounded-xl border border-line bg-panel-2 p-3 font-mono text-[12.5px] leading-relaxed text-fg">
                <code>{block.v}</code>
                {tail}
              </pre>
            );
          case 'list': {
            const ListTag = block.ordered ? 'ol' : 'ul';
            return (
              <ListTag key={i} start={block.ordered && block.start !== 1 ? block.start : undefined} className={cn('space-y-1.5 pl-5', block.ordered ? 'list-decimal marker:text-muted' : 'list-disc marker:text-accent/70')}>
                {block.items.map((item, j) => (
                  <li key={j} dir="auto" className={cn('pl-1', item.depth > 0 && 'ml-5 list-[circle]')}>
                    <Inline nodes={item.c} ctx={ctx} />
                    {tail && j === block.items.length - 1 ? tail : null}
                  </li>
                ))}
              </ListTag>
            );
          }
        }
      })}
    </div>
  );
}

function linkHosts(posts: Bookmark[]): Set<string> {
  const hosts = new Set<string>();
  const add = (url?: string) => {
    const href = url && safeHref(url);
    if (href) hosts.add(new URL(href).hostname.replace(/^www\./, ''));
  };
  for (const b of posts) {
    add(b.url);
    add(b.card?.url);
    for (const l of b.links) add(l.url);
    for (const m of b.text.match(/https?:\/\/\S+/g) ?? []) add(m);
  }
  return hosts;
}

/* -------------------------------------------------------------- Pieces */

function ProviderPill({ settings }: { settings: Settings }) {
  if (!aiReady(settings)) {
    return (
      <button
        type="button"
        onClick={() => navigate('#/settings/ai')}
        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 text-[12px] text-muted shadow-card transition-colors hover:border-line-strong hover:text-fg"
      >
        <span className="size-1.5 rounded-full bg-faint" />
        Matching only · <span className="font-medium text-accent">turn on AI</span>
      </button>
    );
  }
  const label = settings.ai.provider === 'pro' ? 'twtdash Pro' : `NVIDIA · ${AI_MODELS.find((m) => m.id === settings.ai.model)?.label ?? settings.ai.model}`;
  return (
    <Tip label={settings.ai.provider === 'pro' ? 'Answers by the hosted twtdash AI' : 'Answers by NVIDIA with your free key. Change the model in Settings → AI.'}>
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 text-[12px] text-muted shadow-card">
        <span className="size-1.5 rounded-full bg-good shadow-[0_0_0_3px_color-mix(in_oklab,var(--good)_20%,transparent)]" />
        {label}
      </span>
    </Tip>
  );
}

function KeyCta({ settings }: { settings: Settings }) {
  const proInactive = settings.ai.provider === 'pro';
  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl border border-line bg-panel p-5 shadow-card">
      <span aria-hidden className="aurora absolute inset-0 opacity-70" />
      <div className="relative flex flex-wrap items-center gap-4">
        <span className="bg-brand grid size-11 shrink-0 place-items-center rounded-[14px] text-white shadow-[0_10px_24px_-10px_rgb(150_80_255/0.8)]">
          {proInactive ? <Crown className="size-5" /> : <Sparkles className="size-5" />}
        </span>
        <div className="min-w-[220px] flex-1">
          <div className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{proInactive ? 'Your Pro license isn’t active' : 'Get answers with a free NVIDIA key'}</div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            {proInactive
              ? 'Reactivate Pro, or switch to a free NVIDIA key, to get written answers with sources.'
              : 'twtdash reads the matching posts and writes a short answer with sources, in English, हिन्दी or Hinglish. Free, no card, and the key stays in this browser.'}
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate(proInactive ? '#/settings/plan' : '#/settings/ai')}>
          {proInactive ? 'Go to Plan' : 'Add a free key'} <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

function SourceCard({ n, b, onOpen }: { n: number; b: Bookmark; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(b.id)}
      className="group flex w-full min-w-0 gap-2.5 rounded-xl border border-line bg-panel p-3 text-left shadow-card transition-all duration-200 hover:-translate-y-px hover:border-line-strong hover:shadow-hover"
    >
      <span className="mt-px grid size-5 shrink-0 place-items-center rounded-md bg-accent-soft text-[11px] font-semibold text-accent tabular-nums">{n}</span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5 text-[12.5px]">
          <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={18} />
          <span className="truncate font-semibold text-fg">{b.author.name}</span>
          <span className="shrink-0 text-faint">· {fmtShortDate(b.savedAt)}</span>
        </div>
        <p dir="auto" className="mt-1 line-clamp-2 text-[13px] leading-snug text-fg-2">
          {postText(b)}
        </p>
      </div>
    </button>
  );
}

function MatchRow({ b, onOpen }: { b: Bookmark; onOpen: (id: string) => void }) {
  const lib = useLibrary();
  const c = lib.categoryMap.get(b.category);
  return (
    <button type="button" onClick={() => onOpen(b.id)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-panel-2/60">
      <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[12.5px]">
          <span className="truncate font-semibold">{b.author.name}</span>
          <span className="shrink-0 text-muted">· {fmtShortDate(b.savedAt)}</span>
        </div>
        <p dir="auto" className="mt-0.5 line-clamp-2 text-[13.5px] leading-snug text-fg-2">
          {postText(b)}
        </p>
      </div>
      {c ? (
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-panel-2 text-[14px]" title={c.name}>
          {c.emoji}
        </span>
      ) : null}
    </button>
  );
}

function Thinking({ turn, byId }: { turn: Turn; byId: Map<string, Bookmark> }) {
  const lib = useLibrary();
  const faces = useMemo(() => {
    const seen = new Set<string>();
    const out: Bookmark[] = [];
    for (const id of turn.contextIds) {
      const b = byId.get(id);
      if (b && !seen.has(b.author.handle)) {
        seen.add(b.author.handle);
        out.push(b);
      }
      if (out.length >= 5) break;
    }
    return out;
  }, [turn.contextIds, byId]);
  return (
    <div aria-live="polite">
      <div className="flex items-center gap-2.5 text-[13.5px] text-muted">
        {turn.status === 'searching' ? (
          <>
            <Search className="size-4 animate-pulse text-accent" /> Searching {plural(lib.counts.total, 'saved post')}…
          </>
        ) : (
          <>
            <span className="flex -space-x-1.5">
              {faces.map((b) => (
                <Avatar key={b.id} src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={20} className="ring-2 ring-bg" />
              ))}
            </span>
            Reading {plural(turn.contextIds.length, 'matching post')}…
          </>
        )}
      </div>
      <div className="mt-4 space-y-2.5">
        <div className="skeleton h-3.5 w-[92%] rounded-full" />
        <div className="skeleton h-3.5 w-[78%] rounded-full" />
        <div className="skeleton h-3.5 w-[56%] rounded-full" />
      </div>
    </div>
  );
}

function ErrorCard({ turn, onRetry }: { turn: Turn; onRetry: () => void }) {
  const code = turn.errorCode;
  return (
    <div role="alert" className="flex gap-3 rounded-2xl border border-bad/25 bg-bad/[0.06] p-4">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] leading-relaxed font-medium text-fg">{turn.error}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw /> Try again
          </Button>
          {code === 'auth' || code === 'config' ? (
            <Button size="sm" variant="ghost" onClick={() => navigate('#/settings/ai')}>
              <KeyRound /> Open AI settings
            </Button>
          ) : code === 'license' ? (
            <Button size="sm" variant="ghost" onClick={() => navigate('#/settings/plan')}>
              <Crown /> Check your plan
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="xs"
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          toast.error('Couldn’t copy to the clipboard');
        }
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function Sources({ turn, byId, onOpen }: { turn: Turn; byId: Map<string, Bookmark>; onOpen: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const [others, setOthers] = useState(false);
  const cited = turn.citedIds.map((id) => ({ n: turn.contextIds.indexOf(id) + 1, b: byId.get(id) })).filter((x): x is { n: number; b: Bookmark } => !!x.b && x.n > 0);
  const uncited = turn.contextIds.map((id, i) => ({ n: i + 1, b: byId.get(id) })).filter((x): x is { n: number; b: Bookmark } => !!x.b && !turn.citedIds.includes(x.b.id));
  if (!cited.length && !uncited.length) return null;
  const shown = all ? cited : cited.slice(0, 4);
  return (
    <div className="mt-5">
      {cited.length ? (
        <>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">
            Sources <span className="rounded-full bg-panel-2 px-1.5 py-px text-[10.5px] tracking-normal text-muted tabular-nums">{cited.length}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {shown.map(({ n, b }) => (
              <SourceCard key={b.id} n={n} b={b} onOpen={onOpen} />
            ))}
          </div>
          {cited.length > 4 ? (
            <Button size="xs" variant="ghost" className="mt-1.5" onClick={() => setAll((v) => !v)}>
              {all ? 'Show fewer' : `Show all ${cited.length} sources`}
            </Button>
          ) : null}
        </>
      ) : null}
      {uncited.length ? (
        <div className="mt-2">
          <button type="button" onClick={() => setOthers((v) => !v)} className="inline-flex items-center gap-1 text-[12px] text-faint transition-colors hover:text-fg-2" aria-expanded={others}>
            <ChevronDown className={cn('size-3.5 transition-transform', others && 'rotate-180')} />
            {cited.length ? `Also read ${plural(uncited.length, 'post')} that weren’t cited` : `Read ${plural(uncited.length, 'post')}`}
          </button>
          {others ? (
            <div className="mt-2 grid animate-fade-in gap-2 sm:grid-cols-2">
              {uncited.map(({ n, b }) => (
                <SourceCard key={b.id} n={n} b={b} onOpen={onOpen} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TurnView({ turn, settings, last, onRetry, onOpen }: { turn: Turn; settings: Settings; last: boolean; onRetry: (t: Turn) => void; onOpen: (id: string) => void }) {
  const lib = useLibrary();
  const byId = lib.byId;
  const streaming = turn.status === 'streaming';
  const contextPosts = useMemo(() => turn.contextIds.map((id) => byId.get(id)).filter((b): b is Bookmark => !!b), [turn.contextIds, byId]);
  const hosts = useMemo(() => linkHosts(contextPosts), [contextPosts]);
  const blocks = useMemo(() => parseMarkdownLite(turn.answer, { maxCite: turn.contextIds.length, streaming }), [turn.answer, turn.contextIds.length, streaming]);
  const ctx: RenderCtx = useMemo(
    () => ({
      cite: (n) => <CitationChip n={n} b={byId.get(turn.contextIds[n - 1] ?? '')} onOpen={onOpen} />,
      allowLink: (href) => hosts.has(new URL(href).hostname.replace(/^www\./, '')),
    }),
    [byId, turn.contextIds, hosts, onOpen],
  );
  const sources = turn.citedIds.map((id) => ({ n: turn.contextIds.indexOf(id) + 1, b: byId.get(id) })).filter((x): x is { n: number; b: Bookmark } => !!x.b && x.n > 0);
  const matches = turn.matchIds.map((id) => byId.get(id)).filter((b): b is Bookmark => !!b);

  return (
    <article id={`turn-${turn.id}`} className={cn('scroll-mt-16 animate-rise lg:scroll-mt-6', last && 'min-h-[calc(100dvh-230px)]')}>
      <div className="flex justify-end">
        <div dir="auto" className="max-w-[85%] rounded-[20px] rounded-br-md bg-accent-soft px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-fg">
          {turn.question}
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-panel shadow-card ring-1 ring-line">
          <Logo className="size-[22px]" />
        </span>
        <div className="min-w-0 flex-1 pt-1">
          {turn.restoredAt ? (
            <div className="mb-2 inline-flex items-center gap-1.5 text-[11.5px] text-faint">
              <Clock className="size-3" /> Saved answer from {fmtRelative(turn.restoredAt)}
            </div>
          ) : null}
          {turn.windowEmpty && turn.status !== 'searching' ? (
            <div className="mb-2 text-[12.5px] text-muted">Nothing was saved in that period, so this searched your whole library.</div>
          ) : null}

          {turn.status === 'searching' || turn.status === 'thinking' ? (
            <Thinking turn={turn} byId={byId} />
          ) : turn.status === 'error' ? (
            <ErrorCard turn={turn} onRetry={() => onRetry(turn)} />
          ) : turn.mode === 'matches' ? (
            <div>
              {matches.length ? (
                <>
                  <p className="text-[15px] leading-relaxed text-fg-2">
                    Here are the posts that match
                    {turn.matchTotal && turn.matchTotal > matches.length ? <span className="text-muted"> · {fmtNumber(turn.matchTotal)} found</span> : null}
                  </p>
                  <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
                    {matches.map((b) => (
                      <MatchRow key={b.id} b={b} onOpen={onOpen} />
                    ))}
                  </div>
                  {turn.matchTotal && turn.matchTotal > matches.length && turn.matchQuery ? (
                    <Button size="sm" variant="ghost" className="mt-2" onClick={() => (useUi.getState().setQuery(turn.matchQuery!), navigate('#/library/all'))}>
                      See all {fmtNumber(turn.matchTotal)} in your library <ArrowRight />
                    </Button>
                  ) : null}
                </>
              ) : (
                <p dir="auto" className="text-[15px] leading-relaxed text-fg-2">
                  {noMatchMessage(detectQuestionLanguage(turn.question))}
                </p>
              )}
              <KeyCta settings={settings} />
            </div>
          ) : (
            <div className="text-[15px] leading-[1.75] text-fg-2">
              <Markdown blocks={blocks} ctx={ctx} streaming={streaming} />
              {turn.status === 'stopped' ? (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-panel-2 px-2.5 py-1 text-[12px] text-muted">
                  <Square className="size-2.5 fill-current" /> Stopped
                </div>
              ) : null}
              {turn.truncated ? <div className="mt-3 text-[12.5px] text-muted">The answer was cut short. Ask a narrower question for the rest.</div> : null}
            </div>
          )}

          {(turn.status === 'done' || turn.status === 'stopped') && turn.mode === 'ai' ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-1">
                {turn.answer ? <CopyButton text={answerToClipboard(turn.answer, sources)} /> : null}
                <Button size="xs" variant="ghost" onClick={() => onRetry(turn)}>
                  <RotateCcw /> {turn.restoredAt ? 'Ask again' : 'Retry'}
                </Button>
                {turn.model ? <span className="ml-auto truncate pl-2 text-[11px] text-faint">{AI_MODELS.find((m) => m.id === turn.model)?.label ?? turn.model}</span> : null}
              </div>
              <Sources turn={turn} byId={byId} onOpen={onOpen} />
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  hero,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  hero?: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const baseRef = useRef('');
  const [listening, setListening] = useState(false);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, hero ? 220 : 180)}px`;
  }, [value, hero, inputRef]);

  const canSend = !!value.trim() && !busy;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSubmit();
      }}
      className={cn(
        'group/composer relative rounded-[22px] border bg-panel transition-[border-color,box-shadow] duration-200 focus-within:border-accent/50 focus-within:ring-4 focus-within:ring-accent/10',
        hero ? 'border-line-strong shadow-hover' : 'border-line-strong shadow-pop',
        listening && 'border-accent/60 ring-4 ring-accent/15',
      )}
    >
      <label htmlFor="ask-input" className="sr-only">
        Ask a question about your saved posts
      </label>
      <textarea
        id="ask-input"
        ref={inputRef}
        rows={1}
        dir="auto"
        value={value}
        maxLength={ASK_LIMITS.questionChars}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Don't send while an input method (Hindi, Tamil… keyboards) is still composing.
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
            e.preventDefault();
            if (canSend) onSubmit();
          }
        }}
        placeholder={listening ? 'Listening… speak your question' : 'Ask anything about what you saved…'}
        className={cn(
          'block w-full resize-none bg-transparent px-4 pt-3.5 text-fg outline-none placeholder:text-faint',
          hero ? 'min-h-[60px] text-[16.5px] leading-relaxed sm:px-5 sm:pt-4' : 'min-h-[48px] text-[15px] leading-relaxed',
        )}
      />
      <div className={cn('flex items-center gap-2 px-2 pb-2', hero && 'sm:px-3 sm:pb-3')}>
        <VoiceSearchButton
          purpose="Speak your question"
          disabled={busy}
          onListeningChange={(on) => {
            setListening(on);
            if (on) baseRef.current = valueRef.current.trim() ? `${valueRef.current.trimEnd()} ` : '';
          }}
          onResult={(text) => {
            onChange((baseRef.current + text).slice(0, ASK_LIMITS.questionChars));
            inputRef.current?.focus();
          }}
        />
        <div className="ml-auto flex items-center gap-2">
          {value.length > ASK_LIMITS.questionChars * 0.8 ? (
            <span className="text-[11.5px] text-faint tabular-nums">
              {value.length}/{ASK_LIMITS.questionChars}
            </span>
          ) : (
            <span className="hidden items-center gap-1 text-[11.5px] text-faint sm:inline-flex">
              <Kbd>↵</Kbd> to ask · <Kbd>Shift</Kbd>
              <Kbd>↵</Kbd> new line
            </span>
          )}
          {busy ? (
            <Tip label="Stop">
              <button type="button" onClick={onStop} aria-label="Stop generating" className="grid size-9 place-items-center rounded-full bg-fg text-bg shadow-card transition-transform active:scale-95">
                <Square className="size-3.5 fill-current" />
              </button>
            </Tip>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Ask"
              className="btn-brand grid size-9 place-items-center rounded-full transition-[transform,opacity,filter] active:scale-95 disabled:pointer-events-none disabled:opacity-35 disabled:shadow-none"
            >
              <ArrowUp className="size-[18px]" strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function SuggestionGrid({ items, onPick }: { items: Suggestion[]; onPick: (q: string) => void }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {items.map((s, i) => (
        <button
          key={s.text}
          type="button"
          onClick={() => onPick(s.text)}
          style={{ animationDelay: `${120 + i * 45}ms` }}
          className="group flex animate-rise items-start gap-3 rounded-2xl border border-line bg-panel px-4 py-3.5 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-hover"
        >
          <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg [&_svg]:size-3.5', s.lang === 'en' ? 'bg-accent-soft text-accent' : 'bg-[color-mix(in_oklab,var(--grad-3)_14%,transparent)] text-[color-mix(in_oklab,var(--grad-3)_80%,var(--fg))]')}>
            {s.lang === 'en' ? <Sparkles /> : <Languages />}
          </span>
          <span dir="auto" lang={s.lang === 'hi' ? 'hi' : s.lang === 'hinglish' ? 'hi-Latn' : 'en'} className="min-w-0 flex-1 text-[14px] leading-snug text-fg-2 group-hover:text-fg">
            {s.text}
          </span>
          <ArrowRight className="mt-1 size-3.5 shrink-0 -translate-x-1 text-faint opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );
}

function RecentQuestions({ items, onOpen, onClear }: { items: SavedAnswer[]; onOpen: (s: SavedAnswer) => void; onClear: () => void }) {
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, 5);
  return (
    <section className="mt-10 animate-rise [animation-delay:200ms]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-fg-2">
          <Clock className="size-4 text-muted" /> Recent questions
        </h2>
        <Button size="xs" variant="ghost" onClick={onClear}>
          <Trash /> Clear
        </Button>
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
        {shown.map((s) => (
          <button key={s.id} type="button" onClick={() => onOpen(s)} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-panel-2/60">
            <MessagesSquare className="size-4 shrink-0 text-faint group-hover:text-accent" />
            <span dir="auto" className="min-w-0 flex-1 truncate text-[13.5px] text-fg-2 group-hover:text-fg">
              {s.question}
            </span>
            <span className="shrink-0 text-[11.5px] text-faint">{fmtShortDate(s.at)}</span>
          </button>
        ))}
      </div>
      {items.length > 5 ? (
        <Button size="xs" variant="ghost" className="mt-1.5" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </Button>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ View */

export function AskView({ route, settings }: { route: Route; settings: Settings }) {
  const lib = useLibrary();
  const turns = useAsk((s) => s.turns);
  const openDetail = useUi((s) => s.openDetail);
  const [value, setValue] = useState('');
  const [recent, setRecent] = useState<SavedAnswer[]>(loadAskHistory);
  const heroRef = useRef<HTMLTextAreaElement>(null);
  const dockRef = useRef<HTMLTextAreaElement>(null);
  const ready = aiReady(settings);
  const busy = turns.some((t) => t.status === 'searching' || t.status === 'thinking' || t.status === 'streaming');

  usePaintMark('route:ask:painted', !lib.loading);

  // Prefill from #/ask?q=…
  useEffect(() => {
    if (route.q) {
      setValue(route.q.slice(0, ASK_LIMITS.questionChars));
      requestAnimationFrame(() => (heroRef.current ?? dockRef.current)?.focus());
    }
  }, [route.q]);

  // Build ranking statistics in idle time so the first answer starts instantly.
  useEffect(() => {
    if (lib.loading || lib.partial || !lib.bookmarks.length) return;
    return warmAskIndex(lib.bookmarks, lib.categoryMap);
  }, [lib.loading, lib.partial, lib.bookmarks, lib.categoryMap]);

  // A new question scrolls to the top of the screen and its answer streams in below it.
  const lastId = turns[turns.length - 1]?.id;
  useEffect(() => {
    if (!lastId) return;
    const frame = requestAnimationFrame(() => document.getElementById(`turn-${lastId}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [lastId]);

  const suggestions = useMemo(
    () =>
      suggestQuestions({
        bookmarks: lib.bookmarks,
        categories: lib.categories,
        categoryCounts: lib.counts.categories,
        tags: lib.tags,
        authors: lib.authors,
      }),
    [lib.bookmarks, lib.categories, lib.counts.categories, lib.tags, lib.authors],
  );

  const threadPosts = useMemo(() => {
    const ids = new Set<string>();
    for (const t of turns) for (const id of t.mode === 'matches' ? t.matchIds : t.citedIds.length ? t.citedIds : t.contextIds) ids.add(id);
    return [...ids].map((id) => lib.byId.get(id)).filter((b): b is Bookmark => !!b);
  }, [turns, lib.byId]);

  const onOpen = useCallback((id: string) => openDetail(id), [openDetail]);

  const ask = (raw: string) => {
    const question = raw.trim().slice(0, ASK_LIMITS.questionChars);
    if (!question || busy) return;
    // Must start inside the click / key press so the browser can show its permission prompt.
    const access = ready ? ensureNvidiaAccess(settings) : Promise.resolve();
    const store = useAsk.getState();
    const prior = [...store.turns].reverse().find((t) => t.mode === 'ai' && t.answer && t.status === 'done');
    const history = store.turns.filter((t) => t.mode === 'ai' && t.status === 'done' && t.answer).slice(-3).map((t) => ({ question: t.question, answer: t.answer }));
    const turn: Turn = { id: newId(), question, at: Date.now(), status: 'searching', mode: ready ? 'ai' : 'matches', answer: '', contextIds: [], citedIds: [], matchIds: [] };
    store.add(turn);
    setValue('');

    void (async () => {
      // Let "Searching…" paint before ranking a large library.
      await new Promise((r) => setTimeout(r, 16));
      const retrieval = retrieveForQuestion(question, lib.bookmarks, {
        categories: lib.categoryMap,
        substringSearch: (s) => searchIndex.search(s),
        previous: prior ? { question: prior.question, citedIds: prior.citedIds } : undefined,
      });
      const patch = (p: Partial<Turn>) => useAsk.getState().patch(turn.id, p);

      if (!ready) {
        patch({
          status: 'done',
          mode: 'matches',
          matchIds: retrieval.ranked.slice(0, 8).map((r) => r.b.id),
          matchTotal: retrieval.ranked.length,
          matchQuery: retrieval.analysis.words.join(' '),
          windowEmpty: retrieval.windowEmpty,
        });
        persistSession();
        return;
      }
      if (!retrieval.context.length) {
        patch({ status: 'done', mode: 'empty', answer: noMatchMessage(retrieval.analysis.language), windowEmpty: retrieval.windowEmpty });
        persistSession();
        return;
      }

      const contextIds = retrieval.context.map((b) => b.id);
      patch({ status: 'thinking', contextIds, windowEmpty: retrieval.windowEmpty });
      const controller = new AbortController();
      controllers.set(turn.id, controller);
      let frame = 0;
      let pending = '';
      try {
        await access;
        const result = await askAi({
          question,
          context: retrieval.context,
          settings,
          categories: lib.categoryMap,
          history,
          signal: controller.signal,
          onText: (text) => {
            pending = text;
            if (!frame)
              frame = requestAnimationFrame(() => {
                frame = 0;
                patch({ answer: pending, status: 'streaming' });
              });
          },
        });
        cancelAnimationFrame(frame);
        patch({ status: result.stopped ? 'stopped' : 'done', answer: result.answer, contextIds: result.contextIds, citedIds: result.citedIds, model: result.model, truncated: result.truncated });
        if (!result.stopped && result.answer) {
          setRecent(saveToAskHistory({ id: turn.id, question, answer: result.answer, contextIds: result.contextIds, citedIds: result.citedIds, model: result.model, at: Date.now() }));
        }
      } catch (err) {
        cancelAnimationFrame(frame);
        patch({ status: 'error', error: err instanceof Error ? err.message : 'Something went wrong. Try again.', errorCode: err instanceof AiError ? err.code : undefined });
      } finally {
        controllers.delete(turn.id);
        persistSession();
      }
    })();
  };

  const stop = () => {
    for (const c of controllers.values()) c.abort();
  };

  const retry = (t: Turn) => {
    if (busy) return;
    useAsk.getState().remove(t.id);
    ask(t.question);
  };

  const restore = (s: SavedAnswer) => {
    if (busy) return;
    useAsk.getState().add({ id: newId(), question: s.question, at: Date.now(), status: 'done', mode: 'ai', answer: s.answer, contextIds: s.contextIds, citedIds: s.citedIds, matchIds: [], model: s.model, restoredAt: s.at });
    persistSession();
  };

  const newChat = () => {
    stop();
    useAsk.getState().reset();
    persistSession();
    setValue('');
    requestAnimationFrame(() => heroRef.current?.focus());
  };

  const clearRecent = () => {
    clearAskHistory();
    setRecent([]);
    toast.success('Cleared your recent questions');
  };

  if (lib.loading) {
    return (
      <div className="mx-auto w-full max-w-[1240px] px-5 pt-8 sm:px-8">
        <div className="mx-auto max-w-[820px]">
          <div className="skeleton mx-auto mt-16 h-10 w-72 rounded-xl" />
          <div className="skeleton mt-8 h-[120px] rounded-[22px]" />
        </div>
      </div>
    );
  }

  if (!lib.counts.total) {
    return (
      <div className="mx-auto w-full max-w-[1240px] px-5 pt-8 sm:px-8">
        <EmptyState
          icon={<MessagesSquare />}
          title="Nothing to ask about yet"
          action={
            <Button variant="primary" onClick={() => navigate('#/home')}>
              Sync your bookmarks <ArrowRight />
            </Button>
          }
        >
          Once your X bookmarks are synced you can ask questions about them here, in English, हिन्दी or Hinglish.
        </EmptyState>
      </div>
    );
  }

  const composer = (hero: boolean) => <Composer value={value} onChange={setValue} onSubmit={() => ask(value)} onStop={stop} busy={busy} hero={hero} inputRef={hero ? heroRef : dockRef} />;

  return (
    <div className="relative flex min-h-[calc(100vh-48px)] flex-col lg:min-h-screen">
      <div aria-hidden className="aurora pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-80" />
      <div aria-hidden className="dot-grid pointer-events-none absolute inset-x-0 top-0 h-[340px] [mask-image:linear-gradient(to_bottom,black,transparent)] opacity-35" />

      <div className="relative mx-auto w-full max-w-[1240px] flex-1 px-5 pt-8 sm:px-8">
        <div className="mx-auto w-full max-w-[820px]">
          {turns.length ? (
            <>
              <header className="flex flex-wrap items-center gap-3 pb-6">
                <h1 className="flex items-center gap-2.5 text-[20px] font-semibold tracking-[-0.03em]">
                  <MessagesSquare className="size-5 text-accent" /> Ask your bookmarks
                </h1>
                <div className="ml-auto flex items-center gap-2">
                  <ProviderPill settings={settings} />
                  <Button size="sm" variant="outline" onClick={newChat} disabled={busy}>
                    <SquarePen /> New chat
                  </Button>
                </div>
              </header>
              <div className="space-y-10 pb-8">
                {turns.map((t, i) => (
                  <TurnView key={t.id} turn={t} settings={settings} last={i === turns.length - 1} onRetry={retry} onOpen={onOpen} />
                ))}
              </div>
            </>
          ) : (
            <div className="pb-16">
              <header className="animate-rise pt-4 text-center sm:pt-10">
                <Eyebrow>Ask your bookmarks</Eyebrow>
                <h1 className="mx-auto mt-3 max-w-[640px] text-[34px] leading-[1.08] font-semibold tracking-[-0.045em] text-balance sm:text-[44px]">
                  What did you <span className="serif-accent text-brand pr-1 text-[1.12em]">save</span> about…?
                </h1>
                <p className="mx-auto mt-3 max-w-[560px] text-[15px] leading-relaxed text-balance text-muted">
                  Answers come only from your {plural(lib.counts.total, 'saved post')}, with every claim linked to its source. Ask in English, हिन्दी, Hinglish or any Indian language.
                </p>
              </header>

              <div className="mt-8 animate-rise [animation-delay:60ms]">{composer(true)}</div>

              <div className="mt-3 flex animate-rise flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[12px] text-faint [animation-delay:90ms]">
                <ProviderPill settings={settings} />
                {ready ? (
                  <span>{settings.ai.provider === 'pro' ? 'Only the most relevant posts are sent with your question.' : 'Only the most relevant posts are sent to NVIDIA with your question.'}</span>
                ) : (
                  <span>Without AI you’ll get the best-matching posts.</span>
                )}
              </div>

              {suggestions.length ? (
                <section className="mt-10">
                  <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-fg-2">
                    <Sparkles className="size-4 text-accent" /> Try asking
                  </h2>
                  <SuggestionGrid items={suggestions} onPick={ask} />
                </section>
              ) : null}

              <RecentQuestions items={recent} onOpen={restore} onClear={clearRecent} />
            </div>
          )}
        </div>
      </div>

      {turns.length ? (
        <div className="sticky bottom-0 z-20 mt-auto">
          <div aria-hidden className="pointer-events-none h-8 bg-gradient-to-b from-transparent to-bg" />
          <div className="bg-bg px-5 pb-4 sm:px-8 sm:pb-6">
            <div className="mx-auto w-full max-w-[820px]">
              {composer(false)}
              <p className="mt-2 text-center text-[11.5px] text-faint">Answers use only your saved posts and can still be wrong. Check the sources.</p>
            </div>
          </div>
        </div>
      ) : null}

      <DetailPanel items={threadPosts} onSearch={(q) => (useUi.getState().setQuery(q), navigate('#/library/all'))} />
    </div>
  );
}
