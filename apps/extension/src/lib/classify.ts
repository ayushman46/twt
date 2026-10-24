/**
 * On-device rule-based categorizer.
 *
 * Each post is normalized and tokenized once; every token is then looked up
 * in hash maps built from all enabled categories' weighted terms (exact words,
 * word prefixes, multi-word phrases), plus one small regex for symbol terms
 * ("$btc", "c++", "😂"). A post is scored against each category (main text,
 * link cards, quoted post and linked domains) and assigned to the best match
 * above a threshold. Cost per post is independent of how many terms the
 * taxonomy has, so it can carry many languages.
 *
 * Text and terms go through the same normalization (`matchText`):
 *  1. `foldText` (shared with search): NFKC, lower-case, curly quotes,
 *     zero-width chars, nukta, chandrabindu, Indic digits, dandas, nasal clusters.
 *  2. Brahmic script folding: Bengali, Gurmukhi, Gujarati, Oriya, Tamil,
 *     Telugu, Kannada and Malayalam share Devanagari's (ISCII-derived) code
 *     layout, so each is shifted onto the Devanagari block. One spelling of a
 *     term then matches every script that writes the word the same way
 *     (क्रिकेट = ক্রিকেট = ક્રિકેટ = క్రికెట్ = ಕ್ರಿಕೆಟ್).
 *
 * Words are runs of a small word-character class (JS `\b` is ASCII-only).
 * Indic-script terms match as prefixes because suffixes attach to the word in
 * most Indian languages (मैचों, கிரிக்கெட்டில், ক্রিকেটের); a final virama is
 * dropped first so ക്രിക്കറ്റ് matches ക്രിക്കറ്റിൽ.
 */
import { DEFAULT_CATEGORIES, FALLBACK_CATEGORY_ID, parseDomain, splitTerms, type CategoryDefinition } from '@twtdash/shared';
import { foldText } from './query';
import type { Bookmark, Category, TweetData } from './types';

const MIN_SCORE = 2;

// ---------------------------------------------------------------------------
// Normalization

const INDIC_RE = /[\u0980-\u0d7f]/;
const NASAL_RE = /[\u0919\u091e\u0923\u0928\u092e]\u094d(?=[\u0915-\u0939])/g;
/** A virama before an independent vowel is a spelling convention, not a sound (ಸ್ಟಾರ್ಟ್ಅಪ್ = स्टार्टअप). */
const VIRAMA_VOWEL_RE = /\u094d(?=[\u0904-\u0914])/g;
const FINAL_VIRAMA_RE = /\u094d(?![\u0900-\u097f])/g;

/**
 * Shift Bengali…Malayalam onto the Devanagari block and merge the Dravidian
 * short e/o with long e/o (Devanagari has no separate letters for them).
 */
function foldScripts(s: string): string {
  if (!INDIC_RE.test(s)) return s.includes('\u094d') ? foldVirama(s) : s;
  const codes = new Uint16Array(s.length);
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0x0980 && c <= 0x0d7f) {
      c = 0x0900 | (c & 0x7f);
      if (c === 0x090e || c === 0x0912 || c === 0x0946 || c === 0x094a) c++;
    }
    codes[i] = c;
  }
  let out = '';
  for (let i = 0; i < codes.length; i += 8192) out += String.fromCharCode(...codes.subarray(i, i + 8192));
  return out.includes('\u094d') ? foldVirama(out) : out;
}

/**
 * Virama spelling conventions that differ between scripts but not in sound:
 * nasal clusters (\u0939\u093f\u0928\u094d\u0926\u0940 = \u0939\u093f\u0902\u0926\u0940), a virama before a vowel letter, and a
 * word-final virama (Dravidian scripts write \u0928\u094b\u091f\u093f\u0938\u094d where Hindi writes \u0928\u094b\u091f\u093f\u0938).
 */
function foldVirama(s: string): string {
  return s.replace(NASAL_RE, '\u0902').replace(VIRAMA_VOWEL_RE, '').replace(FINAL_VIRAMA_RE, '');
}

/** Normalization applied to both post text and category terms. */
export function matchText(s: string): string {
  return foldScripts(foldText(s));
}

const URL_RE = /https?:\/\/\S+/g;

function clean(text: string | undefined): string {
  return text ? matchText(text.replace(URL_RE, ' ')) : '';
}

const HASHTAG_RE = /#([A-Za-z0-9_]+)/g;
const HASHTAG_PART_RE = /[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+/g;

/** "#IPL2026 #BuildInPublic #INDvsAUS" → "ipl 2026 build in public ind vs aus" (multi-part tags only). */
function hashtagWords(text: string): string {
  if (!text.includes('#')) return '';
  const out: string[] = [];
  for (const m of text.matchAll(HASHTAG_RE)) {
    const parts = m[1]!.match(HASHTAG_PART_RE);
    if (parts && parts.length > 1) out.push(parts.join(' ').toLowerCase());
  }
  return out.join(' ');
}

// ---------------------------------------------------------------------------
// Compilation

/**
 * Word characters: ASCII, Latin-1/Extended-A/B, combining accents and
 * Devanagari (every Indic script is folded onto it). Small ranges on purpose:
 * huge Unicode classes make V8 regex compilation ~100× slower.
 */
const W = 'a-z0-9_\\u00C0-\\u024F\\u0300-\\u036F\\u0900-\\u097F';
const TOKEN_RE = new RegExp(`[${W}]+`, 'g');
const WORD_CHAR = new RegExp(`[${W}]`);
const NON_WORD = new RegExp(`[^${W}\\s-]`);
const DEVANAGARI_RE = /[\u0900-\u097f]/;
const SEP_RE = /^[\s-]+$/;


interface Hit {
  cat: number;
  w: number;
  /** Term id, for "a repeated term counts at most twice". */
  id: number;
}

interface PhraseRule {
  /** Words after the first one. */
  rest: string[];
  /** Last word matches as a prefix. */
  prefix: boolean;
  hit: Hit;
}

export interface CompiledCategories {
  ids: string[];
  /** Domain → [category index, weight]. */
  domains: Map<string, Array<[number, number]>>;
  exact: Map<string, Hit[]>;
  /** Prefix terms keyed by their first two UTF-16 units; longest prefix first. */
  prefixes: Map<number, Array<[string, Hit[]]>>;
  /** By first word; longer phrases first. */
  phrases: Map<string, PhraseRule[]>;
  special: RegExp | null;
  specialHits: Map<string, Hit[]>;
  termCount: number;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A separator between two words may be dropped when both are real words ("stock market" = "stockmarket"), never around short words ("just in" ≠ "justin"). */
function joinable(a: string, b: string): boolean {
  return a.length >= 3 && b.length >= 3 && !/[0-9]/.test(a + b);
}

interface TermSpec {
  words: string[];
  prefix: boolean;
  special: boolean;
  text: string;
}

function parseTerm(raw: string): TermSpec | null {
  let prefix = raw.endsWith('*');
  const text = matchText(prefix ? raw.slice(0, -1) : raw)
    .trim()
    .replace(/^[\s-]+|[\s-]+$/g, '');
  if (text.length < 2) return null;
  if (NON_WORD.test(text)) return { words: [], prefix: false, special: true, text };
  const words = text.split(/[\s-]+/);
  const last = words.length - 1;
  if (DEVANAGARI_RE.test(words[last]!)) {
    // Indic suffixes attach to the word: match as a prefix, minus a final virama.
    let w = words[last]!;
    if (w.endsWith('\u094d') && w.length > 2) w = w.slice(0, -1);
    words[last] = w;
    if (w.length >= 3) prefix = true;
  }
  if (prefix && words[last]!.length < 2) prefix = false;
  return { words, prefix, special: false, text: words.join(' ') };
}

function definitionTerms(def: CategoryDefinition): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  for (const list of [def.terms, def.hinglish, def.indic]) {
    if (!list) continue;
    for (const w of [3, 2, 1] as const) for (const term of splitTerms(list[w])) out.push([term, w]);
  }
  return out;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

const head = (s: string) => s.charCodeAt(0) * 65536 + s.charCodeAt(1);

function compile(cats: Category[]): CompiledCategories {
  const out: CompiledCategories = {
    ids: [],
    domains: new Map(),
    exact: new Map(),
    prefixes: new Map(),
    phrases: new Map(),
    special: null,
    specialHits: new Map(),
    termCount: 0,
  };
  const prefixHits = new Map<string, Hit[]>();

  cats.forEach((cat, ci) => {
    const def = cat.builtin ? DEFAULT_CATEGORIES.find((d) => d.id === cat.id) : undefined;
    out.ids.push(cat.id);
    for (const entry of def?.domains ?? []) {
      const [domain, w] = parseDomain(entry);
      push(out.domains, domain, [ci, w] as [number, number]);
    }

    // Highest weight wins when a term is listed more than once.
    const terms = new Map<string, { spec: TermSpec; w: number }>();
    const add = (raw: string, w: number) => {
      const spec = parseTerm(raw);
      if (!spec) return;
      const key = (spec.prefix ? '*' : '') + spec.text;
      const prev = terms.get(key);
      if (!prev || prev.w < w) terms.set(key, { spec, w });
    };
    if (def) for (const [term, w] of definitionTerms(def)) add(term, w);
    if (!cat.builtin && cat.name.trim()) add(cat.name.trim(), 2);
    // User keywords are strong signals.
    for (const term of splitTerms(cat.keywords)) add(term, 3.5);

    for (const { spec, w } of terms.values()) {
      const hit: Hit = { cat: ci, w, id: out.termCount++ };
      if (spec.special) {
        push(out.specialHits, spec.text, hit);
        continue;
      }
      const { words, prefix } = spec;
      const single = (word: string) => push(prefix ? prefixHits : out.exact, word, hit);
      if (words.length === 1) single(words[0]!);
      else {
        push(out.phrases, words[0]!, { rest: words.slice(1), prefix, hit });
        if (words.every((x, i) => i === 0 || joinable(words[i - 1]!, x))) single(words.join(''));
      }
    }
  });

  for (const rules of out.phrases.values()) rules.sort((a, b) => b.rest.length - a.rest.length);
  for (const [p, hits] of prefixHits) push(out.prefixes, head(p), [p, hits] as [string, Hit[]]);
  for (const list of out.prefixes.values()) list.sort((a, b) => b[0].length - a[0].length);
  if (out.specialHits.size) {
    const pattern = [...out.specialHits.keys()]
      .sort((a, b) => b.length - a.length)
      // No leading lookbehind (it defeats V8's first-character scan); the start boundary is checked in scoreText.
      .map((t) => escapeRe(t) + (WORD_CHAR.test(t[t.length - 1]!) ? `(?![${W}])` : ''))
      .join('|');
    out.special = new RegExp(pattern, 'g');
  }
  return out;
}

let compiledCache: { key: string; compiled: CompiledCategories } | null = null;

export function compileCategories(categories: Category[]): CompiledCategories {
  const enabled = categories.filter((c) => c.enabled && c.id !== FALLBACK_CATEGORY_ID).sort((a, b) => a.order - b.order);
  const key = enabled.map((c) => `${c.id}:${c.keywords}:${c.name}`).join('|');
  if (compiledCache?.key === key) return compiledCache.compiled;
  const compiled = compile(enabled);
  compiledCache = { key, compiled };
  return compiled;
}

// ---------------------------------------------------------------------------
// Scoring
//
// Classification is synchronous, so scratch buffers are module-level and reused.

let counts = new Uint8Array(0);
let nextFree = new Int32Array(0);
const touched: number[] = [];
const starts: number[] = [];
const ends: number[] = [];
const words: string[] = [];
/** [category, start, end] of symbol-term matches; words inside them are not counted again. */
const covered: number[] = [];

function addHit(hit: Hit, factor: number, scores: Float64Array) {
  const n = ++counts[hit.id]!;
  if (n === 1) touched.push(hit.id);
  // Repeating the same term only counts twice.
  if (n <= 2) scores[hit.cat]! += hit.w * (n === 1 ? 1 : 0.5) * factor;
}

function isFree(cat: number, i: number): boolean {
  if (i < nextFree[cat]!) return false;
  for (let k = 0; k < covered.length; k += 3) {
    if (covered[k] === cat && starts[i]! >= covered[k + 1]! && ends[i]! <= covered[k + 2]!) return false;
  }
  return true;
}

function phraseAt(text: string, rule: PhraseRule, i: number): boolean {
  const n = rule.rest.length;
  if (i + n >= words.length) return false;
  for (let k = 0; k < n; k++) {
    const j = i + 1 + k;
    if (!SEP_RE.test(text.slice(ends[j - 1]!, starts[j]!))) return false;
    const want = rule.rest[k]!;
    if (rule.prefix && k === n - 1 ? !words[j]!.startsWith(want) : words[j] !== want) return false;
  }
  return true;
}

function scoreText(c: CompiledCategories, text: string, factor: number, scores: Float64Array): void {
  if (!text) return;
  if (counts.length < c.termCount) counts = new Uint8Array(c.termCount);
  if (nextFree.length < c.ids.length) nextFree = new Int32Array(c.ids.length);
  nextFree.fill(0);
  covered.length = 0;

  if (c.special) {
    c.special.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = c.special.exec(text))) {
      if (m.index > 0 && WORD_CHAR.test(m[0][0]!) && WORD_CHAR.test(text[m.index - 1]!)) {
        c.special.lastIndex = m.index + 1;
        continue;
      }
      for (const hit of c.specialHits.get(m[0]) ?? []) {
        addHit(hit, factor, scores);
        covered.push(hit.cat, m.index, m.index + m[0].length);
      }
    }
  }

  starts.length = ends.length = words.length = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text))) {
    starts.push(m.index);
    ends.push(m.index + m[0].length);
    words.push(m[0]);
  }

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    const rules = c.phrases.get(word);
    if (rules) {
      for (const rule of rules) {
        if (isFree(rule.hit.cat, i) && phraseAt(text, rule, i)) {
          addHit(rule.hit, factor, scores);
          nextFree[rule.hit.cat] = i + 1 + rule.rest.length;
        }
      }
    }
    const exact = c.exact.get(word);
    if (exact) {
      for (const hit of exact) {
        if (isFree(hit.cat, i)) {
          addHit(hit, factor, scores);
          nextFree[hit.cat] = i + 1;
        }
      }
    }
    if (word.length < 2) continue;
    const candidates = c.prefixes.get(head(word));
    if (!candidates) continue;
    for (const [p, hits] of candidates) {
      if (!word.startsWith(p)) continue;
      for (const hit of hits) {
        if (isFree(hit.cat, i)) {
          addHit(hit, factor, scores);
          nextFree[hit.cat] = i + 1;
        }
      }
    }
  }

  for (const id of touched) counts[id] = 0;
  touched.length = 0;
}

/** Score linked domains, including parent domains (m.economictimes.com → economictimes.com). */
function scoreDomain(c: CompiledCategories, domain: string, scores: Float64Array) {
  let d = domain;
  for (;;) {
    for (const [cat, w] of c.domains.get(d) ?? []) scores[cat]! += w;
    const dot = d.indexOf('.');
    if (dot < 0 || d.indexOf('.', dot + 1) < 0) return;
    d = d.slice(dot + 1);
  }
}

export interface ClassifyResult {
  category: string;
  score: number;
  scores: Record<string, number>;
}

export function classifyTweet(t: TweetData, compiled: CompiledCategories): ClassifyResult {
  const n = compiled.ids.length;
  const raw = new Float64Array(n);
  const tags = hashtagWords(t.text);
  scoreText(compiled, clean(tags ? `${t.text}\n${tags}` : t.text), 1, raw);
  if (t.card || t.article) scoreText(compiled, clean([t.card?.title, t.card?.description, t.article?.title, t.article?.preview].filter(Boolean).join(' \n ')), 0.8, raw);
  if (t.quoted) scoreText(compiled, clean(t.quoted.text), 0.5, raw);
  // Each linked site counts once, however many links and cards point at it.
  const domains = new Set<string>();
  for (const l of t.links) if (l.domain) domains.add(l.domain.toLowerCase());
  if (t.card?.domain) domains.add(t.card.domain.toLowerCase());
  for (const d of domains) scoreDomain(compiled, d, raw);

  const scores: Record<string, number> = {};
  let best = FALLBACK_CATEGORY_ID;
  let bestScore = 0;
  for (let ci = 0; ci < n; ci++) {
    const s = raw[ci]!;
    if (s > 0) scores[compiled.ids[ci]!] = Math.round(s * 10) / 10;
    if (s > bestScore) {
      bestScore = s;
      best = compiled.ids[ci]!;
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
