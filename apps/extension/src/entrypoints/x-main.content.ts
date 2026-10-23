/**
 * Runs in X's page context (MAIN world) at document_start and observes the
 * responses of X's own GraphQL requests. Nothing is modified or re-sent: we
 * read the data X already loaded for the user and hand it to the extension.
 */
import { defineContentScript } from 'wxt/utils/define-content-script';
import { MAIN_SOURCE, type MainEnvelope, type MainMessage } from '@/lib/bridge-protocol';
import { collectTweets, parseBookmarkFolders, parseTimeline } from '@/lib/parse';
import type { Source, TweetData } from '@/lib/types';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  noScriptStartedPostMessage: true,
  main() {
    install();
  },
});

const GQL_RE = /\/i\/api\/graphql\/[^/?#]+\/([A-Za-z0-9_]+)/;
const TIMELINES: Record<string, Source> = { Bookmarks: 'bookmark', BookmarkFolderTimeline: 'bookmark', Likes: 'like' };
const MUTATION_RE = /^(Create|Delete|Favorite|Unfavorite|bookmark|Remove|Update|Pin|Unpin|Mute|Unmute|Block|Follow|Unfollow)/;
const CACHE_LIMIT = 2000;

const cache = new Map<string, TweetData>();

function remember(t: TweetData) {
  if (cache.has(t.id)) cache.delete(t.id);
  cache.set(t.id, t);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function post(msg: MainMessage) {
  const envelope: MainEnvelope = { source: MAIN_SOURCE, msg };
  window.postMessage(envelope, location.origin);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function variablesOf(url: string, body: unknown): Record<string, any> {
  try {
    if (typeof body === 'string' && body.startsWith('{')) {
      const j = JSON.parse(body);
      if (j?.variables) return typeof j.variables === 'string' ? JSON.parse(j.variables) : j.variables;
    }
  } catch {
    /* ignore */
  }
  try {
    const v = new URL(url, location.origin).searchParams.get('variables');
    if (v) return JSON.parse(v);
  } catch {
    /* ignore */
  }
  return {};
}

function viewerId(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)twid=([^;]+)/);
  if (!m) return null;
  const v = decodeURIComponent(m[1]!);
  return v.replace(/^u=/, '');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onResponse(op: string, url: string, body: unknown, data: any) {
  if (!data || typeof data !== 'object' || (data.errors && !data.data)) return;
  const vars = variablesOf(url, body);
  const tweetId = vars.tweet_id ? String(vars.tweet_id) : '';

  switch (op) {
    case 'CreateBookmark':
      if (tweetId) post({ kind: 'saved', source: 'bookmark', tweetId, tweet: cache.get(tweetId) });
      return;
    case 'bookmarkTweetToFolder':
      if (tweetId) post({ kind: 'saved', source: 'bookmark', tweetId, tweet: cache.get(tweetId), folderId: String(vars.bookmark_collection_id ?? '') });
      return;
    case 'DeleteBookmark':
      if (tweetId) post({ kind: 'removed', source: 'bookmark', tweetId });
      return;
    case 'FavoriteTweet':
      if (tweetId) post({ kind: 'saved', source: 'like', tweetId, tweet: cache.get(tweetId) });
      return;
    case 'UnfavoriteTweet':
      if (tweetId) post({ kind: 'removed', source: 'like', tweetId });
      return;
    case 'BookmarkFoldersSlice': {
      const folders = parseBookmarkFolders(data);
      if (folders.length) post({ kind: 'folders', folders });
      return;
    }
  }

  const source = TIMELINES[op];
  if (source) {
    const parsed = parseTimeline(data);
    for (const t of parsed.tweets) remember(t.tweet);
    if (op === 'Likes') {
      const me = viewerId();
      if (me && vars.userId && String(vars.userId) !== me) return;
    }
    post({
      kind: 'timeline',
      source,
      op,
      tweets: parsed.tweets,
      entryCount: parsed.entryCount,
      folderId: op === 'BookmarkFolderTimeline' ? String(vars.bookmark_collection_id ?? '') : undefined,
    });
    return;
  }

  // Any other read: remember posts so real-time bookmark captures have full data.
  if (!MUTATION_RE.test(op)) for (const t of collectTweets(data)) remember(t);
}

function safely(fn: () => void) {
  try {
    fn();
  } catch (err) {
    console.debug('[twtdash] could not read response', err);
  }
}

function install() {
  const w = window as Window & { __twtdashInstalled?: boolean };
  if (w.__twtdashInstalled) return;
  w.__twtdashInstalled = true;

  // XMLHttpRequest (X's primary transport)
  const XHR = XMLHttpRequest.prototype;
  const origOpen = XHR.open;
  const origSend = XHR.send;
  type TaggedXHR = XMLHttpRequest & { __smUrl?: string };

  XHR.open = function (this: TaggedXHR, ...args: unknown[]) {
    this.__smUrl = String(args[1] ?? '');
    return (origOpen as (...a: unknown[]) => void).apply(this, args);
  } as typeof XHR.open;

  XHR.send = function (this: TaggedXHR, body?: Document | XMLHttpRequestBodyInit | null) {
    const url = this.__smUrl ?? '';
    const m = url.match(GQL_RE);
    if (m) {
      const op = m[1]!;
      this.addEventListener('load', () => {
        if (this.status < 200 || this.status >= 300) return;
        safely(() => {
          let data: unknown = null;
          if (this.responseType === 'json') data = this.response;
          else if (this.responseType === '' || this.responseType === 'text') data = JSON.parse(this.responseText);
          onResponse(op, url, body, data);
        });
      });
    }
    return origSend.call(this, body);
  };

  // fetch
  const origFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const m = url.match(GQL_RE);
    let bodyPromise: Promise<unknown> | null = null;
    if (m) {
      if (typeof init?.body === 'string') bodyPromise = Promise.resolve(init.body);
      else if (input instanceof Request && !init?.body) bodyPromise = input.clone().text().catch(() => '');
      else bodyPromise = Promise.resolve('');
    }
    const res = await origFetch.call(this, input, init);
    if (m && res.ok) {
      const op = m[1]!;
      res
        .clone()
        .json()
        .then(async (data) => {
          const body = await bodyPromise;
          safely(() => onResponse(op, url, body, data));
        })
        .catch(() => undefined);
    }
    return res;
  };
}
