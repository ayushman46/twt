/**
 * On-device rule-based categorizer.
 *
 * Every enabled category gets one regex compiled from its weighted terms.
 * A post is scored against each category (main text, link cards, quoted
 * post and linked domains) and assigned to the best match above a threshold.
 */
import { DEFAULT_CATEGORIES, FALLBACK_CATEGORY_ID, splitTerms } from '@twtdash/shared';
import type { Bookmark, Category, TweetData } from './types';

interface CompiledCategory {
  id: string;
  re: RegExp | null;
  exact: Map<string, number>;
  prefixes: Array<[string, number]>;
  domains: Array<[string, number]>;
}

const WEAK_DOMAINS = new Set(['youtube.com', 'youtu.be', 'medium.com', 'substack.com', 'wikipedia.org', 'en.wikipedia.org', 'techcrunch.com', 'arxiv.org']);
const MIN_SCORE = 2;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Word characters for boundary checks. Deliberately a small class (ASCII +
 * Latin-1/Extended-A/B) instead of \p{L}: keywords are Latin-script, and huge
 * Unicode classes make V8 compile these regexes ~100× slower.
 */
const W = 'a-z0-9_\\u00C0-\\u024F';
const BEFORE = `(?<![${W}])`;
const AFTER = `(?![${W}])`;
const WORD_EDGE = new RegExp(`[${W}]`);

function isWordTerm(term: string): boolean {
  return WORD_EDGE.test(term[0] ?? '') && WORD_EDGE.test(term[term.length - 1] ?? '');
}

/** Terms that start or end with a symbol ("$btc", "c++", "😂", "nobody:"). */
function specialPattern(term: string): string {
  const before = WORD_EDGE.test(term[0] ?? '') ? BEFORE : '';
  const after = WORD_EDGE.test(term[term.length - 1] ?? '') ? AFTER : '';
  return before + escapeRe(term) + after;
}

function buildRegex(exact: string[], prefixes: string[]): RegExp | null {
  const byLength = (a: string, b: string) => b.length - a.length;
  const words = exact.filter(isWordTerm).sort(byLength).map(escapeRe);
  const special = exact.filter((t) => !isWordTerm(t)).sort(byLength).map(specialPattern);
  const pre = prefixes
    .filter((p) => WORD_EDGE.test(p[0] ?? ''))
    .sort(byLength)
    .map((p) => `${escapeRe(p)}[${W}-]*`);
  const parts: string[] = [];
  if (words.length) parts.push(`${BEFORE}(?:${words.join('|')})${AFTER}`);
  if (pre.length) parts.push(`${BEFORE}(?:${pre.join('|')})${AFTER}`);
  parts.push(...special);
  return parts.length ? new RegExp(parts.join('|'), 'g') : null;
}

export function compileCategory(cat: Category): CompiledCategory {
  const def = cat.builtin ? DEFAULT_CATEGORIES.find((d) => d.id === cat.id) : undefined;
  const exact = new Map<string, number>();
  const prefixes = new Map<string, number>();
  const add = (term: string, weight: number) => {
    if (term.endsWith('*')) {
      const p = term.slice(0, -1);
      if (p.length >= 2) prefixes.set(p, Math.max(weight, prefixes.get(p) ?? 0));
    } else if (term.length >= 2) {
      exact.set(term, Math.max(weight, exact.get(term) ?? 0));
    }
  };
  if (def) for (const w of [3, 2, 1] as const) for (const term of splitTerms(def.terms[w])) add(term, w);
  if (!cat.builtin && cat.name.trim()) add(cat.name.trim().toLowerCase(), 2);
  // User keywords are strong signals.
  for (const term of splitTerms(cat.keywords)) add(term, 3.5);

  const domains: Array<[string, number]> = (def?.domains ?? []).map((d) => [d, WEAK_DOMAINS.has(d) ? 1.5 : 3]);
  return {
    id: cat.id,
    re: buildRegex([...exact.keys()], [...prefixes.keys()]),
    exact,
    prefixes: [...prefixes.entries()].sort((a, b) => b[0].length - a[0].length),
    domains,
  };
}

let compiledCache: { key: string; list: CompiledCategory[] } | null = null;

export function compileCategories(categories: Category[]): CompiledCategory[] {
  const enabled = categories.filter((c) => c.enabled && c.id !== FALLBACK_CATEGORY_ID).sort((a, b) => a.order - b.order);
  const key = enabled.map((c) => `${c.id}:${c.keywords}:${c.name}`).join('|');
  if (compiledCache?.key === key) return compiledCache.list;
  const list = enabled.map(compileCategory);
  compiledCache = { key, list };
  return list;
}

function weightOf(c: CompiledCategory, match: string): number {
  const m = match.toLowerCase();
  const w = c.exact.get(m);
  if (w !== undefined) return w;
  for (const [p, pw] of c.prefixes) if (m.startsWith(p)) return pw;
  return 1;
}

function scoreText(c: CompiledCategory, text: string, factor: number): number {
  if (!c.re || !text) return 0;
  c.re.lastIndex = 0;
  const counts = new Map<string, number>();
  let score = 0;
  let m: RegExpExecArray | null;
  while ((m = c.re.exec(text))) {
    const key = m[0].toLowerCase();
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    // Repeating the same word only counts twice.
    if (n <= 2) score += weightOf(c, key) * (n === 1 ? 1 : 0.5) * factor;
    if (m[0].length === 0) c.re.lastIndex++;
  }
  return score;
}

const URL_RE = /https?:\/\/\S+/g;

function clean(text: string | undefined): string {
  return (text ?? '').replace(URL_RE, ' ').toLowerCase();
}

function domainMatches(domain: string, rule: string): boolean {
  return domain === rule || domain.endsWith('.' + rule);
}

export interface ClassifyResult {
  category: string;
  score: number;
  scores: Record<string, number>;
}

export function classifyTweet(t: TweetData, compiled: CompiledCategory[]): ClassifyResult {
  const main = clean(t.text);
  const card = clean([t.card?.title, t.card?.description, t.article?.title, t.article?.preview].filter(Boolean).join(' \n '));
  const quoted = clean(t.quoted?.text);
  const domains = [...t.links.map((l) => l.domain), t.card?.domain ?? ''].filter(Boolean).map((d) => d.toLowerCase());

  const scores: Record<string, number> = {};
  let best = FALLBACK_CATEGORY_ID;
  let bestScore = 0;
  for (const c of compiled) {
    let s = scoreText(c, main, 1) + scoreText(c, card, 0.8) + scoreText(c, quoted, 0.5);
    for (const d of domains) for (const [rule, w] of c.domains) if (domainMatches(d, rule)) s += w;
    if (s > 0) scores[c.id] = Math.round(s * 10) / 10;
    if (s > bestScore) {
      bestScore = s;
      best = c.id;
    }
  }
  return { category: bestScore >= MIN_SCORE ? best : FALLBACK_CATEGORY_ID, score: bestScore, scores };
}

/**
 * For posts nothing matched, borrow the dominant category of other saved
 * posts from the same author (people tend to post about the same things).
 */
export function inferFromAuthor(others: Pick<Bookmark, 'id' | 'category' | 'categorySource'>[], selfId: string): string | null {
  const counts = new Map<string, number>();
  let total = 0;
  for (const o of others) {
    if (o.id === selfId || o.category === FALLBACK_CATEGORY_ID || o.categorySource === 'author') continue;
    counts.set(o.category, (counts.get(o.category) ?? 0) + 1);
    total++;
  }
  if (total < 2) return null;
  let top: string | null = null;
  let topCount = 0;
  for (const [k, v] of counts) if (v > topCount) [top, topCount] = [k, v];
  return topCount / total >= 0.6 ? top : null;
}
