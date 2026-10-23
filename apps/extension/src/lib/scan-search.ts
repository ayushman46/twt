/**
 * Full-text search by scanning precomputed lowercase haystacks.
 *
 * Building an inverted index (MiniSearch) for a 10k-post library cost several
 * seconds of main-thread time at startup. A substring scan over cached
 * haystacks needs no index, answers a query over 10k posts in a few ms, and
 * builds each haystack lazily (or during idle time via `warm()`).
 */
import { perfStat } from './perf';
import type { Bookmark } from './types';

interface Entry {
  sig: string;
  all: string;
  who: string;
  body: string;
  extra: string;
  note: string;
  tags: string;
}

const WORD = /[\p{L}\p{N}]/u;
const SEP = '\u0001';

function signature(b: Bookmark): string {
  return `${b.updatedAt}|${b.note.length}|${b.tags.length}|${b.summary?.length ?? 0}`;
}

function build(b: Bookmark, sig: string): Entry {
  const who = `${b.author.name} @${b.author.handle}`.toLowerCase();
  const body = (b.quoted ? `${b.text}\n${b.quoted.text}` : b.text).toLowerCase();
  const extraParts: string[] = [];
  if (b.card?.title) extraParts.push(b.card.title);
  if (b.card?.description) extraParts.push(b.card.description);
  if (b.article) extraParts.push(b.article.title, b.article.preview ?? '');
  if (b.summary) extraParts.push(b.summary);
  for (const l of b.links) extraParts.push(l.display);
  for (const m of b.media) if (m.alt) extraParts.push(m.alt);
  const extra = extraParts.join(' ').toLowerCase();
  const note = b.note.toLowerCase();
  const tags = b.tags.join(' ');
  return { sig, who, body, extra, note, tags, all: who + SEP + body + SEP + extra + SEP + note + SEP + tags };
}

/** 3 = whole word, 2 = word prefix, 1 = inside a word, 0 = absent. */
function fieldScore(field: string, term: string): number {
  const i = field.indexOf(term);
  if (i < 0) return 0;
  const start = i === 0 || !WORD.test(field[i - 1]!);
  if (!start) return 1;
  const end = i + term.length;
  return end === field.length || !WORD.test(field[end]!) ? 3 : 2;
}

function score(e: Entry, terms: string[]): number {
  let s = 0;
  for (const t of terms) {
    s += fieldScore(e.who, t) * 2.5 + fieldScore(e.tags, t) * 1.6 + fieldScore(e.note, t) * 1.3 + fieldScore(e.body, t) + fieldScore(e.extra, t) * 0.8;
  }
  return s;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}#@$]+|[^\p{L}\p{N}+#]+$/gu, ''))
    .filter(Boolean);
}

export class SearchIndex {
  private entries = new Map<string, Entry>();
  private list: Bookmark[] = [];
  private warmHandle: number | null = null;

  /** O(1): remember the current library. Haystacks are built on demand. */
  sync(list: Bookmark[]) {
    this.list = list;
    if (this.entries.size > list.length * 1.5 + 100) this.entries.clear();
  }

  private entry(b: Bookmark): Entry {
    const sig = signature(b);
    const cached = this.entries.get(b.id);
    if (cached && cached.sig === sig) return cached;
    const e = build(b, sig);
    this.entries.set(b.id, e);
    return e;
  }

  /** Pre-build haystacks in small idle-time chunks so the first search is instant. */
  warm() {
    if (this.warmHandle !== null) return;
    const list = this.list;
    let i = 0;
    const idle: (cb: (d: { timeRemaining(): number }) => void) => number =
      (globalThis as { requestIdleCallback?: typeof requestIdleCallback }).requestIdleCallback ?? ((cb) => setTimeout(() => cb({ timeRemaining: () => 8 }), 16) as unknown as number);
    const step = (deadline: { timeRemaining(): number }) => {
      while (i < list.length && deadline.timeRemaining() > 2) {
        for (const end = Math.min(i + 200, list.length); i < end; i++) this.entry(list[i]!);
      }
      if (i < list.length && list === this.list) this.warmHandle = idle(step);
      else this.warmHandle = null;
    };
    this.warmHandle = idle(step);
  }

  /** id → score. AND across terms; falls back to OR when nothing matches all terms. */
  search(text: string): Map<string, number> {
    const t0 = performance.now();
    const out = new Map<string, number>();
    const terms = tokenize(text);
    if (!terms.length) return out;
    const entries = this.list.map((b) => this.entry(b));
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]!;
      let ok = true;
      for (const t of terms) {
        if (!e.all.includes(t)) {
          ok = false;
          break;
        }
      }
      if (ok) out.set(this.list[i]!.id, score(e, terms));
    }
    if (!out.size && terms.length > 1) {
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i]!;
        if (terms.some((t) => e.all.includes(t))) out.set(this.list[i]!.id, score(e, terms) * 0.5);
      }
    }
    perfStat('search', performance.now() - t0);
    return out;
  }
}

export const searchIndex = new SearchIndex();
