/**
 * Loads the labeled eval set, assigns the dev/test split and converts posts
 * to the TweetData shape the classifier sees in production.
 *
 * Split: stratified by (group, gold label). Within each stratum posts
 * alternate dev/test in file order, starting from a hash of the stratum key
 * so one-post strata spread evenly over both halves. Tune on `dev`, report
 * on `test`.
 */
import type { TweetData } from '../../types';
import { posts as eastWest } from './data/east-west';
import { linkPosts, posts as en } from './data/en';
import { posts as enIn } from './data/en-in';
import { posts as hiMr } from './data/hi-mr';
import { posts as hinglish } from './data/hinglish';
import { posts as south } from './data/south';
import type { EvalGroup, EvalPost } from './types';

export type Split = 'dev' | 'test';

export interface EvalItem extends EvalPost {
  split: Split;
}

const LANG: Record<EvalGroup, string> = {
  en: 'en',
  'en-in': 'en',
  hinglish: 'hi',
  hi: 'hi',
  mr: 'mr',
  bn: 'bn',
  gu: 'gu',
  pa: 'pa',
  ta: 'ta',
  te: 'te',
  kn: 'kn',
  ml: 'ml',
  link: 'zxx',
};

/** Language buckets used in the report. */
export const GROUP_BUCKET: Record<EvalGroup, string> = {
  en: 'English (global)',
  'en-in': 'English (India)',
  hinglish: 'Hinglish',
  hi: 'Hindi',
  mr: 'Regional Indic',
  bn: 'Regional Indic',
  gu: 'Regional Indic',
  pa: 'Regional Indic',
  ta: 'Regional Indic',
  te: 'Regional Indic',
  kn: 'Regional Indic',
  ml: 'Regional Indic',
  link: 'Link-only',
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const ALL_POSTS: EvalPost[] = [...en, ...linkPosts, ...enIn, ...hinglish, ...hiMr, ...south, ...eastWest];

function assignSplits(list: EvalPost[]): EvalItem[] {
  const seen = new Map<string, number>();
  return list.map((p) => {
    const key = `${p.group}|${p.gold}`;
    const n = seen.get(key) ?? hash(key) % 2;
    seen.set(key, n + 1);
    return { ...p, split: n % 2 === 0 ? 'dev' : 'test' };
  });
}

export const EVAL_SET: EvalItem[] = assignSplits(ALL_POSTS);

export function toTweet(p: EvalPost): TweetData {
  const url = p.link ? `https://${p.link.domain}/p/${p.id}` : '';
  const hashtags = [...p.text.matchAll(/#([^\s#.,!?()]+)/g)].map((m) => m[1]!);
  return {
    id: p.id,
    url: `https://x.com/eval/status/${p.id}`,
    // X expands t.co links into the text; the classifier strips URLs.
    text: p.link ? `${p.text} ${url}`.trim() : p.text,
    lang: LANG[p.group],
    createdAt: 0,
    author: { id: p.id, name: 'Eval', handle: `eval_${p.id}`, avatar: '', verified: false },
    media: [],
    links: p.link ? [{ url, display: `${p.link.domain}/p/…`, domain: p.link.domain }] : [],
    hashtags,
    mentions: [],
    card: p.link && (p.link.title || p.link.description) ? { url, title: p.link.title, description: p.link.description, domain: p.link.domain } : undefined,
    quoted: p.quoted
      ? { id: `${p.id}-q`, url: '', text: p.quoted, createdAt: 0, author: { id: 'q', name: 'Q', handle: 'q', avatar: '', verified: false }, media: [] }
      : undefined,
    metrics: { likes: 0, retweets: 0, replies: 0, quotes: 0, views: 0, bookmarks: 0 },
    isReply: false,
    isNote: p.text.length > 280,
  };
}
