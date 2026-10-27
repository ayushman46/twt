/**
 * Parser for X's (Twitter's) internal GraphQL responses.
 *
 * X ships schema changes often, so everything here is defensive: unknown
 * shapes are skipped instead of throwing, and fields are read from both the
 * current and legacy locations.
 */
import type { Article, Author, LinkCard, LinkRef, Media, Poll, QuotedTweet, TweetData } from './types';

// X responses are untyped JSON.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

// Typed readers: a field of the wrong type reads as missing, so a schema change
// can never put a number where a string belongs (or NaN into a count).
const str = (v: Json): string | undefined => (typeof v === 'string' ? v : undefined);
const arr = (v: Json): Json[] => (Array.isArray(v) ? v : []);
const obj = (v: Json): Json => (v && typeof v === 'object' ? v : {});
function num(v: Json): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

const TWITTER_EPOCH = 1288834974657n;

export function snowflakeToMs(id: string | undefined | null): number | undefined {
  if (!id || !/^\d{15,20}$/.test(id)) return undefined;
  try {
    return Number((BigInt(id) >> 22n) + TWITTER_EPOCH);
  } catch {
    return undefined;
  }
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
function decodeEntities(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m);
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

const STATUS_URL_RE = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i;

export function unwrapTweet(result: Json): Json | null {
  let r = result;
  for (let i = 0; i < 3 && r; i++) {
    if (r.__typename === 'TweetWithVisibilityResults' || (r.tweet && !r.legacy)) {
      r = r.tweet;
      continue;
    }
    break;
  }
  if (!r || typeof r !== 'object' || !r.legacy) return null;
  if (r.__typename === 'TweetTombstone' || r.__typename === 'TweetUnavailable') return null;
  return r;
}

function parseAuthor(userResult: Json, fallbackId?: string): Author {
  const u = userResult && (userResult.legacy || userResult.core) ? userResult : null;
  const legacy = obj(u?.legacy);
  const avatarRaw = str(u?.avatar?.image_url) ?? str(legacy.profile_image_url_https) ?? '';
  return {
    id: String(u?.rest_id ?? fallbackId ?? ''),
    name: str(u?.core?.name) ?? str(legacy.name) ?? '',
    handle: str(u?.core?.screen_name) ?? str(legacy.screen_name) ?? '',
    avatar: avatarRaw.replace('_normal.', '_bigger.'),
    verified: Boolean(u?.is_blue_verified || u?.verification?.verified || legacy.verified),
    // `legacy` was dropped from user objects in July 2026; counts moved to relationship_counts.
    followers: num(u?.relationship_counts?.followers) ?? num(legacy.followers_count),
  };
}

function parseMedia(legacy: Json): Media[] {
  const list = arr(legacy?.extended_entities?.media ?? legacy?.entities?.media);
  const out: Media[] = [];
  for (const m of list) {
    const url = str(m?.media_url_https);
    if (!url) continue;
    const type: Media['type'] = m.type === 'video' ? 'video' : m.type === 'animated_gif' ? 'gif' : 'photo';
    let videoUrl: string | undefined;
    const variants = arr(m.video_info?.variants);
    if (variants.length) {
      const mp4 = variants
        .filter((v) => v?.content_type === 'video/mp4' && str(v.url))
        .sort((a, b) => (num(b.bitrate) ?? 0) - (num(a.bitrate) ?? 0));
      // Prefer a mid bitrate for smooth inline playback.
      videoUrl = (mp4.length > 2 ? mp4[1] : mp4[0])?.url;
    }
    out.push({
      type,
      url,
      width: num(m.original_info?.width),
      height: num(m.original_info?.height),
      alt: str(m.ext_alt_text) || undefined,
      videoUrl,
      durationMs: num(m.video_info?.duration_millis),
    });
  }
  return out;
}

interface TextResult {
  text: string;
  links: LinkRef[];
  hashtags: string[];
  mentions: string[];
  isNote: boolean;
  tco: Map<string, string>;
}

function parseText(raw: Json, legacy: Json, quotedId?: string): TextResult {
  const note = raw.note_tweet?.note_tweet_results?.result;
  let text: string;
  let entities: Json;
  let isNote = false;
  if (str(note?.text)) {
    text = decodeEntities(note.text);
    entities = obj(note.entity_set);
    isNote = true;
  } else {
    // X's indices are code points over the *unescaped* text, so decode first.
    // Only the start of display_text_range is used (it drops leading reply
    // mentions); trailing media/quote links are removed by value below, which
    // stays correct even when the range end is off.
    const full = decodeEntities(str(legacy.full_text) ?? str(legacy.text) ?? '');
    const start = num(legacy.display_text_range?.[0]);
    text = start && start > 0 ? Array.from(full).slice(start).join('') : full;
    entities = obj(legacy.entities);
  }

  const tco = new Map<string, string>();
  const links: LinkRef[] = [];
  const seenLinks = new Set<string>();
  const urlEntities = [...arr(entities.urls), ...(isNote ? arr(legacy.entities?.urls) : [])];
  for (const u of urlEntities) {
    const short = str(u?.url);
    if (!short) continue;
    const expanded = str(u.expanded_url) ?? short;
    tco.set(short, expanded);
    const statusMatch = expanded.match(STATUS_URL_RE);
    if (statusMatch && quotedId && statusMatch[1] === quotedId) {
      text = text.split(short).join('');
      continue;
    }
    text = text.split(short).join(expanded);
    if (!statusMatch && !seenLinks.has(expanded)) {
      seenLinks.add(expanded);
      links.push({ url: expanded, display: str(u.display_url) ?? expanded, domain: domainOf(expanded) });
    }
  }
  const mediaList = arr(legacy.extended_entities?.media ?? legacy.entities?.media);
  for (const m of mediaList) if (str(m?.url)) text = text.split(m.url).join('');
  // Leftover quote permalink (outside entities on some payloads).
  const permalink = str(legacy.quoted_status_permalink?.url);
  if (permalink) text = text.split(permalink).join('');

  const hashtags: string[] = arr(entities.hashtags).map((h: Json) => str(h?.text) ?? '').filter(Boolean);
  const mentions: string[] = arr(entities.user_mentions).map((m: Json) => str(m?.screen_name) ?? '').filter(Boolean);
  return { text: text.replace(/[ \t]+\n/g, '\n').trim(), links, hashtags, mentions, isNote, tco };
}

function bindingValues(cardLegacy: Json): Record<string, Json> {
  const bv: Record<string, Json> = {};
  for (const b of arr(cardLegacy?.binding_values)) if (str(b?.key)) bv[b.key] = b.value;
  return bv;
}

function parsePoll(cardLegacy: Json): Poll | undefined {
  const name = str(cardLegacy?.name) ?? '';
  if (!/poll\d?choice/.test(name)) return undefined;
  const bv = bindingValues(cardLegacy);
  const options: Poll['options'] = [];
  for (let i = 1; i <= 4; i++) {
    const label = str(bv[`choice${i}_label`]?.string_value);
    if (!label) break;
    options.push({ label, votes: num(bv[`choice${i}_count`]?.string_value) ?? 0 });
  }
  if (!options.length) return undefined;
  const end = Date.parse(str(bv.end_datetime_utc?.string_value) ?? '');
  return { options, endsAt: Number.isFinite(end) ? end : undefined };
}

function parseUnifiedCard(json: string): LinkCard | undefined {
  try {
    const uc = JSON.parse(json);
    const dest = Object.values(uc.destination_objects ?? {})[0] as Json;
    const url = str(dest?.data?.url_data?.url);
    let title: string | undefined;
    for (const c of Object.values(uc.component_objects ?? {}) as Json[]) {
      title ??= str(c?.data?.title?.content);
    }
    const media = Object.values(uc.media_entities ?? {})[0] as Json;
    if (!url) return undefined;
    return { url, title, image: str(media?.media_url_https), domain: domainOf(url) };
  } catch {
    return undefined;
  }
}

function parseCard(raw: Json, tco: Map<string, string>): LinkCard | undefined {
  const cardLegacy = raw.card?.legacy;
  if (!cardLegacy) return undefined;
  const name = str(cardLegacy.name) ?? '';
  if (/poll\d?choice/.test(name)) return undefined;
  const bv = bindingValues(cardLegacy);
  const unified = str(bv.unified_card?.string_value);
  if (unified) return parseUnifiedCard(unified);
  const text = (k: string): string | undefined => str(bv[k]?.string_value) || undefined;
  const img = (k: string): string | undefined => str(bv[k]?.image_value?.url) || undefined;
  const title = text('title');
  const image =
    img('summary_photo_image_large') ??
    img('thumbnail_image_large') ??
    img('player_image_large') ??
    img('photo_image_full_size_large') ??
    img('summary_photo_image') ??
    img('thumbnail_image');
  const rawUrl = text('card_url') ?? str(cardLegacy.url) ?? '';
  const url = tco.get(rawUrl) ?? rawUrl;
  if (!title && !image) return undefined;
  if (!url || /^card:\/\//.test(url)) return undefined;
  return {
    url,
    title,
    description: text('description'),
    image,
    domain: text('vanity_url') ?? text('domain') ?? domainOf(url),
  };
}

function parseArticle(raw: Json): Article | undefined {
  const art = raw.article?.article_results?.result;
  if (!art?.title) return undefined;
  return {
    title: String(art.title),
    preview: str(art.preview_text) || undefined,
    cover: str(art.cover_media?.media_info?.original_img_url) || undefined,
  };
}

export function tweetUrl(handle: string, id: string): string {
  return `https://x.com/${handle || 'i'}/status/${id}`;
}

export function normalizeTweet(input: Json, nested = false, hops = 0): TweetData | null {
  const raw = unwrapTweet(input);
  if (!raw || hops > 3) return null;
  const legacy = raw.legacy;

  // A retweet is saved as the original post.
  const rt = legacy.retweeted_status_result?.result;
  if (rt) {
    const original = normalizeTweet(rt, nested, hops + 1);
    if (original) return original;
  }

  const id = String(raw.rest_id ?? legacy.id_str ?? '');
  if (!/^\d+$/.test(id)) return null;

  const author = parseAuthor(raw.core?.user_results?.result, legacy.user_id_str);

  let quoted: QuotedTweet | undefined;
  if (!nested) {
    const q = raw.quoted_status_result?.result;
    const qt = q ? normalizeTweet(q, true, hops + 1) : null;
    if (qt) quoted = { id: qt.id, url: qt.url, text: qt.text, createdAt: qt.createdAt, author: qt.author, media: qt.media };
  }

  const { text, links, hashtags, mentions, isNote, tco } = parseText(raw, legacy, quoted?.id ?? legacy.quoted_status_id_str);
  const parsedDate = Date.parse(str(legacy.created_at) ?? '');
  const createdAt = Number.isFinite(parsedDate) ? parsedDate : (snowflakeToMs(id) ?? Date.now());

  return {
    id,
    url: tweetUrl(author.handle, id),
    text,
    lang: str(legacy.lang) ?? 'und',
    createdAt,
    author,
    media: parseMedia(legacy),
    links,
    hashtags,
    mentions,
    card: parseCard(raw, tco),
    poll: parsePoll(raw.card?.legacy),
    quoted,
    article: parseArticle(raw),
    metrics: {
      likes: num(legacy.favorite_count) ?? 0,
      retweets: num(legacy.retweet_count) ?? 0,
      replies: num(legacy.reply_count) ?? 0,
      quotes: num(legacy.quote_count) ?? 0,
      bookmarks: num(legacy.bookmark_count) ?? 0,
      views: num(raw.views?.count) ?? 0,
    },
    isReply: Boolean(legacy.in_reply_to_status_id_str),
    replyTo: str(legacy.in_reply_to_screen_name) || undefined,
    conversationId: str(legacy.conversation_id_str) || undefined,
    isNote,
  };
}

export interface TimelineTweet {
  tweet: TweetData;
  sortIndex?: string;
}

export interface TimelineParseResult {
  tweets: TimelineTweet[];
  cursorBottom?: string;
  /** Number of timeline entries (including cursors). */
  entryCount: number;
}

function findInstructions(json: Json): Json[] {
  const out: Json[] = [];
  const stack: Array<{ v: Json; d: number }> = [{ v: json, d: 0 }];
  while (stack.length) {
    const { v, d } = stack.pop()!;
    if (!v || typeof v !== 'object' || d > 12) continue;
    if (Array.isArray(v.instructions)) {
      out.push(...v.instructions);
      continue;
    }
    for (const key of Object.keys(v)) {
      const child = v[key];
      if (child && typeof child === 'object') stack.push({ v: child, d: d + 1 });
    }
  }
  return out;
}

/** Parse a timeline response (Bookmarks, Likes, folders…) preserving entry order. */
export function parseTimeline(json: Json): TimelineParseResult {
  const tweets: TimelineTweet[] = [];
  let cursorBottom: string | undefined;
  let entryCount = 0;

  const handleItem = (ic: Json, sortIndex?: string) => {
    if (!ic) return;
    if (ic.cursorType) {
      if (ic.cursorType === 'Bottom') cursorBottom = str(ic.value) ?? cursorBottom;
      return;
    }
    const res = ic.tweet_results?.result;
    if (!res || ic.promotedMetadata) return;
    const t = normalizeTweet(res);
    if (t) tweets.push({ tweet: t, sortIndex });
  };

  const handleEntry = (entry: Json) => {
    if (!entry || typeof entry !== 'object') return;
    entryCount++;
    const entryId = str(entry.entryId) ?? '';
    const content = obj(entry.content);
    const sortIndex = str(entry.sortIndex);
    if (entryId.startsWith('promoted-')) return;
    if (entryId.startsWith('cursor-bottom') || content.cursorType === 'Bottom') {
      cursorBottom = str(content.value) ?? str(content.itemContent?.value) ?? cursorBottom;
      return;
    }
    if (entryId.startsWith('cursor-') || content.cursorType) return;
    if (content.itemContent) handleItem(content.itemContent, sortIndex);
    else if (Array.isArray(content.items)) for (const it of content.items) handleItem(it?.item?.itemContent, sortIndex);
  };

  for (const ins of findInstructions(json)) {
    if (!ins || typeof ins !== 'object') continue;
    if (Array.isArray(ins.entries)) ins.entries.forEach(handleEntry);
    if (ins.entry) handleEntry(ins.entry);
    if (Array.isArray(ins.moduleItems)) for (const mi of ins.moduleItems) handleItem(mi?.item?.itemContent, undefined);
  }
  return { tweets, cursorBottom, entryCount };
}

/** Collect every post found anywhere in a response (used to cache posts the user sees). */
export function collectTweets(json: Json, limit = 400): TweetData[] {
  const out: TweetData[] = [];
  const seen = new Set<string>();
  const stack: Array<{ v: Json; d: number }> = [{ v: json, d: 0 }];
  while (stack.length && out.length < limit) {
    const { v, d } = stack.pop()!;
    if (!v || typeof v !== 'object' || d > 40) continue;
    if (v.__typename === 'Tweet' && v.legacy && v.rest_id && !seen.has(v.rest_id)) {
      const t = normalizeTweet(v);
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        out.push(t);
      }
      seen.add(v.rest_id);
    }
    for (const key of Object.keys(v)) {
      const child = v[key];
      if (child && typeof child === 'object') stack.push({ v: child, d: d + 1 });
    }
  }
  return out;
}

export interface XFolder {
  id: string;
  name: string;
}

/** Bookmark folders (X Premium) from a `BookmarkFoldersSlice` response. */
export function parseBookmarkFolders(json: Json): XFolder[] {
  const out: XFolder[] = [];
  const stack: Array<{ v: Json; d: number }> = [{ v: json, d: 0 }];
  while (stack.length) {
    const { v, d } = stack.pop()!;
    if (!v || typeof v !== 'object' || d > 15) continue;
    if (v.__typename === 'BookmarkCollection' && v.id && v.name) {
      out.push({ id: String(v.id), name: String(v.name) });
      continue;
    }
    // Children are pushed last-first so they pop in document order (X's folder order).
    for (const key of Object.keys(v).reverse()) {
      const child = v[key];
      if (child && typeof child === 'object') stack.push({ v: child, d: d + 1 });
    }
  }
  return out;
}

/**
 * The bookmark timeline's `sortIndex` is a snowflake of when the post was
 * bookmarked. Returns that time when it's plausible, otherwise undefined.
 */
export function bookmarkTimeFromSortIndex(sortIndex: string | undefined, tweetCreatedAt: number): number | undefined {
  const ms = snowflakeToMs(sortIndex);
  if (!ms) return undefined;
  const now = Date.now();
  if (ms > now + 86_400_000 || ms < tweetCreatedAt - 60_000 || ms < Date.UTC(2011, 0, 1)) return undefined;
  return ms;
}
