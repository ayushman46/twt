/**
 * Search query language + library filtering.
 *
 *   from:handle  -from:handle  cat:ai  tag:react  in:"Reading list"
 *   has:media|image|video|gif|link|poll|note|summary|tags
 *   is:thread|reply|quote|long|article|starred|unread|read|archived|liked
 *   after:2025-01-01  before:30d  min_likes:500  min_views:10k  lang:en
 *   domain:github.com  "exact phrase"  -exclude
 */
import type { Bookmark, Category, Collection, Facet } from './types';

export type ScopeKind = 'all' | 'unread' | 'starred' | 'archived' | 'category' | 'collection' | 'tag' | 'author' | 'facet' | 'likes';

export interface Scope {
  kind: ScopeKind;
  value?: string;
}

export type SortKey = 'relevance' | 'saved' | 'saved-asc' | 'newest' | 'oldest' | 'likes' | 'views';

export const SORT_LABELS: Record<SortKey, string> = {
  relevance: 'Best match',
  saved: 'Recently saved',
  'saved-asc': 'Oldest saved',
  newest: 'Newest posts',
  oldest: 'Oldest posts',
  likes: 'Most liked',
  views: 'Most viewed',
};

export interface ParsedQuery {
  raw: string;
  text: string;
  phrases: string[];
  highlight: string[];
  from: string[];
  notFrom: string[];
  cats: string[];
  notCats: string[];
  tags: string[];
  notTags: string[];
  collections: string[];
  has: string[];
  notHas: string[];
  is: string[];
  notIs: string[];
  lang: string[];
  domains: string[];
  exclude: string[];
  after?: number;
  before?: number;
  minLikes?: number;
  minViews?: number;
}

const TOKEN_RE = /(-?)([a-z_]+):("([^"]*)"|\S+)|(-?)"([^"]*)"|(\S+)/gi;

function parseNumber(v: string): number | undefined {
  const m = v.toLowerCase().match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!m) return undefined;
  const n = parseFloat(m[1]!);
  return Math.round(m[2] === 'k' ? n * 1_000 : m[2] === 'm' ? n * 1_000_000 : n);
}

/** "2025-01-31" or relative "7d" / "2w" / "3m" / "1y" (= that long ago). */
export function parseDate(v: string): number | undefined {
  const rel = v.toLowerCase().match(/^(\d+)([dwmy])$/);
  if (rel) {
    const n = parseInt(rel[1]!, 10);
    const day = 86_400_000;
    const mult = rel[2] === 'd' ? day : rel[2] === 'w' ? 7 * day : rel[2] === 'm' ? 30 * day : 365 * day;
    return Date.now() - n * mult;
  }
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : undefined;
}

export function parseQuery(raw: string): ParsedQuery {
  const q: ParsedQuery = {
    raw,
    text: '',
    phrases: [],
    highlight: [],
    from: [],
    notFrom: [],
    cats: [],
    notCats: [],
    tags: [],
    notTags: [],
    collections: [],
    has: [],
    notHas: [],
    is: [],
    notIs: [],
    lang: [],
    domains: [],
    exclude: [],
  };
  const words: string[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(raw))) {
    if (m[2]) {
      const neg = m[1] === '-';
      const key = m[2].toLowerCase();
      const value = (m[4] ?? m[3] ?? '').trim();
      const v = value.toLowerCase();
      if (!v) continue;
      switch (key) {
        case 'from':
        case 'by':
        case 'author':
          (neg ? q.notFrom : q.from).push(v.replace(/^@/, ''));
          break;
        case 'cat':
        case 'category':
          (neg ? q.notCats : q.cats).push(v);
          break;
        case 'tag':
          (neg ? q.notTags : q.tags).push(v.replace(/^#/, ''));
          break;
        case 'in':
        case 'collection':
          q.collections.push(v);
          break;
        case 'has':
          (neg ? q.notHas : q.has).push(v);
          break;
        case 'is':
          (neg ? q.notIs : q.is).push(v);
          break;
        case 'lang':
          q.lang.push(v);
          break;
        case 'domain':
        case 'url':
        case 'site':
          q.domains.push(v.replace(/^https?:\/\//, '').replace(/^www\./, ''));
          break;
        case 'after':
        case 'since':
          q.after = parseDate(value);
          break;
        case 'before':
        case 'until':
          q.before = parseDate(value);
          break;
        case 'min_likes':
        case 'minlikes':
        case 'likes':
          q.minLikes = parseNumber(v.replace(/^>/, ''));
          break;
        case 'min_views':
        case 'minviews':
        case 'views':
          q.minViews = parseNumber(v.replace(/^>/, ''));
          break;
        default:
          // Unknown operator: treat as plain text ("http:" etc.)
          words.push(m[0]);
      }
    } else if (m[6] !== undefined) {
      const phrase = m[6].trim();
      if (phrase) {
        if (m[5] === '-') q.exclude.push(phrase.toLowerCase());
        else {
          q.phrases.push(phrase.toLowerCase());
          q.highlight.push(phrase);
        }
      }
    } else if (m[7]) {
      const w = m[7];
      if (w.startsWith('-') && w.length > 1) q.exclude.push(w.slice(1).toLowerCase());
      else {
        words.push(w);
        q.highlight.push(w);
      }
    }
  }
  q.text = words.join(' ');
  return q;
}

export function hasOperators(q: ParsedQuery): boolean {
  return (
    q.from.length + q.notFrom.length + q.cats.length + q.notCats.length + q.tags.length + q.notTags.length + q.collections.length + q.has.length + q.notHas.length + q.is.length + q.notIs.length + q.lang.length + q.domains.length + q.exclude.length + q.phrases.length > 0 ||
    q.after !== undefined ||
    q.before !== undefined ||
    q.minLikes !== undefined ||
    q.minViews !== undefined
  );
}

export function isEmptyQuery(q: ParsedQuery): boolean {
  return !q.text.trim() && !hasOperators(q);
}

export interface FilterContext {
  categories: Category[];
  collections: Collection[];
}

function resolveCategory(v: string, cats: Category[]): string | undefined {
  return cats.find((c) => c.id === v || c.name.toLowerCase() === v || c.name.toLowerCase().startsWith(v))?.id;
}

function resolveCollection(v: string, cols: Collection[]): string | undefined {
  return cols.find((c) => c.id === v || c.name.toLowerCase() === v || c.name.toLowerCase().startsWith(v))?.id;
}

const FACET_ALIASES: Record<string, Facet> = {
  media: 'media',
  image: 'image',
  images: 'image',
  photo: 'image',
  photos: 'image',
  video: 'video',
  videos: 'video',
  gif: 'gif',
  link: 'link',
  links: 'link',
  poll: 'poll',
  thread: 'thread',
  threads: 'thread',
  reply: 'reply',
  replies: 'reply',
  quote: 'quote',
  quotes: 'quote',
  long: 'long',
  article: 'article',
  articles: 'article',
};

function hasCheck(b: Bookmark, v: string): boolean {
  const facet = FACET_ALIASES[v];
  if (facet) return b.facets.includes(facet);
  switch (v) {
    case 'note':
    case 'notes':
      return !!b.note.trim();
    case 'summary':
    case 'gist':
      return !!b.summary;
    case 'tags':
    case 'tag':
      return b.tags.length > 0;
    case 'collection':
      return b.collections.length > 0;
    default:
      return true;
  }
}

function isCheck(b: Bookmark, v: string): boolean {
  switch (v) {
    case 'starred':
    case 'star':
    case 'favorite':
      return b.starred === 1;
    case 'unread':
      return b.read === 0;
    case 'read':
      return b.read === 1;
    case 'archived':
      return b.archived === 1;
    case 'liked':
    case 'like':
      return b.sources.includes('like');
    case 'bookmarked':
    case 'bookmark':
      return b.sources.includes('bookmark');
    case 'ai':
      return b.categorySource === 'ai';
    case 'partial':
      return !!b.partial;
    case 'uncategorized':
      return b.category === 'other';
    default:
      return hasCheck(b, v);
  }
}

export function matchesScope(b: Bookmark, scope: Scope): boolean {
  switch (scope.kind) {
    case 'all':
      return b.archived === 0;
    case 'unread':
      return b.archived === 0 && b.read === 0;
    case 'starred':
      return b.starred === 1;
    case 'archived':
      return b.archived === 1;
    case 'category':
      return b.archived === 0 && b.category === scope.value;
    case 'collection':
      return b.collections.includes(scope.value ?? '');
    case 'tag':
      return b.archived === 0 && b.tags.includes(scope.value ?? '');
    case 'author':
      return b.author.handle.toLowerCase() === (scope.value ?? '').toLowerCase();
    case 'facet':
      return b.archived === 0 && b.facets.includes(scope.value as Facet);
    case 'likes':
      return b.archived === 0 && b.sources.includes('like');
  }
}

function searchableText(b: Bookmark): string {
  return [b.text, b.quoted?.text, b.card?.title, b.card?.description, b.article?.title, b.note, b.summary, b.author.name, b.author.handle, b.links.map((l) => l.url).join(' ')]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

/** Apply every operator except free text (which is handled by the search index). */
export function applyOperators(list: Bookmark[], q: ParsedQuery, ctx: FilterContext): Bookmark[] {
  if (!hasOperators(q)) return list;
  const cats = q.cats.map((c) => resolveCategory(c, ctx.categories)).filter((c): c is string => !!c);
  const notCats = q.notCats.map((c) => resolveCategory(c, ctx.categories)).filter((c): c is string => !!c);
  const cols = q.collections.map((c) => resolveCollection(c, ctx.collections)).filter((c): c is string => !!c);
  const unknownCollection = q.collections.length > 0 && cols.length === 0;
  const unknownCategory = q.cats.length > 0 && cats.length === 0;
  if (unknownCollection || unknownCategory) return [];

  return list.filter((b) => {
    const handle = b.author.handle.toLowerCase();
    if (q.from.length && !q.from.some((f) => handle === f || handle.startsWith(f))) return false;
    if (q.notFrom.length && q.notFrom.some((f) => handle === f)) return false;
    if (cats.length && !cats.includes(b.category)) return false;
    if (notCats.length && notCats.includes(b.category)) return false;
    if (q.tags.length && !q.tags.every((t) => b.tags.some((bt) => bt === t || bt.startsWith(t)))) return false;
    if (q.notTags.length && q.notTags.some((t) => b.tags.includes(t))) return false;
    if (cols.length && !cols.every((c) => b.collections.includes(c))) return false;
    if (q.has.length && !q.has.every((h) => hasCheck(b, h))) return false;
    if (q.notHas.length && q.notHas.some((h) => hasCheck(b, h))) return false;
    if (q.is.length && !q.is.every((v) => isCheck(b, v))) return false;
    if (q.notIs.length && q.notIs.some((v) => isCheck(b, v))) return false;
    if (q.lang.length && !q.lang.includes(b.lang)) return false;
    if (q.domains.length) {
      const domains = [...b.links.map((l) => l.domain), b.card?.domain ?? ''];
      if (!q.domains.every((d) => domains.some((x) => x === d || x.endsWith('.' + d) || x.includes(d)))) return false;
    }
    if (q.after !== undefined && b.createdAt < q.after) return false;
    if (q.before !== undefined && b.createdAt > q.before) return false;
    if (q.minLikes !== undefined && b.metrics.likes < q.minLikes) return false;
    if (q.minViews !== undefined && b.metrics.views < q.minViews) return false;
    if (q.phrases.length || q.exclude.length) {
      const text = searchableText(b);
      if (q.phrases.some((p) => !text.includes(p))) return false;
      if (q.exclude.some((x) => text.includes(x))) return false;
    }
    return true;
  });
}

export function sortBookmarks(list: Bookmark[], sort: SortKey, scores?: Map<string, number>): Bookmark[] {
  const arr = [...list];
  switch (sort) {
    case 'relevance':
      if (scores) return arr.sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || b.savedAt - a.savedAt);
      return arr.sort((a, b) => b.savedAt - a.savedAt);
    case 'saved':
      return arr.sort((a, b) => b.savedAt - a.savedAt);
    case 'saved-asc':
      return arr.sort((a, b) => a.savedAt - b.savedAt);
    case 'newest':
      return arr.sort((a, b) => b.createdAt - a.createdAt);
    case 'oldest':
      return arr.sort((a, b) => a.createdAt - b.createdAt);
    case 'likes':
      return arr.sort((a, b) => b.metrics.likes - a.metrics.likes);
    case 'views':
      return arr.sort((a, b) => b.metrics.views - a.metrics.views);
  }
}

export const OPERATOR_HELP: Array<{ op: string; example: string; description: string }> = [
  { op: 'from:', example: 'from:paulg', description: 'Posts by an author' },
  { op: 'cat:', example: 'cat:design', description: 'In a category' },
  { op: 'tag:', example: 'tag:react', description: 'With a tag' },
  { op: 'in:', example: 'in:"read later"', description: 'In a collection' },
  { op: 'has:', example: 'has:video', description: 'media, image, video, link, poll, note, summary' },
  { op: 'is:', example: 'is:thread', description: 'thread, reply, quote, long, starred, unread, liked' },
  { op: 'after:', example: 'after:30d', description: 'Posted after a date (or 7d, 3m, 1y ago)' },
  { op: 'before:', example: 'before:2025-01-01', description: 'Posted before a date' },
  { op: 'min_likes:', example: 'min_likes:1k', description: 'At least N likes' },
  { op: 'domain:', example: 'domain:github.com', description: 'Links to a site' },
  { op: 'lang:', example: 'lang:en', description: 'Post language' },
  { op: '-word', example: '-crypto', description: 'Exclude a word' },
  { op: '"…"', example: '"system design"', description: 'Exact phrase' },
];
