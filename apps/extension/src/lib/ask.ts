/**
 * "Ask your bookmarks".
 *
 *  1. Retrieval runs locally: a Unicode-aware BM25F ranker over the library
 *     (text, quotes, link titles, notes, tags, category, author) that handles
 *     Devanagari and other Indic scripts and drops English, Hindi and Hinglish
 *     stopwords, blended with the substring scanner used by search.
 *  2. The best ~12 posts (diversified) become numbered context for the model.
 *  3. The answer streams from NVIDIA with the user's own key ("byok") or from
 *     the hosted twtdash API ("pro"). Citations [n] are mapped back to posts
 *     and anything pointing outside the context is dropped.
 *
 * Also: a markdown-lite parser (answers are rendered as React nodes, never
 * as HTML), chat history in localStorage, and post translation.
 */
import {
  AiCallError,
  API_PATHS,
  ASK_LIMITS,
  INSTANCE_HEADER,
  TRANSLATE_LANGUAGES,
  detectQuestionLanguage,
  finishAnswer,
  openAnswerStream,
  readChatStream,
  requestTranslation,
  type ApiErrorBody,
  type AskApiRequest,
  type AskHistoryTurn,
  type AskPostInput,
  type QuestionLanguage,
  type TranslateApiRequest,
  type TranslateApiResponse,
  type TranslateLanguageCode,
} from '@twtdash/shared';
import { browser } from 'wxt/browser';
import { AiError, API_BASE, aiReady } from './ai-config';
import type { Settings } from './storage';
import type { Bookmark, Category } from './types';

const DAY = 86_400_000;

/* ------------------------------------------------------------------ Text */

const ZERO_WIDTH = /[​-‍⁠﻿]/g;

/**
 * Canonical form for matching: NFC, lowercase, no zero-width joiners, and
 * Hindi spelling variants folded (nukta dropped — ज़ ≈ ज; chandrabindu → anusvara).
 */
export function normalizeText(s: string): string {
  return s.normalize('NFC').replace(ZERO_WIDTH, '').toLowerCase().replace(/़/g, '').replace(/ँ/g, 'ं');
}

/** Letters plus combining marks (Indic vowel signs, viramas) plus digits. */
const TOKEN = /[\p{L}\p{M}\p{N}]+/gu;

function rawTokens(normalized: string): string[] {
  return normalized.match(TOKEN) ?? [];
}

function stemEnglish(word: string): string {
  let w = word;
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y';
  else if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('s') && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  // shipp(ing) → ship, runn(ing) → run
  if (w.length > 3 && /([b-df-hj-np-tv-z])\1$/.test(w) && !/(?:ll|ss|zz|ff)$/.test(w) && w !== word) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

/** Hindi plural/oblique endings: किताबें, किताबों → किताब. (Chandrabindu is already folded to anusvara.) */
const HINDI_SUFFIXES = ['ियों', 'ियां', 'ाओं', 'ाएं', 'ों', 'ें', 'ां', 'ीं'];

function stemHindi(w: string): string {
  for (const s of HINDI_SUFFIXES) if (w.length > s.length + 1 && w.endsWith(s)) return w.slice(0, -s.length);
  return w;
}

export function stem(token: string): string {
  if (/^[a-z]+$/.test(token)) return stemEnglish(token);
  if (/[ऀ-ॿ]/.test(token)) return stemHindi(token);
  return token;
}

const STOPWORDS = new Set(
  [
    // English
    'a an the and or but if then than so of to in on at by for from with without into onto about above below over under between',
    'is am are was were be been being do does did done doing have has had having can could would should will shall may might must',
    'i me my mine myself we us our ours you your yours he him his she her it its they them their this that these those there here',
    'what which who whom whose when where why how whats any all some each every much many more most few other such own same',
    'very just also only not no nor too again once up down out off own please tell show give find list get got let lets know',
    'thing things stuff something anything everything someone anyone kind sort way ways like really ever',
    // the domain: every question is about saved posts
    'bookmark bookmarks bookmarked save saved saving saves post posts tweet tweets tweeted thread threads x twitter',
    'summarize summarise summary summaries overview recap explain read reading',
    // time words (windows are detected separately)
    'today yesterday tonight week weeks weekly month months monthly year years day days recent recently latest lately newest new last past ago since',
    // Hinglish
    'kya kyaa kia hai hain mein mai main maine mene mujhe mera meri mere ke ka ki ko se par pe baare bare kaise kaisa kyun kyon kyu',
    'kahan kab kaun batao bataiye bataao dikhao dikha nahi nahin aur ya kuch koi sab saare sare wala wali wale karna karo kiya kiye',
    'tha thi the raha rahi rahe hoga hua hui hue gaya gayi chahiye liye lie apne apna apni isme usme abhi bhi sirf toh hota hoti',
    'hum humne tum aap aapne yeh ye woh wo is us jo ek do kar padha padhe padhi bata aaj kal hafte hafta mahine mahina saal din pichle pichhle',
    // Hindi (Devanagari)
    'क्या मैंने मैने मेरे मेरी मेरा मुझे मैं के का की को से में पर बारे है हैं था थी थे और या भी कुछ कोई कौन कब कैसे क्यों कहां कहाँ',
    'सब सारे वाला वाली वाले यह ये वह वो इस उस इसमें उसमें लिए कर करो किया किए किये करना बताओ बताइए बताएं बताये दिखाओ चाहिए',
    'रहा रही रहे हुआ हुई हुए गया गई एक ना नहीं तो अब अभी सिर्फ बस अपने अपना अपनी हम हमने तुम आप आपने ने हो होता होती जो तक साथ',
    'सेव सहेजा सहेजे सहेजी पोस्ट पोस्ट्स ट्वीट बुकमार्क संक्षेप सारांश पढ़ा पढ़े आज कल हफ्ते सप्ताह महीने महीना माह साल दिन पिछले हाल नए नई',
  ]
    .join(' ')
    .split(/\s+/)
    .map((w) => normalizeText(w)),
);

function isStopword(token: string): boolean {
  return STOPWORDS.has(token) || (token.length === 1 && !/\p{N}/u.test(token));
}

/** Tokens → stems for indexing (stopwords are cheap to keep and are never queried). */
function indexTokens(text: string): string[] {
  return rawTokens(normalizeText(text)).map(stem);
}

/* ------------------------------------------------- Cross-language matching */

/**
 * Common topic words in Hindi (Devanagari) and Hinglish → English, so a Hindi
 * question finds English posts ("निवेश" → invest, "naukri" → job). Used in
 * both directions.
 */
const SYNONYM_SOURCE: Array<[string, string]> = [
  ['क्रिकेट', 'cricket'],
  ['स्टार्टअप स्टार्टअप्स', 'startup startups'],
  ['निवेश nivesh', 'invest investing investment'],
  ['निवेशक', 'investor investors'],
  ['पैसा पैसे paisa paise', 'money finance'],
  ['शेयर', 'stock stocks share'],
  ['बाज़ार बाजार bazaar bazar', 'market'],
  ['नौकरी naukri', 'job jobs career hiring'],
  ['करियर', 'career'],
  ['किताब kitab kitaab', 'book books reading'],
  ['पढ़ाई padhai', 'study learning'],
  ['शिक्षा shiksha', 'education'],
  ['सेहत sehat स्वास्थ्य', 'health fitness'],
  ['व्यायाम कसरत kasrat vyayam', 'exercise workout'],
  ['फ़िटनेस फिटनेस', 'fitness'],
  ['नींद neend', 'sleep'],
  ['खाना भोजन khana', 'food nutrition diet'],
  ['डिज़ाइन डिजाइन', 'design'],
  ['डिज़ाइनर', 'designer'],
  ['प्रोग्रामिंग', 'programming code'],
  ['कोडिंग', 'coding code'],
  ['मार्केटिंग', 'marketing'],
  ['विज्ञान', 'science'],
  ['तकनीक टेक्नोलॉजी', 'tech technology'],
  ['राजनीति', 'politics'],
  ['ख़बर खबर ख़बरें न्यूज़ khabar', 'news'],
  ['खेल khel', 'sport sports'],
  ['फ़िल्म फिल्म', 'film movie'],
  ['संगीत गाना gaana', 'music song'],
  ['यात्रा yatra safar', 'travel trip'],
  ['व्यापार बिज़नेस कारोबार vyapar dhandha', 'business'],
  ['कंपनी', 'company'],
  ['फंडिंग', 'funding fundraising'],
  ['फंडरेजिंग फंडरेज़िंग', 'fundraising'],
  ['एआई आर्टिफिशियल', 'ai artificial'],
  ['क्रिप्टो', 'crypto'],
  ['बिटकॉइन', 'bitcoin'],
  ['डेटा', 'data'],
  ['ऐप', 'app apps'],
  ['टूल टूल्स', 'tool tools'],
  ['लेखन', 'writing'],
  ['उत्पादकता प्रोडक्टिविटी', 'productivity'],
  ['सलाह टिप्स', 'tip tips advice'],
  ['मीम मीम्स', 'meme memes'],
  ['प्रोडक्ट', 'product'],
  ['विकास ग्रोथ', 'growth'],
  ['सीखना सीख seekhna sikhna', 'learn lesson'],
  ['भारत इंडिया', 'india'],
  ['tarika tareeka tarike tareeke', 'method tip'],
];

const SYNONYMS = (() => {
  const map = new Map<string, Set<string>>();
  const link = (from: string, to: string) => {
    if (from === to) return;
    let set = map.get(from);
    if (!set) map.set(from, (set = new Set()));
    set.add(to);
  };
  for (const [native, english] of SYNONYM_SOURCE) {
    const a = native.split(' ').map((w) => stem(normalizeText(w)));
    const b = english.split(' ').map((w) => stem(w));
    for (const x of a) for (const y of b) (link(x, y), link(y, x));
  }
  return map;
})();

const DEVA_CONSONANTS: Record<string, string> = {
  क: 'k', ख: 'k', ग: 'g', घ: 'g', ङ: 'n', च: 'c', छ: 'c', ज: 'j', झ: 'j', ञ: 'n', ट: 't', ठ: 't', ड: 'd', ढ: 'd', ण: 'n',
  त: 't', थ: 't', द: 'd', ध: 'd', न: 'n', प: 'p', फ: 'f', ब: 'b', भ: 'b', म: 'm', र: 'r', ल: 'l', व: 'v', श: 's', ष: 's', स: 's', 'ं': 'n',
};

/**
 * Consonant skeleton, so English loanwords match across scripts:
 * "cricket" ≈ "क्रिकेट" (krkt), "marketing" ≈ "मार्केटिंग" (mrktng).
 */
export function skeleton(token: string): string | null {
  let s: string;
  if (/^[a-z]+$/.test(token)) {
    if (token.length < 4) return null;
    s = token
      .replace(/ph/g, 'f')
      .replace(/ck/g, 'k')
      .replace(/sh/g, 's')
      .replace(/ch/g, 'C')
      .replace(/c(?=[eiy])/g, 's')
      .replace(/[cq]/g, 'k')
      .replace(/x/g, 'ks')
      .replace(/w/g, 'v')
      .replace(/z/g, 'j')
      .replace(/C/g, 'c')
      .replace(/[aeiouyh]/g, '');
  } else if (/^[ऀ-ॿ]+$/.test(token)) {
    s = '';
    for (const ch of token) s += DEVA_CONSONANTS[ch] ?? '';
  } else return null;
  s = s.replace(/(.)\1+/g, '$1');
  return s.length >= 3 ? s : null;
}

function scriptOf(token: string): 'l' | 'd' | null {
  if (/^[a-z]+$/.test(token)) return 'l';
  if (/^[ऀ-ॿ]+$/.test(token)) return 'd';
  return null;
}

/* ------------------------------------------------------- Question analysis */

export interface QuestionAnalysis {
  /** Stemmed content terms, deduplicated, in question order. */
  terms: string[];
  /** The same terms unstemmed (for the substring scanner). */
  words: string[];
  /** Per term: translations from the Hindi/Hinglish ↔ English dictionary (stems). */
  alts: string[][];
  /** Handles mentioned as @handle (lowercase). */
  authors: string[];
  since?: number;
  until?: number;
  /** "latest", "recent"… → prefer newer posts. */
  recency: boolean;
  language: QuestionLanguage;
}

interface TimeRule {
  re: RegExp;
  window: (now: Date, m: RegExpExecArray) => { since?: number; until?: number };
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const startOfMonth = (d: Date, offset = 0) => new Date(d.getFullYear(), d.getMonth() + offset, 1).getTime();

const UNIT_DAYS: Record<string, number> = { day: 1, days: 1, din: 1, दिन: 1, week: 7, weeks: 7, hafte: 7, hafton: 7, हफ्ते: 7, हफ्तों: 7, month: 30, months: 30, mahine: 30, महीने: 30, महीनों: 30 };

const TIME_RULES: TimeRule[] = [
  { re: /\b(?:last|past|pichle|pichhle)\s+(\d{1,3})\s+(days?|din|weeks?|hafte|hafton|months?|mahine)\b|पिछले\s+(\d{1,3})\s+(दिन|हफ्ते|हफ्तों|महीने|महीनों)/, window: (now, m) => ({ since: now.getTime() - Number(m[1] ?? m[3]) * (UNIT_DAYS[m[2] ?? m[4] ?? 'day'] ?? 1) * DAY }) },
  { re: /\btoday\b|\baaj\b|आज/, window: (now) => ({ since: startOfDay(now) }) },
  { re: /\byesterday\b/, window: (now) => ({ since: startOfDay(now) - DAY, until: startOfDay(now) }) },
  { re: /\b(?:this|is)\s+(?:week|hafte|hafta)\b|इस\s+(?:हफ्ते|सप्ताह)/, window: (now) => ({ since: now.getTime() - 7 * DAY }) },
  { re: /\b(?:last|past|pichle|pichhle)\s+(?:week|hafte|hafta)\b|पिछले\s+(?:हफ्ते|सप्ताह)/, window: (now) => ({ since: now.getTime() - 14 * DAY }) },
  { re: /\b(?:this|is)\s+(?:month|mahine|mahina)\b|इस\s+(?:महीने|माह)/, window: (now) => ({ since: startOfMonth(now) }) },
  { re: /\b(?:last|past|pichle|pichhle)\s+(?:month|mahine|mahina)\b|पिछले\s+(?:महीने|माह)/, window: (now) => ({ since: startOfMonth(now, -1), until: startOfMonth(now) }) },
  { re: /\b(?:this|is)\s+(?:year|saal|sal)\b|इस\s+साल/, window: (now) => ({ since: new Date(now.getFullYear(), 0, 1).getTime() }) },
  { re: /\b(?:last|past|pichle|pichhle)\s+(?:year|saal|sal)\b|पिछले\s+साल/, window: (now) => ({ since: new Date(now.getFullYear() - 1, 0, 1).getTime(), until: new Date(now.getFullYear(), 0, 1).getTime() }) },
];

const RECENCY = /\b(?:recent|recently|latest|lately|newest|new)\b|haal\s+hi|हाल\s+(?:ही|में)|नए|नई/;

export function analyzeQuestion(question: string, now = Date.now()): QuestionAnalysis {
  let text = normalizeText(question);
  const authors = [...text.matchAll(/@([a-z0-9_]{1,15})/g)].map((m) => m[1]!);
  let since: number | undefined;
  let until: number | undefined;
  for (const rule of TIME_RULES) {
    const m = rule.re.exec(text);
    if (!m) continue;
    const w = rule.window(new Date(now), m);
    since = w.since;
    until = w.until;
    text = text.replace(m[0], ' ');
    break;
  }
  const recency = RECENCY.test(text) || since !== undefined;
  const words: string[] = [];
  const terms: string[] = [];
  const alts: string[][] = [];
  for (const tok of rawTokens(text)) {
    if (isStopword(tok)) continue;
    const s = stem(tok);
    if (isStopword(s) || terms.includes(s)) continue;
    terms.push(s);
    words.push(tok);
    alts.push([...new Set([...(SYNONYMS.get(s) ?? []), ...(SYNONYMS.get(tok) ?? [])])]);
  }
  return { terms, words, alts, authors, since, until, recency, language: detectQuestionLanguage(question) };
}

/* ------------------------------------------------------------- Ranking */

const FIELDS = {
  author: 2.2,
  tags: 1.8,
  note: 1.6,
  category: 1.2,
  body: 1,
  card: 0.8,
  summary: 0.7,
  quoted: 0.7,
} as const;

interface DocStats {
  catName: string;
  /** Weighted term frequency across fields. */
  tf: Map<string, number>;
  /** Weighted length. */
  len: number;
}

interface Corpus {
  df: Map<string, number>;
  n: number;
  avgLen: number;
  vocab: string[];
  /** "l:krkt" → Latin words with that skeleton, "d:krkt" → Devanagari ones. Built on first use. */
  skeletons?: Map<string, string[]>;
}

const docCache = new WeakMap<Bookmark, DocStats>();
const corpusCache = new WeakMap<Bookmark[], Corpus>();

function postBody(b: Bookmark): string {
  return [b.article?.title, b.text, b.article?.preview].filter(Boolean).join('\n');
}

function docStats(b: Bookmark, catName: string): DocStats {
  const hit = docCache.get(b);
  if (hit && hit.catName === catName) return hit;
  const tf = new Map<string, number>();
  let len = 0;
  const add = (text: string | undefined, weight: number) => {
    if (!text) return;
    const toks = indexTokens(text);
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + weight);
    len += toks.length * weight;
  };
  add(`${b.author.name} ${b.author.handle}`, FIELDS.author);
  add(b.tags.join(' '), FIELDS.tags);
  add(b.note, FIELDS.note);
  add(catName, FIELDS.category);
  add(postBody(b), FIELDS.body);
  add([b.card?.title, b.card?.description, ...b.links.map((l) => l.display)].filter(Boolean).join(' '), FIELDS.card);
  add(b.summary, FIELDS.summary);
  add(b.quoted ? `${b.quoted.author.name} ${b.quoted.text}` : undefined, FIELDS.quoted);
  const stats: DocStats = { catName, tf, len: Math.max(len, 1) };
  docCache.set(b, stats);
  return stats;
}

function skeletonIndex(corpus: Corpus): Map<string, string[]> {
  if (corpus.skeletons) return corpus.skeletons;
  const map = new Map<string, string[]>();
  for (const v of corpus.vocab) {
    const script = scriptOf(v);
    const key = script && skeleton(v);
    if (!key) continue;
    const k = `${script}:${key}`;
    const list = map.get(k);
    if (list) list.push(v);
    else map.set(k, [v]);
  }
  corpus.skeletons = map;
  return map;
}

function catNameOf(b: Bookmark, categories?: Map<string, Category>): string {
  return categories?.get(b.category)?.name ?? '';
}

function corpusFor(bookmarks: Bookmark[], categories?: Map<string, Category>): Corpus {
  const hit = corpusCache.get(bookmarks);
  if (hit) return hit;
  const df = new Map<string, number>();
  let total = 0;
  for (const b of bookmarks) {
    const s = docStats(b, catNameOf(b, categories));
    total += s.len;
    for (const t of s.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const corpus: Corpus = { df, n: bookmarks.length, avgLen: bookmarks.length ? total / bookmarks.length : 1, vocab: [...df.keys()] };
  corpusCache.set(bookmarks, corpus);
  return corpus;
}

/** Build the ranking statistics in idle time so the first question is instant. */
export function warmAskIndex(bookmarks: Bookmark[], categories?: Map<string, Category>): () => void {
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const handle = idle ? idle(() => corpusFor(bookmarks, categories), { timeout: 3000 }) : setTimeout(() => corpusFor(bookmarks, categories), 300);
  return () => {
    const cancel = (globalThis as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
    if (idle && cancel) cancel(handle as number);
    else clearTimeout(handle as ReturnType<typeof setTimeout>);
  };
}

export interface RankedPost {
  b: Bookmark;
  score: number;
}

export interface RankOptions {
  categories?: Map<string, Category>;
  /** id → score from the substring scanner (`searchIndex.search`). */
  substring?: Map<string, number>;
  /** Posts to favour (what the previous answer cited, for vague follow-ups). */
  boostIds?: string[];
  now?: number;
}

const K1 = 1.2;
const B = 0.6;

/** Rank the library for a question. Only posts with a positive score are returned, best first. */
export function rankBookmarks(question: string | QuestionAnalysis, bookmarks: Bookmark[], opts: RankOptions = {}): RankedPost[] {
  const now = opts.now ?? Date.now();
  const q = typeof question === 'string' ? analyzeQuestion(question, now) : question;
  const inWindow = (b: Bookmark) => (q.since === undefined || b.savedAt >= q.since) && (q.until === undefined || b.savedAt < q.until);
  const windowed = q.since !== undefined || q.until !== undefined ? bookmarks.filter(inWindow) : bookmarks;
  // A time window with nothing in it shouldn't hide everything; fall back to the whole library.
  const pool = windowed.length ? windowed : bookmarks;
  const boost = new Set(opts.boostIds ?? []);
  const recencyWeight = (b: Bookmark) => (q.recency ? 1 + 0.35 * Math.exp(-Math.max(0, now - b.savedAt) / (30 * DAY)) : 1);

  if (!q.terms.length && !q.authors.length) {
    // "What did I save this week?" → the window itself, newest first.
    return pool
      .map((b) => ({ b, score: (boost.has(b.id) ? 2 : 1) + b.savedAt / (now * 10 || 1) }))
      .sort((x, y) => y.score - x.score);
  }

  const corpus = corpusFor(bookmarks, opts.categories);
  const idf = (t: string) => {
    const df = corpus.df.get(t) ?? 0;
    return Math.log(1 + (corpus.n - df + 0.5) / (df + 0.5));
  };
  // Each query term, plus: prefix expansions ("crypto" → "cryptocurrency"), dictionary
  // translations ("निवेश" → "invest") and same-sounding words in the other script
  // ("क्रिकेट" → "cricket"), each at a lower weight.
  const expansions = q.terms.map((t, i) => {
    const list: Array<[string, number, number]> = [[t, 1, idf(t)]];
    const seen = new Set([t]);
    const push = (v: string, w: number) => {
      if (seen.has(v) || !corpus.df.has(v)) return;
      seen.add(v);
      list.push([v, w, idf(v)]);
    };
    for (const alt of q.alts?.[i] ?? []) push(alt, 0.8);
    const script = scriptOf(t);
    const key = script && skeleton(t);
    if (key) for (const v of skeletonIndex(corpus).get(`${script === 'l' ? 'd' : 'l'}:${key}`) ?? []) push(v, 0.6);
    if (t.length >= 4) {
      let added = 0;
      for (const v of corpus.vocab) {
        if (v.length > t.length && v.startsWith(t)) {
          push(v, 0.5);
          if (++added >= 12) break;
        }
      }
    }
    return list;
  });
  const maxIdf = Math.max(1, ...expansions.flat().map((e) => e[2]));

  let maxSub = 0;
  for (const v of opts.substring?.values() ?? []) maxSub = Math.max(maxSub, v);

  const scored: RankedPost[] = [];
  let top = 0;
  for (const b of pool) {
    const s = docStats(b, catNameOf(b, opts.categories));
    const norm = K1 * (1 - B + (B * s.len) / corpus.avgLen);
    let score = 0;
    let matched = 0;
    for (const list of expansions) {
      let termScore = 0;
      for (const [t, w, termIdf] of list) {
        const f = s.tf.get(t);
        if (f) termScore = Math.max(termScore, w * termIdf * ((f * (K1 + 1)) / (f + norm)));
      }
      if (termScore > 0) matched++;
      score += termScore;
    }
    if (expansions.length) score *= 0.5 + matched / expansions.length;
    if (q.authors.includes(b.author.handle.toLowerCase())) score += maxIdf * 3;
    if (score > 0 || boost.has(b.id) || opts.substring?.has(b.id)) scored.push({ b, score });
    top = Math.max(top, score);
  }
  const subWeight = 0.3 * (top || 1);
  for (const r of scored) {
    const sub = opts.substring?.get(r.b.id);
    if (sub && maxSub) r.score += (sub / maxSub) * subWeight;
    if (boost.has(r.b.id)) r.score += 0.5 * (top || 1);
    r.score *= recencyWeight(r.b);
    // Newer wins ties.
    r.score += r.b.savedAt / 1e16;
  }
  return scored.filter((r) => r.score > 1e-3).sort((x, y) => y.score - x.score);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Pick the context: the best posts above a relevance floor, at most three per
 * author and no near-duplicates (retweets, cross-posts), up to `limit`.
 */
export function selectContext(ranked: RankedPost[], opts: { limit?: number; minRatio?: number; perAuthor?: number } = {}): Bookmark[] {
  const limit = Math.min(opts.limit ?? 12, ASK_LIMITS.posts);
  const perAuthor = opts.perAuthor ?? 3;
  const floor = (ranked[0]?.score ?? 0) * (opts.minRatio ?? 0.12);
  const picked: Bookmark[] = [];
  const shingles: Array<Set<string>> = [];
  const byAuthor = new Map<string, number>();
  const overflow: Bookmark[] = [];
  for (const { b, score } of ranked) {
    if (picked.length >= limit) break;
    if (score < floor) break;
    const sh = new Set(indexTokens(postBody(b)).filter((t) => !isStopword(t)));
    if (sh.size >= 4 && shingles.some((s) => jaccard(s, sh) >= 0.8)) continue;
    const key = b.author.handle.toLowerCase();
    if ((byAuthor.get(key) ?? 0) >= perAuthor) {
      overflow.push(b);
      continue;
    }
    byAuthor.set(key, (byAuthor.get(key) ?? 0) + 1);
    picked.push(b);
    shingles.push(sh);
  }
  // Diversity is a preference: fill any remaining room with the best of the rest.
  for (const b of overflow) {
    if (picked.length >= limit) break;
    picked.push(b);
  }
  return picked;
}

export interface Retrieval {
  analysis: QuestionAnalysis;
  ranked: RankedPost[];
  context: Bookmark[];
  /** The question named a time window that holds no posts (the whole library was searched). */
  windowEmpty: boolean;
}

/**
 * Full local retrieval for a question. A vague follow-up ("aur batao", "tell
 * me more") borrows the previous question's terms and favours what it cited.
 */
export function retrieveForQuestion(
  question: string,
  bookmarks: Bookmark[],
  opts: RankOptions & { previous?: { question: string; citedIds: string[] }; substringSearch?: (text: string) => Map<string, number>; limit?: number } = {},
): Retrieval {
  const now = opts.now ?? Date.now();
  let analysis = analyzeQuestion(question, now);
  let boostIds = opts.boostIds;
  if (opts.previous && analysis.terms.length < 2 && !analysis.authors.length) {
    const prev = analyzeQuestion(opts.previous.question, now);
    const extra = prev.terms.map((t, i) => [t, prev.words[i]!, prev.alts[i]!] as const).filter(([t]) => !analysis.terms.includes(t));
    analysis = {
      ...analysis,
      terms: [...analysis.terms, ...extra.map((e) => e[0])],
      words: [...analysis.words, ...extra.map((e) => e[1])],
      alts: [...analysis.alts, ...extra.map((e) => e[2])],
      authors: analysis.authors.length ? analysis.authors : prev.authors,
      since: analysis.since ?? prev.since,
      until: analysis.until ?? prev.until,
    };
    boostIds = [...(boostIds ?? []), ...opts.previous.citedIds];
  }
  const substring = opts.substring ?? (opts.substringSearch && analysis.words.length ? opts.substringSearch(analysis.words.join(' ')) : undefined);
  const ranked = rankBookmarks(analysis, bookmarks, { ...opts, substring, boostIds, now });
  const windowed = analysis.since !== undefined || analysis.until !== undefined;
  const windowEmpty = windowed && !bookmarks.some((b) => (analysis.since === undefined || b.savedAt >= analysis.since) && (analysis.until === undefined || b.savedAt < analysis.until));
  return { analysis, ranked, context: selectContext(ranked, { limit: opts.limit }), windowEmpty };
}

/* ------------------------------------------------------------- Context */

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date, YYYY-MM-DD. */
export function isoDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clipText(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max).trimEnd() + ' […]';
}

/** One post as model context (kept compact: ~12 of these go in each request). */
export function toAskPost(b: Bookmark, categoryName?: string): AskPostInput {
  const text = [b.article?.title, b.text || b.article?.preview].filter(Boolean).join('\n');
  const post: AskPostInput = {
    id: b.id,
    author: `@${b.author.handle} (${b.author.name})`,
    text: clipText(text || b.card?.title || '', 1400),
    saved: isoDate(b.savedAt),
  };
  if (categoryName) post.category = categoryName;
  if (b.quoted) post.quoted = clipText(`@${b.quoted.author.handle}: ${b.quoted.text}`, 500);
  if (b.card?.title) post.cardTitle = b.card.domain ? `${b.card.title} (${b.card.domain})` : b.card.title;
  if (b.note.trim()) post.note = clipText(b.note.trim(), 500);
  if (b.tags.length) post.tags = b.tags.slice(0, 8);
  return post;
}

/* ----------------------------------------------------------- Citations */

/** `[3]`, `[1, 4]`, `[2-4]`, `[Post 3]`, `【3】`. */
const CITE_SRC = String.raw`[[【]\s*(?:posts?\s*)?(\d{1,3}(?:\s*(?:,|–|-|and)\s*(?:posts?\s*)?\d{1,3})*)\s*[\]】]`;
const CITE_GLOBAL = new RegExp(CITE_SRC, 'gi');
const CITE_AT = new RegExp(CITE_SRC, 'iy');

function expandCitation(list: string): number[] {
  const out: number[] = [];
  for (const part of list.split(/\s*(?:,|and)\s*/i)) {
    const range = /^(?:posts?\s*)?(\d+)\s*[–-]\s*(?:posts?\s*)?(\d+)$/i.exec(part.trim());
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (b >= a && b - a <= 20) for (let n = a; n <= b; n++) out.push(n);
      continue;
    }
    const digits = part.replace(/\D/g, '');
    if (digits) out.push(Number(digits));
  }
  return out;
}

export interface CitationMap {
  /** Valid post numbers in order of first appearance. */
  numbers: number[];
  /** Post ids for `numbers`. */
  ids: string[];
  /** Numbers that pointed outside the context (dropped). */
  invalid: number[];
}

export function parseCitations(answer: string, contextIds: string[]): CitationMap {
  const numbers: number[] = [];
  const invalid: number[] = [];
  for (const m of answer.matchAll(CITE_GLOBAL)) {
    for (const n of expandCitation(m[1]!)) {
      if (n >= 1 && n <= contextIds.length) {
        if (!numbers.includes(n)) numbers.push(n);
      } else if (!invalid.includes(n)) invalid.push(n);
    }
  }
  return { numbers, ids: numbers.map((n) => contextIds[n - 1]!), invalid };
}

/** Rewrite citations to the canonical `[n]` form and drop the ones that point outside the context. */
export function cleanCitations(answer: string, count: number): string {
  return answer.replace(CITE_GLOBAL, (_all, list: string) => {
    const valid = [...new Set(expandCitation(list).filter((n) => n >= 1 && n <= count))];
    return valid.map((n) => `[${n}]`).join('');
  });
}

/* ------------------------------------------------------- Markdown-lite */

export type MdInline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: MdInline[] }
  | { t: 'em'; c: MdInline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; c: MdInline[] }
  | { t: 'cite'; n: number };

export type MdBlock =
  | { t: 'p'; c: MdInline[] }
  | { t: 'h'; c: MdInline[] }
  | { t: 'quote'; c: MdInline[] }
  | { t: 'list'; ordered: boolean; start: number; items: Array<{ c: MdInline[]; depth: number }> }
  | { t: 'pre'; v: string };

interface MdOptions {
  /** Citations above this are dropped (0 → keep none). Default: keep all. */
  maxCite?: number;
  /** Still streaming: tolerate unfinished syntax at the end. */
  streaming?: boolean;
}

const WORDCH = /[\p{L}\p{N}]/u;
const LINK_AT = /\[([^\]\n]{1,300})\]\((https?:\/\/[^\s)]{1,2000})\)/y;
const URL_AT = /https?:\/\/[^\s<>()[\]{}"'`]+/y;

export function safeHref(href: string): string | null {
  try {
    const u = new URL(href);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

function parseInline(s: string, opts: MdOptions): MdInline[] {
  const out: MdInline[] = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push({ t: 'text', v: buf });
    buf = '';
  };
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === '`') {
      const end = s.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        out.push({ t: 'code', v: s.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
      if (end < 0 && opts.streaming && i + 1 < s.length) {
        flush();
        out.push({ t: 'code', v: s.slice(i + 1) });
        break;
      }
    }
    if (ch === '[' || ch === '【') {
      CITE_AT.lastIndex = i;
      const cm = CITE_AT.exec(s);
      if (cm) {
        flush();
        const seen = new Set<number>();
        for (const n of expandCitation(cm[1]!)) {
          if (seen.has(n) || n < 1 || (opts.maxCite !== undefined && n > opts.maxCite)) continue;
          seen.add(n);
          out.push({ t: 'cite', n });
        }
        i += cm[0].length;
        continue;
      }
      LINK_AT.lastIndex = i;
      const lm = LINK_AT.exec(s);
      const href = lm ? safeHref(lm[2]!) : null;
      if (lm && href) {
        flush();
        out.push({ t: 'link', href, c: parseInline(lm[1]!, opts) });
        i += lm[0].length;
        continue;
      }
    }
    if ((ch === '*' || ch === '_') && s[i + 1] === ch) {
      const mark = ch + ch;
      const end = s.indexOf(mark, i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: 'strong', c: parseInline(s.slice(i + 2, end), opts) });
        i = end + 2;
        continue;
      }
      if (end < 0 && opts.streaming) {
        flush();
        const rest = s.slice(i + 2);
        if (rest) out.push({ t: 'strong', c: parseInline(rest, opts) });
        break;
      }
    }
    if ((ch === '*' || ch === '_') && s[i + 1] && s[i + 1] !== ' ' && s[i + 1] !== ch && !(ch === '_' && i > 0 && WORDCH.test(s[i - 1]!))) {
      let end = -1;
      for (let j = i + 1; j < s.length; j++) {
        const c = s[j]!;
        if (c === '\n') break;
        if (c === ch && s[j - 1] !== ' ' && s[j + 1] !== ch && !(ch === '_' && WORDCH.test(s[j + 1] ?? ''))) {
          end = j;
          break;
        }
      }
      if (end > i + 1) {
        flush();
        out.push({ t: 'em', c: parseInline(s.slice(i + 1, end), opts) });
        i = end + 1;
        continue;
      }
    }
    if (ch === 'h' && (i === 0 || !WORDCH.test(s[i - 1]!))) {
      URL_AT.lastIndex = i;
      const um = URL_AT.exec(s);
      if (um) {
        const raw = um[0].replace(/[.,;:!?…]+$/, '');
        const href = safeHref(raw);
        if (href) {
          flush();
          out.push({ t: 'link', href, c: [{ t: 'text', v: raw }] });
          i += raw.length;
          continue;
        }
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

/**
 * Parse the small Markdown subset answers use into a tree the UI renders as
 * React elements. Nothing here is ever treated as HTML.
 */
export function parseMarkdownLite(src: string, opts: MdOptions = {}): MdBlock[] {
  let text = src.replace(/\r\n?/g, '\n');
  // Mid-stream, hide a citation that is still being typed ("[1", "[2, ").
  if (opts.streaming) text = text.replace(/[[【][\d\s,–-]*$/, '');
  const lines = text.split('\n');
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  let list: Extract<MdBlock, { t: 'list' }> | null = null;
  let quote: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ t: 'p', c: parseInline(para.join('\n').trim(), opts) });
    para = [];
  };
  const flushQuote = () => {
    if (quote.length) blocks.push({ t: 'quote', c: parseInline(quote.join('\n').trim(), opts) });
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushQuote();
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*```/.test(line)) {
      flushAll();
      const body: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]!); i++) body.push(lines[i]!);
      blocks.push({ t: 'pre', v: body.join('\n') });
      continue;
    }
    if (!line.trim()) {
      flushPara();
      flushQuote();
      // A blank line between list items keeps the list going.
      if (list && !/^\s*(?:[-*•]|\d{1,3}[.)])\s+/.test(lines[i + 1] ?? '')) list = null;
      continue;
    }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      flushAll();
      continue;
    }
    const heading = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      blocks.push({ t: 'h', c: parseInline(heading[1]!.replace(/\s+#+\s*$/, ''), opts) });
      continue;
    }
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (q) {
      flushPara();
      list = null;
      quote.push(q[1]!);
      continue;
    }
    const bullet = /^(\s*)[-*•]\s+(.*)$/.exec(line);
    const ordered = /^(\s*)(\d{1,3})[.)]\s+(.*)$/.exec(line);
    if (bullet || ordered) {
      flushPara();
      flushQuote();
      const indent = (bullet ?? ordered)![1]!.replace(/\t/g, '    ').length;
      const depth = indent >= 2 ? 1 : 0;
      const content = bullet ? bullet[2]! : ordered![3]!;
      const isOrdered = !bullet;
      if (!list || (depth === 0 && list.ordered !== isOrdered)) {
        list = { t: 'list', ordered: isOrdered, start: isOrdered ? Number(ordered![2]) : 1, items: [] };
        blocks.push(list);
      }
      list.items.push({ c: parseInline(content.trim(), opts), depth });
      continue;
    }
    if (list && /^\s+\S/.test(line)) {
      // Continuation of the previous list item.
      const last = list.items[list.items.length - 1]!;
      last.c.push({ t: 'text', v: ' ' }, ...parseInline(line.trim(), opts));
      continue;
    }
    if (quote.length) flushQuote();
    list = null;
    para.push(line);
  }
  flushPara();
  flushQuote();
  return blocks;
}

/** Plain-text version of an answer for the clipboard, with a numbered source list. */
export function answerToClipboard(answer: string, sources: Array<{ n: number; b: Bookmark }>): string {
  const text = answer
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
  if (!sources.length) return text;
  return `${text}\n\nSources:\n${sources.map(({ n, b }) => `[${n}] @${b.author.handle}: ${b.url}`).join('\n')}`;
}

/* ------------------------------------------------------------ AI calls */

export const NVIDIA_ORIGIN = 'https://integrate.api.nvidia.com/*';

/**
 * Make sure the extension may call NVIDIA directly (optional host
 * permission). Call it first thing in a click / key handler: the browser only
 * shows the prompt during a user gesture, and never again once granted.
 */
export async function ensureNvidiaAccess(settings: Settings): Promise<void> {
  if (settings.ai.provider !== 'byok') return;
  let granted: boolean | null = null;
  try {
    granted = await browser.permissions.request({ origins: [NVIDIA_ORIGIN] });
  } catch {
    granted = null; // API unavailable here: let the request itself report any problem.
  }
  if (granted !== false) return;
  let has: boolean | null = null;
  try {
    has = await browser.permissions.contains({ origins: [NVIDIA_ORIGIN] });
  } catch {
    has = null;
  }
  if (has === false) throw new AiError('twtdash needs your permission to reach NVIDIA’s API. Allow it when your browser asks, then try again.', 'config');
}

/** Map a transport failure onto an actionable message (mirrors the categorizer's mapping). */
export function toAskError(err: unknown, model: string, provider: 'byok' | 'pro' = 'byok'): AiError | null {
  if (err instanceof AiError) return err;
  if (!(err instanceof AiCallError)) return null;
  const service = provider === 'pro' ? 'twtdash' : 'NVIDIA';
  switch (err.kind) {
    case 'network':
      return /too long/.test(err.message)
        ? new AiError(`${service} took too long to answer. Try again${provider === 'byok' ? ', or pick a faster model in Settings → AI' : ''}.`, 'network', true)
        : new AiError(`Could not reach ${service}. Check your connection and try again.`, 'network', true);
    case 'refusal':
      return new AiError('The AI declined to answer this. Try rephrasing the question.', 'refusal');
    case 'truncated':
      return new AiError('The AI ran out of room before answering. Try a narrower question.', 'other', true);
    case 'invalid_output':
      return new AiError(`The AI returned an empty answer. Try again${provider === 'byok' ? ', or pick another model in Settings → AI' : ''}.`, 'other', true);
    case 'http':
      break;
  }
  if (provider === 'pro') return new AiError(err.message, 'other', err.status >= 500);
  switch (err.status) {
    // NVIDIA answers a bad or revoked key with 403 "Authorization failed".
    case 401:
    case 403:
      return new AiError('NVIDIA rejected your API key. Check it in Settings → AI.', 'auth');
    case 404:
      return new AiError(`Model "${model}" isn’t available on NVIDIA right now. Pick another in Settings → AI.`, 'config');
    case 429:
      return new AiError('NVIDIA’s free rate limit was reached. Wait a minute, then try again.', 'rate', true);
    default:
      return err.status >= 500
        ? new AiError(`NVIDIA is having trouble right now (error ${err.status}). Try again in a moment.`, 'other', true)
        : new AiError(err.message, 'other');
  }
}

async function proError(res: Response, what: 'answer' | 'translate'): Promise<AiError> {
  const err = (await res.json().catch(() => null)) as ApiErrorBody | null;
  const message = err?.error?.message ?? `twtdash API error (${res.status})`;
  switch (err?.error?.code) {
    case 'unauthorized':
    case 'license_invalid':
      return new AiError('Your twtdash Pro license is not active. Check it in Settings → Plan.', 'license');
    case 'rate_limited':
      return new AiError(`You’ve hit the Pro AI limit for now. ${message}`, 'rate', true);
    case 'refusal':
      return new AiError(what === 'answer' ? 'The AI declined to answer this. Try rephrasing the question.' : 'The AI declined to translate this post.', 'refusal');
    default:
      return new AiError(message, 'other', res.status >= 500);
  }
}

function proHeaders(settings: Settings, accept: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    accept,
    authorization: `Bearer ${settings.license?.key ?? ''}`,
    [INSTANCE_HEADER]: settings.license?.instanceId ?? '',
  };
}

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export interface AskAiOptions {
  question: string;
  context: Bookmark[];
  settings: Settings;
  categories?: Map<string, Category>;
  history?: AskHistoryTurn[];
  signal?: AbortSignal;
  /** Full visible answer so far. */
  onText?: (text: string) => void;
  now?: number;
  /** Tests inject a mock. */
  fetch?: typeof fetch;
}

export interface AskAiResult {
  /** Citations normalised to `[n]`; ones outside the context removed. */
  answer: string;
  contextIds: string[];
  citedIds: string[];
  /** Citations that pointed outside the context and were dropped. */
  droppedCitations: number[];
  model?: string;
  truncated: boolean;
  /** The user pressed stop; `answer` holds what arrived. */
  stopped: boolean;
}

function finalize(raw: string, contextIds: string[], extra: Pick<AskAiResult, 'model' | 'truncated' | 'stopped'>): AskAiResult {
  const parsed = parseCitations(raw, contextIds);
  return { answer: cleanCitations(raw, contextIds.length).trim(), contextIds, citedIds: parsed.ids, droppedCitations: parsed.invalid, ...extra };
}

/** Ask the configured AI to answer from `context`, streaming the text as it arrives. */
export async function askAi(opts: AskAiOptions): Promise<AskAiResult> {
  const { settings, context, signal } = opts;
  if (!aiReady(settings)) throw new AiError('Set up AI in Settings → AI to get answers.', 'config');
  const provider = settings.ai.provider === 'pro' ? 'pro' : 'byok';
  const model = settings.ai.model;
  const posts = context.slice(0, ASK_LIMITS.posts).map((b) => toAskPost(b, opts.categories?.get(b.category)?.name));
  const contextIds = context.slice(0, ASK_LIMITS.posts).map((b) => b.id);
  const question = opts.question.trim().slice(0, ASK_LIMITS.questionChars);
  const history = (opts.history ?? []).slice(-3).map((h) => ({ question: h.question.slice(0, ASK_LIMITS.questionChars), answer: h.answer.slice(0, ASK_LIMITS.historyChars) }));
  const today = isoDate(opts.now ?? Date.now());
  const doFetch = opts.fetch ?? fetch;
  const combined = withTimeout(signal, 150_000);
  let latest = '';
  const onText = (t: string) => {
    latest = t;
    opts.onText?.(t);
  };

  try {
    let res: Response;
    if (provider === 'byok') {
      res = await openAnswerStream({ apiKey: settings.ai.apiKey.trim(), model, question, posts, history, today, signal: combined, fetch: doFetch });
    } else {
      const body: AskApiRequest = { question, posts, history, today, stream: true };
      try {
        res = await doFetch(API_BASE + API_PATHS.ask, { method: 'POST', headers: proHeaders(settings, 'text/event-stream'), body: JSON.stringify(body), signal: combined });
      } catch (err) {
        if (signal?.aborted) throw err;
        throw new AiCallError(combined.aborted ? 'The AI service took too long to respond.' : 'Could not reach the AI service.', 'network');
      }
      if (!res.ok) throw await proError(res, 'answer');
    }
    const out = await readChatStream(res, { onText, signal: combined });
    const done = finishAnswer(out, provider === 'pro' ? out.model || 'twtdash Pro' : model);
    return finalize(done.answer, contextIds, { model: done.model, truncated: done.truncated, stopped: false });
  } catch (err) {
    if (signal?.aborted) return finalize(latest, contextIds, { truncated: false, stopped: true });
    throw toAskError(err, model, provider) ?? err;
  }
}

/* ------------------------------------------------- Local-only messages */

/** Shown (without calling the AI) when nothing in the library matches. */
export function noMatchMessage(language: QuestionLanguage): string {
  if (language === 'devanagari') return 'आपके सेव किए गए पोस्ट में इस बारे में कुछ नहीं मिला। दूसरे शब्दों में पूछकर देखें, या अपने नए बुकमार्क सिंक करें।';
  if (language === 'hinglish') return 'Aapke saved posts mein iske baare mein kuch nahi mila. Doosre words mein poochh kar dekhiye, ya apne naye bookmarks sync kijiye.';
  return 'Nothing in your saved posts matches that. Try different words, or sync your latest bookmarks.';
}

/* -------------------------------------------------------- Suggestions */

const TOPIC_WORDS: Record<string, { en: string; hi: string; hinglish: string }> = {
  ai: { en: 'AI', hi: 'AI', hinglish: 'AI' },
  dev: { en: 'programming', hi: 'प्रोग्रामिंग', hinglish: 'programming' },
  design: { en: 'design', hi: 'डिज़ाइन', hinglish: 'design' },
  startups: { en: 'startups', hi: 'स्टार्टअप', hinglish: 'startups' },
  marketing: { en: 'marketing', hi: 'मार्केटिंग', hinglish: 'marketing' },
  finance: { en: 'investing', hi: 'निवेश', hinglish: 'investing' },
  crypto: { en: 'crypto', hi: 'क्रिप्टो', hinglish: 'crypto' },
  productivity: { en: 'productivity', hi: 'प्रोडक्टिविटी', hinglish: 'productivity' },
  career: { en: 'career', hi: 'करियर', hinglish: 'career' },
  science: { en: 'science', hi: 'विज्ञान', hinglish: 'science' },
  health: { en: 'fitness', hi: 'सेहत', hinglish: 'fitness' },
  learning: { en: 'learning', hi: 'पढ़ाई', hinglish: 'learning' },
  tools: { en: 'tools', hi: 'टूल्स', hinglish: 'tools' },
  news: { en: 'news', hi: 'न्यूज़', hinglish: 'news' },
  culture: { en: 'movies and culture', hi: 'फ़िल्मों', hinglish: 'movies' },
  humor: { en: 'memes', hi: 'मीम्स', hinglish: 'memes' },
};

export interface Suggestion {
  text: string;
  lang: 'en' | 'hi' | 'hinglish';
}

function topicFor(c: Category) {
  const known = TOPIC_WORDS[c.id];
  if (known) return known;
  const name = c.name.replace(/\s*&.*$/, '').trim() || c.name;
  return { en: name, hi: name, hinglish: name };
}

/** Starter questions from the library's own top categories, tags and authors, in English, Hindi and Hinglish. */
export function suggestQuestions(input: {
  bookmarks: Bookmark[];
  categories: Category[];
  categoryCounts: Map<string, number>;
  tags: Array<[string, number]>;
  authors: Array<{ handle: string; count: number }>;
  now?: number;
}): Suggestion[] {
  const now = input.now ?? Date.now();
  const top = input.categories
    .filter((c) => c.id !== 'other' && (input.categoryCounts.get(c.id) ?? 0) > 0)
    .sort((a, b) => (input.categoryCounts.get(b.id) ?? 0) - (input.categoryCounts.get(a.id) ?? 0));
  const monthStart = startOfMonth(new Date(now));
  const thisMonth = new Map<string, number>();
  let recentCount = 0;
  for (const b of input.bookmarks) {
    if (b.savedAt >= monthStart) thisMonth.set(b.category, (thisMonth.get(b.category) ?? 0) + 1);
    if (b.savedAt >= now - 7 * DAY) recentCount++;
  }
  const out: Suggestion[] = [];
  const [c1, c2, c3] = top;
  if (c1) out.push({ text: `What did I save about ${topicFor(c1).en}?`, lang: 'en' });
  if (c2) out.push({ text: `मैंने ${topicFor(c2).hi} के बारे में क्या सेव किया?`, lang: 'hi' });
  const monthly = top.find((c) => (thisMonth.get(c.id) ?? 0) >= 2);
  if (monthly) out.push({ text: `Summarize my ${topicFor(monthly).en} bookmarks from this month`, lang: 'en' });
  else if (c3) out.push({ text: `Summarize my ${topicFor(c3).en} bookmarks`, lang: 'en' });
  const tag = input.tags.find(([t]) => t.length > 2)?.[0];
  if (tag) out.push({ text: `${tag} ke baare mein maine kya save kiya?`, lang: 'hinglish' });
  const author = input.authors[0];
  if (author && author.count >= 2) out.push({ text: `What are the main ideas from @${author.handle}?`, lang: 'en' });
  out.push(recentCount ? { text: 'इस हफ्ते मैंने क्या-क्या सेव किया?', lang: 'hi' } : { text: 'What are the most useful tips I saved?', lang: 'en' });
  return out.slice(0, 6);
}

/* ------------------------------------------------------------- History */

export interface SavedAnswer {
  id: string;
  question: string;
  answer: string;
  contextIds: string[];
  citedIds: string[];
  model?: string;
  at: number;
}

const HISTORY_KEY = 'twtdash:ask:history';
export const HISTORY_LIMIT = 20;

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? globalThis.localStorage ?? null : globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function loadAskHistory(): SavedAnswer[] {
  try {
    const raw = safeStorage('local')?.getItem(HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as SavedAnswer[]) : [];
    return Array.isArray(list) ? list.filter((x) => x && typeof x.question === 'string' && typeof x.answer === 'string').slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

/** Newest first; asking the same question again replaces the older answer. */
export function saveToAskHistory(entry: SavedAnswer): SavedAnswer[] {
  const key = entry.question.trim().toLowerCase();
  const list = [entry, ...loadAskHistory().filter((x) => x.question.trim().toLowerCase() !== key)].slice(0, HISTORY_LIMIT);
  try {
    safeStorage('local')?.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: history is a convenience */
  }
  return list;
}

export function clearAskHistory(): void {
  try {
    safeStorage('local')?.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

/* ---------------------------------------------------------- Translation */

const translationMemo = new Map<string, string>();

function hashText(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function translationKey(postId: string, target: TranslateLanguageCode, text: string): string {
  return `twtdash:tr:${postId}:${target}:${hashText(text)}`;
}

export function getCachedTranslation(key: string): string | undefined {
  const hit = translationMemo.get(key);
  if (hit !== undefined) return hit;
  try {
    const stored = safeStorage('session')?.getItem(key);
    if (stored) {
      translationMemo.set(key, stored);
      return stored;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export function setCachedTranslation(key: string, value: string): void {
  translationMemo.set(key, value);
  try {
    safeStorage('session')?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Which language a post most likely is, as a translate code (for picking a sensible default target). */
export function postLanguage(text: string): TranslateLanguageCode | null {
  const lang = detectQuestionLanguage(text);
  const map: Partial<Record<QuestionLanguage, TranslateLanguageCode>> = {
    en: 'en',
    hinglish: 'hinglish',
    devanagari: 'hi',
    bengali: 'bn',
    tamil: 'ta',
    telugu: 'te',
    gujarati: 'gu',
    kannada: 'kn',
    malayalam: 'ml',
    gurmukhi: 'pa',
    urdu: 'ur',
  };
  return map[lang] ?? null;
}

/** The user's language from the browser, if it's one we translate into. */
export function browserLanguage(languages: readonly string[] = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []): TranslateLanguageCode | null {
  for (const l of languages) {
    const base = l.toLowerCase().split('-')[0]!;
    const hit = TRANSLATE_LANGUAGES.find((x) => x.code === base);
    if (hit) return hit.code;
  }
  return null;
}

/**
 * Default target for a post: a non-English post → English; an English post →
 * the remembered choice, else the browser's Indian language, else Hindi.
 */
export function defaultTranslateTarget(text: string, remembered: TranslateLanguageCode | null, browserLang: TranslateLanguageCode | null): TranslateLanguageCode {
  const source = postLanguage(text);
  if (source && source !== 'en' && source !== 'hinglish') return remembered && remembered !== source ? remembered : 'en';
  if (remembered && remembered !== 'en') return remembered;
  if (browserLang && browserLang !== 'en') return browserLang;
  return 'hi';
}

/** Translate text into `target` with the configured AI. */
export async function translateText(text: string, target: TranslateLanguageCode, settings: Settings, opts: { signal?: AbortSignal; fetch?: typeof fetch } = {}): Promise<string> {
  if (!aiReady(settings)) throw new AiError('Add a free NVIDIA key in Settings → AI to translate posts.', 'config');
  const provider = settings.ai.provider === 'pro' ? 'pro' : 'byok';
  const signal = withTimeout(opts.signal, 60_000);
  const clipped = text.slice(0, ASK_LIMITS.translateChars);
  try {
    if (provider === 'byok') {
      const r = await requestTranslation({ apiKey: settings.ai.apiKey.trim(), model: settings.ai.model, text: clipped, target, signal, fetch: opts.fetch });
      return r.text;
    }
    const body: TranslateApiRequest = { mode: 'translate', text: clipped, target };
    let res: Response;
    try {
      res = await (opts.fetch ?? fetch)(API_BASE + API_PATHS.ask, { method: 'POST', headers: proHeaders(settings, 'application/json'), body: JSON.stringify(body), signal });
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      throw new AiCallError('Could not reach the AI service.', 'network');
    }
    if (!res.ok) throw await proError(res, 'translate');
    const data = (await res.json()) as TranslateApiResponse;
    if (!data.text?.trim()) throw new AiCallError('The AI returned an empty translation.', 'invalid_output');
    return data.text;
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    throw toAskError(err, settings.ai.model, provider) ?? err;
  }
}
