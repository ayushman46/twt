import { snowflakeToMs, tweetUrl } from '@/lib/parse';
import type { Media, TweetData } from '@/lib/types';

/**
 * Last-resort capture from the rendered page, used when a post was bookmarked
 * before we saw its data in a response. Stored as `partial` and refreshed on
 * the next sync.
 */
export function scrapeTweet(tweetId: string): TweetData | undefined {
  const anchor = document.querySelector<HTMLAnchorElement>(`article a[href*="/status/${tweetId}"]`);
  const article = anchor?.closest('article');
  if (!article) return undefined;

  const text = (article.querySelector<HTMLElement>('[data-testid="tweetText"]')?.innerText ?? '').trim();
  const userBox = article.querySelector('[data-testid="User-Name"]');
  const handleHref = userBox?.querySelector<HTMLAnchorElement>('a[href^="/"]')?.getAttribute('href') ?? '';
  const handle = handleHref.replace(/^\//, '').split('/')[0] ?? '';
  const name = (userBox?.querySelector('span')?.textContent ?? handle).trim();
  const avatar = article.querySelector<HTMLImageElement>('[data-testid="Tweet-User-Avatar"] img')?.src ?? '';
  const datetime = article.querySelector(`a[href*="/status/${tweetId}"] time`)?.getAttribute('datetime');
  const media: Media[] = Array.from(article.querySelectorAll<HTMLImageElement>('[data-testid="tweetPhoto"] img'))
    .map((img) => ({ type: 'photo' as const, url: img.src.replace(/name=\w+/, 'name=large') }))
    .filter((m) => m.url.startsWith('https://'));

  return {
    id: tweetId,
    url: tweetUrl(handle, tweetId),
    text,
    lang: 'und',
    createdAt: (datetime ? Date.parse(datetime) : NaN) || snowflakeToMs(tweetId) || Date.now(),
    author: { id: '', name, handle, avatar, verified: false },
    media,
    links: [],
    hashtags: Array.from(text.matchAll(/#([\p{L}\p{N}_]+)/gu), (m) => m[1]!),
    mentions: Array.from(text.matchAll(/@(\w{1,15})/g), (m) => m[1]!),
    metrics: { likes: 0, retweets: 0, replies: 0, quotes: 0, views: 0, bookmarks: 0 },
    isReply: false,
    isNote: false,
  };
}

/** The logged-in user's handle from X's navigation bar. */
export function findViewerHandle(): string | null {
  const href = document.querySelector<HTMLAnchorElement>('a[data-testid="AppTabBar_Profile_Link"]')?.getAttribute('href');
  const handle = href?.replace(/^\//, '').split('/')[0];
  return handle && /^\w{1,15}$/.test(handle) ? handle : null;
}

export function isLoggedOut(): boolean {
  const p = location.pathname;
  if (p.startsWith('/i/flow/login') || p.startsWith('/login') || p.startsWith('/i/flow/signup')) return true;
  return !!document.querySelector('[data-testid="loginButton"], a[href="/login"][role="link"][data-testid]');
}

export function findRetryButton(): HTMLElement | null {
  const scope = document.querySelector('[data-testid="primaryColumn"]') ?? document;
  const candidates = scope.querySelectorAll<HTMLElement>('button, [role="button"]');
  for (const b of candidates) {
    const t = (b.textContent ?? '').trim().toLowerCase();
    if (t === 'retry' || t === 'try again') return b;
  }
  return null;
}
