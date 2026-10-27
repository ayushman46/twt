/**
 * Full-text search by scanning precomputed lowercase haystacks.
 *
 * Building an inverted index (MiniSearch) for a 10k-post library cost several
 * seconds of main-thread time at startup. A substring scan over cached
 * haystacks needs no index, answers a query over 10k posts in a few ms, and
 * builds each haystack lazily (or during idle time via `warm()`).
 */
import { perfStat } from './perf';
import { foldText } from './query';
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

// Marks (\p{M}) are part of words: Indic vowel signs, viramas, combining accents.
const WORD = /[\p{L}\p{M}\p{N}]/u;
const SEP = '\u0001';

function signature(b: Bookmark): string {
  return `${b.updatedAt}|${b.note.length}|${b.tags.length}|${b.summary?.length ?? 0}`;
}

/** Haystacks and terms are folded the same way (`foldText`: case, NFKC, nukta, ZWJ, Indic digits…). */
function build(b: Bookmark, sig: string): Entry {
  const who = foldText(`${b.author.name} @${b.author.handle}`);
  const body = foldText(b.quoted ? `${b.text}\n${b.quoted.text}` : b.text);
  const extraParts: string[] = [];
  if (b.card?.title) extraParts.push(b.card.title);
  if (b.card?.description) extraParts.push(b.card.description);
  if (b.article) extraParts.push(b.article.title, b.article.preview ?? '');
  if (b.summary) extraParts.push(b.summary);
  for (const l of b.links) extraParts.push(l.display);
  for (const m of b.media) if (m.alt) extraParts.push(m.alt);
  const extra = foldText(extraParts.join(' '));
  const note = foldText(b.note);
  const tags = foldText(b.tags.join(' '));
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
  return foldText(text)
    .split(/[\s,]+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}#@$]+|[^\p{L}\p{M}\p{N}+#]+$/gu, ''))
    .filter(Boolean);
}

/** Every match of `next` also matches `prev` when each earlier term grew in place (typing on). */
function refines(prev: string[], next: string[]): boolean {
  return next.length >= prev.length && prev.every((t, i) => next[i]!.includes(t));
}

export class SearchIndex {
  private entries = new Map<string, Entry>();
  private list: Bookmark[] = [];
  private warmHandle: number | null = null;
  /** Entries in list order. Lists are immutable snapshots, so this is valid per list. */
  private view: { list: Bookmark[]; entries: Entry[] } | null = null;
  /** Indexes of the last all-terms matches; a refined query only rescans these. */
  private last: { list: Bookmark[]; terms: string[]; hits: number[] } | null = null;

  /** O(1): remember the current library. Haystacks are built on demand. */
  sync(list: Bookmark[]) {
    if (list !== this.list) this.view = this.last = null;
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
    const list = this.list;
    if (this.view?.list !== list) this.view = { list, entries: list.map((b) => this.entry(b)) };
    const entries = this.view.entries;
    const prev = this.last;
    const candidates = prev && prev.list === list && refines(prev.terms, terms) ? prev.hits : null;
    const hits: number[] = [];
    const n = candidates ? candidates.length : entries.length;
    for (let k = 0; k < n; k++) {
      const i = candidates ? candidates[k]! : k;
      const e = entries[i]!;
      let ok = true;
      for (const t of terms) {
        if (!e.all.includes(t)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        hits.push(i);
        out.set(list[i]!.id, score(e, terms));
      }
    }
    this.last = { list, terms, hits };
    if (!out.size && terms.length > 1) {
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i]!;
        if (terms.some((t) => e.all.includes(t))) out.set(list[i]!.id, score(e, terms) * 0.5);
      }
    }
    perfStat('search', performance.now() - t0);
    return out;
  }
}

export const searchIndex = new SearchIndex();
