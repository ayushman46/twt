/**
 * A local stand-in for x.com, used to test the real extension end to end.
 *
 * Chrome is started with `--host-resolver-rules=MAP x.com 127.0.0.1:<port>`, so
 * the extension's real content scripts run on these pages. The pages call
 * GraphQL endpoints the way X's web app does (fetch and XHR, alternating) and
 * the responses use X's shapes: legacy and current user objects, visibility
 * wrappers, long "note" posts, link cards, photos, quotes and deleted posts.
 *
 * Scenario switches (GET /__sim/state?...): loggedout=1|0, extra=<n new posts
 * at the top>, ratelimit=<page index that fails once with 429>.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { join } from 'node:path';

const TWITTER_EPOCH = 1288834974657n;
const BASE_ID = 1810000000000000000n;
const PAGE = 20;
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);

const xDate = (ms) => {
  const d = new Date(ms);
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = (n) => String(n).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} +0000 ${d.getUTCFullYear()}`;
};
/** Snowflake for a time — X's sortIndex encodes when the post was bookmarked. */
const snowflake = (ms) => String((BigInt(ms) - TWITTER_EPOCH) << 22n);

const legacyUser = (id, handle, name) => ({
  __typename: 'User',
  rest_id: id,
  is_blue_verified: true,
  legacy: { name, screen_name: handle, profile_image_url_https: `https://pbs.twimg.com/profile_images/${id}/a_normal.jpg`, followers_count: 12000 },
});
const newUser = (id, handle, name) => ({
  __typename: 'User',
  rest_id: id,
  is_blue_verified: false,
  core: { name, screen_name: handle, created_at: 'Mon Jan 01 00:00:00 +0000 2018' },
  avatar: { image_url: `https://pbs.twimg.com/profile_images/${id}/b_normal.png` },
  verification: { verified: false },
  relationship_counts: { followers: 50, following: 10 },
});

/** Eight kinds of post, cycled; `expect` is the category the classifier should pick. */
const KINDS = [
  { expect: 'ai', text: (i) => `Fine-tuning small LLMs beats prompting for structured extraction, run ${i}. Evals and code: https://t.co/r${i}`, link: (i) => `https://github.com/sim/llm-extract-${i}` },
  { expect: 'dev', text: (i) => `TypeScript tip ${i}: use satisfies to keep literal types while checking against an interface. Works great with React props.` },
  { expect: 'startups', wrap: true, text: (i) => `Bootstrapped SaaS update ${i}: we crossed $20k MRR by talking to customers every week and pricing for value.` },
  { expect: 'startups', note: true, text: (i) => `How we went from zero to $1M ARR as a bootstrapped startup, part ${i} 🧵\n\n1/ Talk to customers every week.\n2/ Charge from day one.\n3/ Hire slowly.\n\nMore: https://t.co/n${i}` },
  { expect: 'design', card: true, text: (i) => `Bookmark this: a field guide to variable fonts and typography in UI design, chapter ${i} https://t.co/c${i}` },
  { expect: 'sports', photo: true, text: (i) => `IPL ${i}: आज रात का मैच शानदार रहा, विराट ने शतक लगाया और टीम ने फाइनल में जगह बनाई! क्रिकेट का असली मज़ा 🏏` },
  { expect: 'dev', quote: true, text: (i) => `This is the cleanest Rust + TypeScript monorepo setup I have seen, build ${i}. The CI config alone is worth it.` },
  { expect: 'finance', text: (i) => `Bhai SIP mat roko market girne pe. Nifty index fund mein har mahine invest karo, ${i} saal baad compounding ka magic dikhega. Mutual fund > FD` },
];

function makePost(i, savedAt) {
  const kind = KINDS[i % KINDS.length];
  const id = String(BASE_ID + BigInt(i));
  const handle = `simauthor${i % 9}`;
  const user = i % 2 ? newUser(String(1000 + (i % 9)), handle, `Sim Author ${i % 9}`) : legacyUser(String(1000 + (i % 9)), handle, `Sim Author ${i % 9}`);
  const text = kind.text(i);
  const legacy = {
    id_str: id,
    created_at: xDate(savedAt - 3 * DAY),
    full_text: kind.note ? `${text.slice(0, 120)}…` : text,
    lang: kind.expect === 'sports' ? 'hi' : 'en',
    favorite_count: 100 + i * 7,
    retweet_count: 10 + i,
    reply_count: i % 13,
    quote_count: i % 5,
    bookmark_count: 30 + i,
    conversation_id_str: id,
    entities: { hashtags: [], user_mentions: [], urls: kind.link ? [{ url: `https://t.co/r${i}`, expanded_url: kind.link(i), display_url: kind.link(i).replace('https://', '') }] : [] },
  };
  const tweet = { __typename: 'Tweet', rest_id: id, core: { user_results: { result: user } }, views: { count: String(5000 + i * 31), state: 'EnabledWithCount' }, legacy };
  if (kind.note) {
    tweet.note_tweet = { note_tweet_results: { result: { text, entity_set: { urls: [], hashtags: [], user_mentions: [] } } } };
  }
  if (kind.card) {
    legacy.entities.urls = [{ url: `https://t.co/c${i}`, expanded_url: `https://fonts.example.com/guide/${i}`, display_url: `fonts.example.com/guide/${i}` }];
    tweet.card = {
      legacy: {
        name: 'summary_large_image',
        url: `https://t.co/c${i}`,
        binding_values: [
          { key: 'title', value: { string_value: `A field guide to variable fonts, chapter ${i}`, type: 'STRING' } },
          { key: 'description', value: { string_value: 'Typography for interfaces', type: 'STRING' } },
          { key: 'vanity_url', value: { string_value: 'fonts.example.com', type: 'STRING' } },
        ],
      },
    };
  }
  if (kind.photo) {
    legacy.extended_entities = { media: [{ url: `https://t.co/m${i}`, type: 'photo', media_url_https: `https://pbs.twimg.com/media/sim${i}.jpg`, original_info: { width: 1200, height: 675 }, ext_alt_text: 'Stadium at night' }] };
    legacy.entities.media = [{ url: `https://t.co/m${i}` }];
  }
  if (kind.quote) {
    const qid = String(BASE_ID - 1000n - BigInt(i));
    tweet.quoted_status_result = { result: { __typename: 'Tweet', rest_id: qid, core: { user_results: { result: newUser('77', 'devdan', 'Dan Ortiz') } }, legacy: { created_at: xDate(savedAt - 9 * DAY), full_text: 'Shipped a tiny CLI in Rust today', entities: { urls: [], hashtags: [], user_mentions: [] } } } };
    legacy.quoted_status_id_str = qid;
  }
  const result = kind.wrap ? { __typename: 'TweetWithVisibilityResults', tweet } : tweet;
  return { id, kind: i % KINDS.length, expect: kind.expect, result, savedAt };
}

const entry = (p) => ({
  entryId: `tweet-${p.id}`,
  sortIndex: snowflake(p.savedAt),
  content: { entryType: 'TimelineTimelineItem', __typename: 'TimelineTimelineItem', itemContent: { itemType: 'TimelineTweet', __typename: 'TimelineTweet', tweet_results: { result: p.result } } },
});
const cursor = (value, type) => ({ entryId: `cursor-${type.toLowerCase()}-${value}`, sortIndex: '0', content: { entryType: 'TimelineTimelineCursor', __typename: 'TimelineTimelineCursor', value, cursorType: type } });

export function createSim({ posts = 90, tombstoneEvery = 23 } = {}) {
  const state = { loggedout: false, extra: 0, ratelimit: -1, rateLimited: false, requests: [] };
  /** Newest first. Extra posts are newer than everything else. */
  const library = () => {
    const out = [];
    for (let k = state.extra - 1; k >= 0; k--) out.push(makePost(posts + 100 + k, NOW + (k + 1) * 3_600_000));
    for (let i = 0; i < posts; i++) out.push(makePost(i, NOW - i * 7_200_000));
    return out;
  };
  // Deleted posts are fixed per post (not per position), so adding new posts doesn't change which ones are gone.
  const isTomb = (p) => BigInt(p.id) - BASE_ID < BigInt(posts) && Number(BigInt(p.id) - BASE_ID) % tombstoneEvery === tombstoneEvery - 1;
  const expected = () => library().filter((p) => !isTomb(p));

  function bookmarksPage(cursorValue) {
    const all = library();
    const offset = cursorValue ? Number(String(cursorValue).replace(/^c/, '')) || 0 : 0;
    const slice = all.slice(offset, offset + PAGE);
    const entries = slice.map((p) => {
      const e = entry(p);
      if (!isTomb(p)) return e;
      return { ...e, content: { ...e.content, itemContent: { ...e.content.itemContent, tweet_results: { result: { __typename: 'TweetTombstone', tombstone: {} } } } } };
    });
    entries.push(cursor(`t${offset}`, 'Top'), cursor(`c${offset + PAGE}`, 'Bottom'));
    return { data: { bookmark_timeline_v2: { timeline: { instructions: [{ type: 'TimelineAddEntries', entries }] } } } };
  }

  const homePosts = () => [makePost(500, NOW - DAY), makePost(501, NOW - DAY - 1000), makePost(505, NOW - DAY - 2000)];
  function homeTimeline() {
    const entries = homePosts().map(entry);
    entries.push(cursor('h0', 'Bottom'));
    return { data: { home: { home_timeline_urt: { instructions: [{ type: 'TimelineAddEntries', entries }] } } } };
  }

  const json = (res, status, body, extra = {}) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...extra });
    res.end(JSON.stringify(body));
  };
  const html = (res, body) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'set-cookie': 'twid=u%3D900; Path=/; Secure' });
    res.end(body);
  };

  function handler(req, res) {
    const url = new URL(req.url, 'https://x.com');
    state.requests.push(`${req.method} ${url.pathname}`);
    if (url.pathname === '/__sim/state') {
      for (const k of ['loggedout', 'extra', 'ratelimit']) if (url.searchParams.has(k)) state[k] = k === 'loggedout' ? url.searchParams.get(k) === '1' : Number(url.searchParams.get(k));
      state.rateLimited = false;
      return json(res, 200, { ...state, requests: state.requests.length });
    }
    const gql = url.pathname.match(/^\/i\/api\/graphql\/[^/]+\/(\w+)$/);
    if (gql) {
      const op = gql[1];
      if (op === 'Bookmarks') {
        const vars = JSON.parse(url.searchParams.get('variables') || '{}');
        const pageIndex = vars.cursor ? Number(String(vars.cursor).replace(/^c/, '')) / PAGE : 0;
        if (pageIndex === state.ratelimit && !state.rateLimited) {
          state.rateLimited = true;
          return json(res, 429, { errors: [{ message: 'Rate limit exceeded', code: 88 }] });
        }
        return json(res, 200, bookmarksPage(vars.cursor));
      }
      if (op === 'HomeTimeline') return json(res, 200, homeTimeline());
      if (op === 'CreateBookmark') return json(res, 200, { data: { tweet_bookmark_put: 'Done' } });
      if (op === 'DeleteBookmark') return json(res, 200, { data: { tweet_bookmark_delete: 'Done' } });
      return json(res, 404, { errors: [{ message: `unknown op ${op}` }] });
    }
    if (url.pathname === '/i/bookmarks') return html(res, state.loggedout ? LOGGED_OUT : BOOKMARKS_PAGE);
    if (url.pathname === '/home') return html(res, state.loggedout ? LOGGED_OUT : HOME_PAGE);
    if (url.pathname === '/favicon.ico') {
      res.writeHead(204);
      return res.end();
    }
    return html(res, `<!doctype html><title>X</title><p>Sim page ${url.pathname}</p>`);
  }

  return { state, handler, expected, homePosts, PAGE };
}

const SHELL_CSS = `body{margin:0;background:#000;color:#e7e9ea;font:15px/1.4 system-ui,sans-serif}nav{position:fixed;left:0;top:0;width:80px}main{margin-left:100px;max-width:600px}article{border-bottom:1px solid #2f3336;padding:16px;min-height:140px}`;

const BOOKMARKS_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Bookmarks / X</title><style>${SHELL_CSS}</style></head><body>
<nav><a data-testid="AppTabBar_Profile_Link" href="/simuser">Profile</a></nav>
<main><div data-testid="primaryColumn"><h2>Bookmarks</h2><section id="tl"></section><div id="status"></div></div></main>
<script>
let cursor = null, loading = false, ended = false, n = 0;
const handleOf = (t) => { const u = t.core && t.core.user_results && t.core.user_results.result; return (u && ((u.legacy && u.legacy.screen_name) || (u.core && u.core.screen_name))) || 'x'; };
function get(url) {
  // X uses both transports; alternate so the extension's fetch and XHR hooks are both exercised.
  if (n++ % 2) {
    return new Promise((resolve, reject) => { const x = new XMLHttpRequest(); x.open('GET', url); x.onload = () => resolve({ status: x.status, data: x.status === 200 ? JSON.parse(x.responseText) : null }); x.onerror = reject; x.send(); });
  }
  return fetch(url, { credentials: 'include' }).then(async (r) => ({ status: r.status, data: r.ok ? await r.json() : null }));
}
async function load() {
  if (loading || ended) return;
  loading = true;
  const vars = { count: 20, cursor, includePromotedContent: true };
  const r = await get('/i/api/graphql/SIMbk1/Bookmarks?variables=' + encodeURIComponent(JSON.stringify(vars)));
  if (r.status !== 200) {
    // Like X: a "Retry" button the extension knows how to press.
    const s = document.getElementById('status');
    s.innerHTML = '<p>Something went wrong.</p><button role="button">Retry</button>';
    s.querySelector('button').onclick = () => { s.innerHTML = ''; loading = false; load(); };
    return;
  }
  const entries = r.data.data.bookmark_timeline_v2.timeline.instructions[0].entries;
  for (const e of entries) {
    if (e.content.entryType === 'TimelineTimelineCursor') { if (e.content.cursorType === 'Bottom') cursor = e.content.value; continue; }
    const res = e.content.itemContent.tweet_results.result;
    const t = res.tweet || res;
    if (!t.rest_id) continue;
    const a = document.createElement('article');
    a.innerHTML = '<a href="/' + handleOf(t) + '/status/' + t.rest_id + '">post</a><div data-testid="tweetText"></div>';
    a.querySelector('[data-testid=tweetText]').textContent = (t.legacy && t.legacy.full_text) || '';
    document.getElementById('tl').append(a);
  }
  if (entries.length <= 2) ended = true;
  loading = false;
}
addEventListener('scroll', () => { if (innerHeight + scrollY > document.documentElement.scrollHeight - 900) load(); });
load();
</script></body></html>`;

const HOME_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Home / X</title><style>${SHELL_CSS}</style></head><body>
<nav><a data-testid="AppTabBar_Profile_Link" href="/simuser">Profile</a></nav>
<main><div data-testid="primaryColumn"><h2>Home</h2><section id="tl"></section></div></main>
<script>
async function act(op, id) {
  await fetch('/i/api/graphql/SIMm1/' + op, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ variables: { tweet_id: id }, queryId: 'SIMm1' }) });
}
(async () => {
  const data = await (await fetch('/i/api/graphql/SIMh1/HomeTimeline?variables=%7B%7D')).json();
  for (const e of data.data.home.home_timeline_urt.instructions[0].entries) {
    if (e.content.entryType === 'TimelineTimelineCursor') continue;
    const res = e.content.itemContent.tweet_results.result;
    const t = res.tweet || res;
    const a = document.createElement('article');
    a.dataset.id = t.rest_id;
    a.innerHTML = '<div data-testid="tweetText"></div><button data-testid="bookmark">Bookmark</button><button data-testid="removeBookmark">Remove</button>';
    a.querySelector('[data-testid=tweetText]').textContent = (t.legacy && t.legacy.full_text) || '';
    a.querySelector('[data-testid=bookmark]').onclick = () => act('CreateBookmark', t.rest_id);
    a.querySelector('[data-testid=removeBookmark]').onclick = () => act('DeleteBookmark', t.rest_id);
    document.getElementById('tl').append(a);
  }
  document.body.dataset.ready = '1';
})();
</script></body></html>`;

const LOGGED_OUT = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>X</title></head><body><main><h1>Happening now</h1><a data-testid="loginButton" href="/login" role="link">Sign in</a></main></body></html>`;

/** Self-signed certificate for x.com (Chrome runs with --ignore-certificate-errors). */
export function ensureCert(dir) {
  mkdirSync(dir, { recursive: true });
  const key = join(dir, 'x-sim.key');
  const cert = join(dir, 'x-sim.crt');
  if (!existsSync(key) || !existsSync(cert)) {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '30', '-subj', '/CN=x.com', '-addext', 'subjectAltName=DNS:x.com,DNS:twitter.com'], { stdio: 'ignore' });
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

export function startSim(port, certDir, opts) {
  const sim = createSim(opts);
  const server = createServer(ensureCert(certDir), sim.handler);
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ ...sim, server, close: () => new Promise((r) => server.close(() => r())) })));
}
