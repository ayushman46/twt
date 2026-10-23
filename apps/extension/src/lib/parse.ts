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
  const legacy = u?.legacy ?? {};
  const avatarRaw: string = u?.avatar?.image_url ?? legacy.profile_image_url_https ?? '';
  return {
    id: String(u?.rest_id ?? fallbackId ?? ''),
    name: u?.core?.name ?? legacy.name ?? '',
    handle: u?.core?.screen_name ?? legacy.screen_name ?? '',
    avatar: avatarRaw.replace('_normal.', '_bigger.'),
    verified: Boolean(u?.is_blue_verified || u?.verification?.verified || legacy.verified),
    // `legacy` was dropped from user objects in July 2026; counts moved to relationship_counts.
    followers: u?.relationship_counts?.followers ?? legacy.followers_count ?? undefined,
  };
}

function parseMedia(legacy: Json): Media[] {
  const list: Json[] = legacy?.extended_entities?.media ?? legacy?.entities?.media ?? [];
  const out: Media[] = [];
  for (const m of list) {
    if (!m?.media_url_https) continue;
    const type: Media['type'] = m.type === 'video' ? 'video' : m.type === 'animated_gif' ? 'gif' : 'photo';
    let videoUrl: string | undefined;
    const variants: Json[] | undefined = m.video_info?.variants;
    if (variants?.length) {
      const mp4 = variants
        .filter((v) => v.content_type === 'video/mp4' && v.url)
        .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
      // Prefer a mid bitrate for smooth inline playback.
      videoUrl = (mp4.length > 2 ? mp4[1] : mp4[0])?.url;
    }
    out.push({
      type,
      url: m.media_url_https,
      width: m.original_info?.width,
      height: m.original_info?.height,
      alt: m.ext_alt_text || undefined,
      videoUrl,
      durationMs: m.video_info?.duration_millis,
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
  if (note?.text) {
    text = decodeEntities(note.text);
    entities = note.entity_set ?? {};
    isNote = true;
  } else {
    // X's indices are code points over the *unescaped* text, so decode first.
    // Only the start of display_text_range is used (it drops leading reply
    // mentions); trailing media/quote links are removed by value below, which
    // stays correct even when the range end is off.
    const full = decodeEntities(legacy.full_text ?? legacy.text ?? '');
    const range: [number, number] | undefined = legacy.display_text_range;
    text = range?.[0] ? Array.from(full).slice(range[0]).join('') : full;
    entities = legacy.entities ?? {};
  }

  const tco = new Map<string, string>();
  const links: LinkRef[] = [];
  const seenLinks = new Set<string>();
  const urlEntities: Json[] = [...(entities.urls ?? []), ...(isNote ? (legacy.entities?.urls ?? []) : [])];
  for (const u of urlEntities) {
    if (!u?.url) continue;
    const expanded: string = u.expanded_url ?? u.url;
    tco.set(u.url, expanded);
    const statusMatch = expanded.match(STATUS_URL_RE);
    if (statusMatch && quotedId && statusMatch[1] === quotedId) {
      text = text.split(u.url).join('');
      continue;
    }
    text = text.split(u.url).join(expanded);
    if (!statusMatch && !seenLinks.has(expanded)) {
      seenLinks.add(expanded);
      links.push({ url: expanded, display: u.display_url ?? expanded, domain: domainOf(expanded) });
    }
  }
  const mediaList: Json[] = legacy.extended_entities?.media ?? legacy.entities?.media ?? [];
  for (const m of mediaList) if (m?.url) text = text.split(m.url).join('');
  // Leftover quote permalink (outside entities on some payloads).
  const permalink: string | undefined = legacy.quoted_status_permalink?.url;
  if (permalink) text = text.split(permalink).join('');

  const hashtags: string[] = (entities.hashtags ?? []).map((h: Json) => String(h.text ?? '')).filter(Boolean);
  const mentions: string[] = (entities.user_mentions ?? []).map((m: Json) => String(m.screen_name ?? '')).filter(Boolean);
  return { text: text.replace(/[ \t]+\n/g, '\n').trim(), links, hashtags, mentions, isNote, tco };
}

function bindingValues(cardLegacy: Json): Record<string, Json> {
  const bv: Record<string, Json> = {};
  for (const b of cardLegacy?.binding_values ?? []) if (b?.key) bv[b.key] = b.value;
  return bv;
}

function parsePoll(cardLegacy: Json): Poll | undefined {
  const name: string = cardLegacy?.name ?? '';
  if (!/poll\d?choice/.test(name)) return undefined;
  const bv = bindingValues(cardLegacy);
  const options: Poll['options'] = [];
  for (let i = 1; i <= 4; i++) {
    const label = bv[`choice${i}_label`]?.string_value;
    if (!label) break;
    options.push({ label, votes: Number(bv[`choice${i}_count`]?.string_value ?? 0) || 0 });
  }
  if (!options.length) return undefined;
  const end = Date.parse(bv.end_datetime_utc?.string_value ?? '');
  return { options, endsAt: Number.isFinite(end) ? end : undefined };
}

function parseUnifiedCard(json: string): LinkCard | undefined {
  try {
    const uc = JSON.parse(json);
    const dest = Object.values(uc.destination_objects ?? {})[0] as Json;
    const url: string | undefined = dest?.data?.url_data?.url;
    let title: string | undefined;
    for (const c of Object.values(uc.component_objects ?? {}) as Json[]) {
      title ??= c?.data?.title?.content;
    }
    const media = Object.values(uc.media_entities ?? {})[0] as Json;
    if (!url) return undefined;
    return { url, title, image: media?.media_url_https, domain: domainOf(url) };
  } catch {
    return undefined;
  }
}

function parseCard(raw: Json, tco: Map<string, string>): LinkCard | undefined {
  const cardLegacy = raw.card?.legacy;
  if (!cardLegacy) return undefined;
  const name: string = cardLegacy.name ?? '';
  if (/poll\d?choice/.test(name)) return undefined;
  const bv = bindingValues(cardLegacy);
  if (bv.unified_card?.string_value) return parseUnifiedCard(bv.unified_card.string_value);
  const str = (k: string): string | undefined => bv[k]?.string_value || undefined;
  const img = (k: string): string | undefined => bv[k]?.image_value?.url || undefined;
  const title = str('title');
  const image =
    img('summary_photo_image_large') ??
    img('thumbnail_image_large') ??
    img('player_image_large') ??
    img('photo_image_full_size_large') ??
    img('summary_photo_image') ??
    img('thumbnail_image');
  const rawUrl = str('card_url') ?? cardLegacy.url ?? '';
  const url = tco.get(rawUrl) ?? rawUrl;
  if (!title && !image) return undefined;
  if (!url || /^card:\/\//.test(url)) return undefined;
  return {
    url,
    title,
    description: str('description'),
    image,
    domain: str('vanity_url') ?? str('domain') ?? domainOf(url),
  };
}

function parseArticle(raw: Json): Article | undefined {
  const art = raw.article?.article_results?.result;
  if (!art?.title) return undefined;
  return {
    title: String(art.title),
    preview: art.preview_text || undefined,
    cover: art.cover_media?.media_info?.original_img_url || undefined,
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
  const parsedDate = Date.parse(legacy.created_at ?? '');
  const createdAt = Number.isFinite(parsedDate) ? parsedDate : (snowflakeToMs(id) ?? Date.now());

  return {
    id,
    url: tweetUrl(author.handle, id),
    text,
    lang: legacy.lang ?? 'und',
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
      likes: legacy.favorite_count ?? 0,
      retweets: legacy.retweet_count ?? 0,
      replies: legacy.reply_count ?? 0,
      quotes: legacy.quote_count ?? 0,
      bookmarks: legacy.bookmark_count ?? 0,
      views: Number(raw.views?.count ?? 0) || 0,
    },
    isReply: Boolean(legacy.in_reply_to_status_id_str),
    replyTo: legacy.in_reply_to_screen_name || undefined,
    conversationId: legacy.conversation_id_str || undefined,
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
      if (ic.cursorType === 'Bottom') cursorBottom = ic.value;
      return;
    }
    const res = ic.tweet_results?.result;
    if (!res || ic.promotedMetadata) return;
    const t = normalizeTweet(res);
    if (t) tweets.push({ tweet: t, sortIndex });
  };

  const handleEntry = (entry: Json) => {
    if (!entry) return;
    entryCount++;
    const entryId: string = entry.entryId ?? '';
    const content = entry.content ?? {};
    if (entryId.startsWith('promoted-')) return;
    if (entryId.startsWith('cursor-bottom') || content.cursorType === 'Bottom') {
      cursorBottom = content.value ?? content.itemContent?.value ?? cursorBottom;
      return;
    }
    if (entryId.startsWith('cursor-') || content.cursorType) return;
    if (content.itemContent) handleItem(content.itemContent, entry.sortIndex);
    else if (Array.isArray(content.items)) for (const it of content.items) handleItem(it?.item?.itemContent, entry.sortIndex);
  };

  for (const ins of findInstructions(json)) {
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
    for (const key of Object.keys(v)) {
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
