/**
 * Shelf — every resource inside saved posts, unbundled on-device.
 *
 * Pure, synchronous and network-free:
 *  1. canonicalize each URL (tracking junk stripped, hosts normalized),
 *  2. classify it into a resource type with a stable identity
 *     (GitHub owner/repo, arXiv id, YouTube video id, ASIN, DOI, …),
 *  3. dedupe and aggregate across posts (who shared it, how often, when).
 *
 * Results are cached per URL string and per bookmark object, so rebuilding
 * the shelf after a library change only re-reads the posts that changed.
 */
import type { Author, Bookmark } from './types';

export type ResourceType = 'repo' | 'paper' | 'video' | 'article' | 'tool' | 'book' | 'course' | 'podcast' | 'docs' | 'dataset' | 'job' | 'other';

/** Display order. */
export const RESOURCE_TYPES: readonly ResourceType[] = ['repo', 'paper', 'video', 'article', 'tool', 'book', 'course', 'podcast', 'docs', 'dataset', 'job', 'other'];

export interface ResourceTypeMeta {
  /** Plural label ("Repos"). */
  label: string;
  /** Singular label ("Repo"). */
  one: string;
  /** URL slug for `#/shelf/<slug>`. */
  slug: string;
  /** Identity hue (mixed with theme tokens in the UI). */
  color: string;
}

export const RESOURCE_META: Record<ResourceType, ResourceTypeMeta> = {
  repo: { label: 'Repos', one: 'Repo', slug: 'repos', color: '#6366f1' },
  paper: { label: 'Papers', one: 'Paper', slug: 'papers', color: '#eab308' },
  video: { label: 'Videos', one: 'Video', slug: 'videos', color: '#ef4444' },
  article: { label: 'Articles', one: 'Article', slug: 'articles', color: '#3b82f6' },
  tool: { label: 'Tools', one: 'Tool', slug: 'tools', color: '#14b8a6' },
  book: { label: 'Books', one: 'Book', slug: 'books', color: '#f97316' },
  course: { label: 'Courses', one: 'Course', slug: 'courses', color: '#22c55e' },
  podcast: { label: 'Podcasts', one: 'Podcast', slug: 'podcasts', color: '#a855f7' },
  docs: { label: 'Docs', one: 'Docs', slug: 'docs', color: '#06b6d4' },
  dataset: { label: 'Data & models', one: 'Dataset', slug: 'data', color: '#ec4899' },
  job: { label: 'Jobs', one: 'Job', slug: 'jobs', color: '#84cc16' },
  other: { label: 'Other', one: 'Link', slug: 'other', color: '#94a3b8' },
};

const TYPE_ALIASES: Record<string, ResourceType> = {
  repo: 'repo', repos: 'repo', code: 'repo', github: 'repo', git: 'repo', package: 'repo', packages: 'repo',
  paper: 'paper', papers: 'paper', research: 'paper', arxiv: 'paper', pdf: 'paper',
  video: 'video', videos: 'video', youtube: 'video', talk: 'video', talks: 'video',
  article: 'article', articles: 'article', blog: 'article', blogs: 'article', newsletter: 'article', newsletters: 'article', post: 'article', posts: 'article', news: 'article',
  tool: 'tool', tools: 'tool', product: 'tool', products: 'tool', app: 'tool', apps: 'tool',
  book: 'book', books: 'book',
  course: 'course', courses: 'course', learn: 'course', learning: 'course',
  podcast: 'podcast', podcasts: 'podcast', episode: 'podcast', episodes: 'podcast', audio: 'podcast',
  doc: 'docs', docs: 'docs', documentation: 'docs', reference: 'docs',
  data: 'dataset', dataset: 'dataset', datasets: 'dataset', model: 'dataset', models: 'dataset',
  job: 'job', jobs: 'job', hiring: 'job', careers: 'job', career: 'job',
  other: 'other', links: 'other', link: 'other', misc: 'other',
};

/** `#/shelf/<slug>` → type (accepts slugs, ids and friendly aliases). */
export function typeFromSlug(slug: string | undefined | null): ResourceType | null {
  if (!slug) return null;
  return TYPE_ALIASES[slug.toLowerCase().trim()] ?? null;
}

/** A classified URL: what it is and its dedupe identity. */
export interface Classified {
  type: ResourceType;
  /** Finer kind, e.g. 'github', 'arxiv', 'youtube', 'short', 'hf-model'. */
  subtype: string;
  /** Dedupe identity, stable across URL variants. */
  key: string;
  /** Canonical URL to open. */
  url: string;
  /** Display domain. */
  domain: string;
  /** Primary identifier (owner/repo, arXiv id, video id, ASIN, …). */
  id?: string;
  /** Title derived from the URL alone (used when no preview card exists). */
  title?: string;
}

export interface Sharer {
  handle: string;
  name: string;
  avatar: string;
  count: number;
  /** Last time a post of theirs with this resource was saved. */
  last: number;
}

export interface Resource extends Classified {
  /** Human kind label for the card ("Repo", "Model", "Playlist"…). */
  kind: string;
  title: string;
  description?: string;
  image?: string;
  /** Saved posts referencing it, most recently saved first. */
  postIds: string[];
  count: number;
  firstSavedAt: number;
  lastSavedAt: number;
  /** Unique sharers, most frequent first. */
  sharers: Sharer[];
}

export interface Shelf {
  resources: Resource[];
  byKey: Map<string, Resource>;
  counts: Record<ResourceType, number>;
  total: number;
  /** Posts that contain at least one resource. */
  posts: number;
  /** Build time in ms (for perf reporting). */
  ms: number;
}

/* ------------------------------------------------------------------ */
/* URL canonicalization                                                */
/* ------------------------------------------------------------------ */

interface Norm {
  protocol: string;
  host: string;
  reg: string;
  port: string;
  /** '' for the root, otherwise '/a/b' without a trailing slash. */
  path: string;
  segs: string[];
  params: URLSearchParams;
  qs: string;
  hash: string;
  href: string;
}

const STRIP_KEYS = new Set([
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'twclid', 'ttclid', 'yclid', 'li_fat_id', 'epik', 'irclickid',
  'igshid', 'igsh', 'si', 'ref', 'ref_src', 'ref_url', 'referrer', 'referer', 'feature', 'mc_cid', 'mc_eid', '_ga', '_gl', 'mkt_tok',
  'trk', 'trkcampaign', 'trackingid', 'refid', 'lipi', 'rcm', 'spm', 'scm', 'share_id', 'shareid', 'sharesource', 'share_source', 'share_medium',
  'sr_share', 'rdt', 'smid', 'smtyp', 'ocid', 'icid', 'cmpid', 'cmp', 'ncid', 's_kwcid', 'ef_id', 'wt.mc_id', 'wt_mc', 'cid_source',
  'ved', 'usg', 'ei', 'pp', 'ab_channel', 'embeds_referring_euri', 'embeds_euri', 'embeds_referring_origin', 'source_ve_path', 'nd',
  'is_from_webapp', 'sender_device', 'web_id', '_r', '_t', 'is_copy_url', 'triedredirect', 'showwelcome', 'publication_id', 'post_id', 'isfreemail',
  'utm', 'gi', 'sk_campaign', 'xmt', 'xtor', 'guccounter', 'guce_referrer', 'guce_referrer_sig', 'currency_switch', 'redirect_log_mongo_id', 'redirect_mongo_id',
  'sb_referer_host', 'campaign_id', 'tracking', 'tracking_id', 'hsctatracking', '__s', 'vero_id', 'vero_conv', 'oly_enc_id', 'oly_anon_id', 'rb_clickid', 'ck_subscriber_id',
]);
const STRIP_PREFIXES = ['utm_', 'pd_rd_', 'pf_rd_', 'hsa_', 'mc_', 'oly_', 'vero_', '_hs', 'mtm_', 'pk_', 'matomo_', 'piwik_', 'stm_', 'ns_', 'at_', 'ga_', 'trk_', 'sc_', 'itm_', 'int_'];
/** Keys that are only tracking when their value names a channel (?source=twitter). */
const CHANNEL_KEYS = new Set(['source', 'src', 'from', 'via', 'origin', 'medium', 'channel', 'campaign', 'social']);
const CHANNEL_VALUE = /^(twitter|tweet|tw|x|x\.com|t\.co|social|share|shared|sharing|rss|feed|email|newsletter|post_page.*|copy_?link|app|ios|android|web|mobile|linkedin|facebook|fb|ig|instagram|whatsapp|telegram|reddit|hn|hackernews|producthunt|direct|organic|bookmarks?|follow)$/i;
const TIMESTAMP = /^(?=\S)(?:\d+(?:\.\d+)?s?|(?:\d+h)?(?:\d+m)?(?:\d+s)?)$/i;

/** Hosts whose query strings carry nothing but tracking (or a known allow-list). */
const KEEP_ONLY: Record<string, readonly string[]> = {
  'linkedin.com': ['currentjobid'],
  'substack.com': [],
  'spotify.com': [],
  'medium.com': ['sk'],
  'instagram.com': [],
  'tiktok.com': [],
  'threads.net': [],
  'threads.com': [],
  'reddit.com': [],
  'producthunt.com': [],
  'youtube.com': ['v', 'list', 't'],
  'youtu.be': ['t', 'list'],
  'vimeo.com': [],
  'loom.com': ['t'],
  'goodreads.com': [],
  'coursera.org': [],
  'udemy.com': ['couponcode'],
  'nature.com': [],
  'wellfound.com': [],
  'naukri.com': [],
};

const AMAZON_REG = /^amazon\.(?:com|ca|cn|in|de|fr|it|es|nl|se|pl|sg|ae|sa|eg|co\.uk|co\.jp|com\.au|com\.br|com\.mx|com\.tr|com\.be)$/;
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu', 'ne', 'or', 'go', 'gen', 'firm', 'ind', 'nic', 'res', 'ltd', 'plc']);

/** "news.bbc.co.uk" → "bbc.co.uk", "blog.example.com" → "example.com". */
export function registrable(host: string): string {
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const tld = parts[parts.length - 1]!;
  const sld = parts[parts.length - 2]!;
  if (tld.length === 2 && SECOND_LEVEL.has(sld)) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

function count(s: string, ch: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === ch) n++;
  return n;
}

/** Trim prose punctuation that clings to URLs ("see https://x.com/y)."). */
function cleanRaw(raw: string): string {
  let s = raw.trim().replace(/^[<("'“‘[]+/, '');
  for (let i = 0; i < 10; i++) {
    const c = s.charAt(s.length - 1);
    if (/[.,;:!?'"»…”’>*]/.test(c)) s = s.slice(0, -1);
    else if (c === ')' && count(s, '(') < count(s, ')')) s = s.slice(0, -1);
    else if (c === ']' && count(s, '[') < count(s, ']')) s = s.slice(0, -1);
    else if (c === '}' && count(s, '{') < count(s, '}')) s = s.slice(0, -1);
    else break;
  }
  return s;
}

function normHost(h: string): string {
  let host = h.toLowerCase().replace(/\.$/, '');
  const wiki = /^([a-z-]+)\.m\.(wiki[a-z]+\.org)$/.exec(host);
  if (wiki) return `${wiki[1]}.${wiki[2]}`;
  const m = /^(?:www\d{0,3}|m|mobile|amp)\.(.+)$/.exec(host);
  if (m && m[1]!.includes('.')) host = m[1]!;
  return host;
}

function keepListFor(reg: string, host: string): readonly string[] | undefined {
  return KEEP_ONLY[reg] ?? (AMAZON_REG.test(reg) ? [] : host === 'play.google.com' ? ['id'] : host === 'podcasts.apple.com' || host === 'apps.apple.com' ? ['i'] : undefined);
}

function isTracking(key: string, value: string, keep: readonly string[] | undefined): boolean {
  const k = key.toLowerCase();
  if (keep) return !keep.includes(k) || (k === 't' && !TIMESTAMP.test(value));
  if (STRIP_KEYS.has(k)) return true;
  for (const p of STRIP_PREFIXES) if (k.startsWith(p)) return true;
  if (k === 't') return !value || !TIMESTAMP.test(value);
  if (k === 's') return /^\d{1,3}$/.test(value);
  if (CHANNEL_KEYS.has(k)) return CHANNEL_VALUE.test(value);
  return false;
}

/** Redirect wrappers whose target is in a query parameter. */
function unwrapTarget(host: string, path: string, params: URLSearchParams): string | null {
  if ((host === 'google.com' || /^google\.[a-z.]+$/.test(host)) && path === '/url') return params.get('q') ?? params.get('url');
  if ((host === 'l.facebook.com' || host === 'lm.facebook.com' || host === 'l.instagram.com') && path === '/l.php') return params.get('u');
  if (host === 'youtube.com' && path === '/redirect') return params.get('q');
  if (host === 'slack-redir.net' && path === '/link') return params.get('url');
  if (host === 't.umblr.com' && path === '/redirect') return params.get('z');
  return null;
}

function normalize(raw: string, depth = 0): Norm | null {
  if (!raw) return null;
  let s = cleanRaw(raw);
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    if (/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#]|$)/i.test(s)) s = 'https://' + s;
    else return null;
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const rawHost = u.hostname;
  if (!rawHost.includes('.') || rawHost.startsWith('[') || /^\d+(?:\.\d+){3}$/.test(rawHost)) return null;
  const host = normHost(rawHost);
  const reg = registrable(host);

  let path = u.pathname.replace(/\/{2,}/g, '/').replace(/;jsessionid=[^/]*/i, '').replace(/\/+$/, '');
  let segs = path.split('/').filter(Boolean);
  if (segs.length >= 2 && segs[segs.length - 1]!.toLowerCase() === 'amp') {
    segs = segs.slice(0, -1);
    path = '/' + segs.join('/');
  }

  if (depth === 0) {
    const target = unwrapTarget(host, path, u.searchParams);
    if (target) return normalize(target, 1);
  }

  const params = new URLSearchParams();
  if (u.search) {
    const keep = keepListFor(reg, host);
    for (const [k, v] of u.searchParams) if (!isTracking(k, v, keep)) params.append(k, v);
    params.sort();
  }
  const qs = params.toString();
  const hash = /^#!?\//.test(u.hash) ? u.hash : '';
  const port = u.port;
  const href = `${u.protocol}//${host}${port ? ':' + port : ''}${path}${qs ? '?' + qs : ''}${hash}`;
  return { protocol: u.protocol, host, reg, port, path, segs, params, qs, hash, href };
}

/**
 * Canonical form of a URL: lowercase host without www./m., no tracking
 * parameters (utm_*, fbclid, si, ref, …), sorted meaningful parameters, no
 * trailing slash, no fragment. Returns null for non-web or malformed URLs.
 */
export function canonicalizeUrl(raw: string): string | null {
  return normalize(raw)?.href ?? null;
}

/* ------------------------------------------------------------------ */
/* Classification                                                      */
/* ------------------------------------------------------------------ */

type Handler = (n: Norm) => Classified | null | undefined;

const lseg = (n: Norm, i: number) => (n.segs[i] ?? '').toLowerCase();
const seg = (n: Norm, i: number) => n.segs[i] ?? '';
const pathKey = (n: Norm) => n.host + (n.port ? ':' + n.port : '') + n.path + (n.qs ? '?' + n.qs : '') + n.hash;
const hostIs = (n: Norm, ...domains: string[]) => domains.some((d) => n.host === d || n.host.endsWith('.' + d));

function mk(n: Norm, type: ResourceType, subtype: string, key: string, o: { url?: string; id?: string; title?: string; domain?: string } = {}): Classified {
  const c: Classified = { type, subtype, key, url: o.url ?? n.href, domain: o.domain ?? n.host };
  if (o.id !== undefined) c.id = o.id;
  if (o.title !== undefined) c.title = o.title;
  return c;
}

function dec(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const EXT_RE = /\.(?:html?|php|aspx?|jsp|md|mdx|pdf)$/i;
const SKIP_SEG = /^(?:index|amp|p|post|posts|blog|blogs|article|articles|news|story|stories|en|en-us|en-gb|en-in|comments|dp|watch|read|view|show|details|item|items|share|s|a|t|c|u|r|preview)$/i;

/** "how-we-scaled_postgres-3f2a1b9c8d7e" → "How we scaled postgres". */
export function prettySlug(raw: string): string | undefined {
  let s = dec(raw).replace(EXT_RE, '');
  // Medium-style trailing post hash, numeric ids and Goodreads "12345." prefixes.
  s = s.replace(/[-_]([0-9a-f]{8,16})$/i, (m, h: string) => (/\d/.test(h) && /[a-f]/i.test(h) ? '' : m));
  s = s.replace(/[-_]\d{5,}$/, '').replace(/^\d{4,}[-_.]/, '');
  s = s.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || !/\p{L}/u.test(s)) return undefined;
  // Opaque ids ("aB3dE9xYz1", "PLx0sYbCqOb8") are not titles.
  if (!s.includes(' ') && s.length >= 8 && /\d/.test(s) && /[a-z]/i.test(s)) return undefined;
  if (!s.includes(' ') && s.length >= 16 && /[A-Z]/.test(s.slice(1)) && /[a-z]/.test(s)) return undefined;
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s.length > 140 ? s.slice(0, 137).trimEnd() + '…' : s;
}

function slugTitle(segs: string[]): string | undefined {
  for (let i = segs.length - 1; i >= 0; i--) {
    const sgm = segs[i]!;
    if (SKIP_SEG.test(sgm) || /^\d+$/.test(sgm) || /^[a-z]{2}(?:-[a-z]{2})?$/i.test(sgm)) continue;
    const t = prettySlug(sgm);
    if (t) return t;
  }
  return undefined;
}

/** "linear.app" → "Linear". */
export function brandOf(host: string): string {
  const label = registrable(host).split('.')[0] ?? host;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/* ---- code ---- */

const GH_RESERVED = new Set(
  'about account apps blog codespaces collections contact copilot customer-stories dashboard enterprise events explore features github-copilot home issues join login logout marketplace mobile new notifications orgs organizations password_reset premium-support pricing pulls readme resources search security sessions settings signup site solutions sponsors stars team topics trending users watching why-github edu education git-guides nonprofit open-source achievements'.split(' '),
);
const OWNER_RE = /^~?[a-z0-9](?:[a-z0-9-]{0,38})$/i;
const REPO_RE = /^[\w.-]{1,100}$/;

function ownerRepo(n: Norm, owner: string, repoRaw: string, subtype: string, base: string, domain: string): Classified | null {
  const repo = repoRaw.replace(/\.git$/i, '');
  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo) || repo === '.' || repo === '..') return null;
  const id = `${owner}/${repo}`;
  return mk(n, 'repo', subtype, `${subtype}:${id.toLowerCase()}`, { url: `${base}/${id}`, id, title: id, domain });
}

const github: Handler = (n) => {
  if (n.host === 'gist.github.com') {
    const idIdx = n.segs.findIndex((s) => /^[0-9a-f]{16,40}$/i.test(s));
    if (idIdx < 0) return null;
    const id = n.segs[idIdx]!.toLowerCase();
    const user = idIdx > 0 ? n.segs[0] : undefined;
    return mk(n, 'repo', 'gist', `gist:${id}`, { url: `https://gist.github.com/${user ? user + '/' : ''}${id}`, id, title: user ? `Gist by ${user}` : 'GitHub Gist', domain: 'gist.github.com' });
  }
  if (n.host === 'codeload.github.com') return ownerRepo(n, seg(n, 0), seg(n, 1), 'github', 'https://github.com', 'github.com');
  if (n.host === 'api.github.com') return lseg(n, 0) === 'repos' ? ownerRepo(n, seg(n, 1), seg(n, 2), 'github', 'https://github.com', 'github.com') : null;
  if (n.host !== 'github.com') return undefined;
  const owner = seg(n, 0);
  if (!owner || GH_RESERVED.has(owner.toLowerCase()) || !n.segs[1]) return null;
  return ownerRepo(n, owner, seg(n, 1), 'github', 'https://github.com', 'github.com');
};

const GL_RESERVED = new Set(['explore', 'users', 'help', 'dashboard', 'groups', 'search', 'projects', 'admin', '-', 'api', 'snippets', 'users']);
const gitlab: Handler = (n) => {
  if (n.host !== 'gitlab.com') return undefined;
  const dash = n.segs.indexOf('-');
  const parts = (dash >= 0 ? n.segs.slice(0, dash) : n.segs.slice(0, 2)).slice(0, 5);
  if (parts.length < 2 || GL_RESERVED.has(parts[0]!.toLowerCase())) return null;
  const id = parts.join('/').replace(/\.git$/i, '');
  return mk(n, 'repo', 'gitlab', `gitlab:${id.toLowerCase()}`, { url: `https://gitlab.com/${id}`, id, title: id });
};

function simpleOwnerRepo(subtype: string, base: string, domain: string, reserved: string[] = []): Handler {
  const r = new Set(reserved);
  return (n) => {
    if (n.host !== domain) return undefined;
    const owner = seg(n, 0);
    if (!owner || r.has(owner.toLowerCase()) || !n.segs[1]) return null;
    return ownerRepo(n, owner, seg(n, 1), subtype, base, domain);
  };
}

function pkg(subtype: string, prefix: string[], scoped = false, lower = false): Handler {
  return (n) => {
    const p = prefix.length;
    for (let i = 0; i < p; i++) if (lseg(n, i) !== prefix[i]) return undefined;
    let name = dec(seg(n, p));
    if (!name) return undefined;
    if (scoped && name.startsWith('@') && n.segs[p + 1]) name = `${name}/${dec(seg(n, p + 1))}`;
    const id = lower ? name.toLowerCase() : name;
    const keyId = subtype === 'pypi' ? id.toLowerCase().replace(/[-_.]+/g, '-') : id.toLowerCase();
    const url = `${n.protocol}//${n.host}/${prefix.join('/')}${prefix.length ? '/' : ''}${name}`;
    return mk(n, 'repo', subtype, `${subtype}:${keyId}`, { url, id, title: name });
  };
}

/* ---- papers ---- */

const ARXIV_NEW = /^(\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?$/i;
const ARXIV_OLD = /^([a-z-]+(?:\.[a-z]{2})?\/\d{7})(?:v\d+)?(?:\.pdf)?$/i;

export function arxivId(rest: string): string | undefined {
  const r = rest.replace(/\/+$/, '');
  return ARXIV_NEW.exec(r)?.[1] ?? ARXIV_OLD.exec(r)?.[1]?.toLowerCase();
}

function arxivRes(n: Norm, id: string): Classified {
  return mk(n, 'paper', 'arxiv', `arxiv:${id}`, { url: `https://arxiv.org/abs/${id}`, id, title: `arXiv ${id}`, domain: 'arxiv.org' });
}

const arxiv: Handler = (n) => {
  const kind = lseg(n, 0);
  if (!['abs', 'pdf', 'html', 'format', 'ps', 'src', 'paper'].includes(kind)) return null;
  const id = arxivId(n.segs.slice(1).join('/'));
  return id ? arxivRes(n, id) : null;
};

const DOI_RE = /(?:^|\/)(10\.\d{4,9}\/[^?#\s]+)/;

export function doiFromPath(path: string): string | undefined {
  const m = DOI_RE.exec(dec(path));
  if (!m) return undefined;
  let d = m[1]!;
  for (let i = 0; i < 2; i++) d = d.replace(/\/(?:full|abstract|pdf|epdf|pdfft|summary|meta|references|fulltext|html|epub|suppl|figures|citedby)$/i, '').replace(/\.(?:full\.pdf|full|pdf|html|abstract)$/i, '');
  d = d.toLowerCase();
  if (d.startsWith('10.1101/')) d = d.replace(/v\d+$/, ''); // bioRxiv / medRxiv versions
  return d.length > 8 ? d : undefined;
}

function doiRes(n: Norm, doi: string, url?: string): Classified {
  return mk(n, 'paper', 'doi', `doi:${doi}`, { url: url ?? n.href, id: doi, title: `DOI ${doi}` });
}

function paperAt(subtype: string, keyOf: (n: Norm) => string | undefined, title?: (n: Norm) => string | undefined): Handler {
  return (n) => {
    const k = keyOf(n);
    if (!k) return null;
    return mk(n, 'paper', subtype, `${subtype}:${k}`, { id: k, title: title?.(n) ?? slugTitle(n.segs) });
  };
}

/* ---- isbn ---- */

function isbn13Valid(s: string): boolean {
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(s[i]) * (i % 2 ? 3 : 1);
  return sum % 10 === 0;
}

function isbn10Valid(s: string): boolean {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const c = s[i]!;
    const v = c === 'X' || c === 'x' ? 10 : Number(c);
    if (Number.isNaN(v) || (v === 10 && i !== 9)) return false;
    sum += v * (10 - i);
  }
  return sum % 11 === 0;
}

export function findIsbn(text: string): string | undefined {
  const re = /(?:^|[^\d])(97[89]\d{10})(?!\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) if (isbn13Valid(m[1]!)) return m[1];
  return undefined;
}

/* ---- video ---- */

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

const youtube: Handler = (n) => {
  if (n.host === 'music.youtube.com') {
    const v = n.params.get('v') ?? n.params.get('list');
    return v ? mk(n, 'other', 'music', `ytmusic:${v}`, { id: v, title: 'YouTube Music' }) : null;
  }
  let id: string | undefined | null;
  let subtype = 'youtube';
  const first = lseg(n, 0);
  if (n.host === 'youtu.be') id = seg(n, 0);
  else if (first === 'watch') id = n.params.get('v');
  else if (['shorts', 'live', 'embed', 'v', 'e'].includes(first)) {
    id = seg(n, 1);
    if (first === 'shorts') subtype = 'yt-short';
  } else if (first === 'playlist') {
    const list = n.params.get('list');
    if (!list) return null;
    return mk(n, 'course', 'youtube-playlist', `ytlist:${list}`, { url: `https://youtube.com/playlist?list=${encodeURIComponent(list)}`, id: list, title: 'YouTube playlist', domain: 'youtube.com' });
  } else if (first.startsWith('@') || ((first === 'c' || first === 'channel' || first === 'user') && n.segs[1])) {
    const handle = first.startsWith('@') ? dec(seg(n, 0)) : dec(seg(n, 1));
    const p = first.startsWith('@') ? `/${seg(n, 0)}` : `/${seg(n, 0)}/${seg(n, 1)}`;
    return mk(n, 'video', 'channel', `ytchannel:${p.toLowerCase()}`, { url: `https://youtube.com${p}`, id: handle, title: handle.startsWith('@') ? handle : handle, domain: 'youtube.com' });
  } else return null;
  if (!id || !YT_ID.test(id)) return null;
  return mk(n, 'video', subtype, `youtube:${id}`, { url: `https://youtube.com/watch?v=${id}`, id, title: subtype === 'yt-short' ? 'YouTube Short' : 'YouTube video', domain: 'youtube.com' });
};

function videoAt(subtype: string, idOf: (n: Norm) => string | undefined | null, url?: (id: string, n: Norm) => string): Handler {
  return (n) => {
    const id = idOf(n);
    if (!id) return null;
    return mk(n, 'video', subtype, `${subtype}:${id.toLowerCase()}`, { url: url?.(id, n), id, title: slugTitle(n.segs) });
  };
}

const vimeo: Handler = (n) => {
  if (n.host === 'player.vimeo.com') {
    const id = lseg(n, 0) === 'video' ? seg(n, 1) : '';
    return /^\d+$/.test(id) ? mk(n, 'video', 'vimeo', `vimeo:${id}`, { url: `https://vimeo.com/${id}`, id, title: 'Vimeo video', domain: 'vimeo.com' }) : null;
  }
  const num = n.segs.find((s) => /^\d{5,}$/.test(s));
  if (num) return mk(n, 'video', 'vimeo', `vimeo:${num}`, { url: `https://vimeo.com/${num}`, id: num, title: 'Vimeo video', domain: 'vimeo.com' });
  if (lseg(n, 0) === 'showcase' && n.segs[1]) return mk(n, 'video', 'vimeo', `vimeo-showcase:${seg(n, 1)}`, { id: seg(n, 1), title: 'Vimeo showcase' });
  return null;
};

/* ---- podcasts ---- */

const spotify: Handler = (n) => {
  if (n.host === 'spotify.link') return mk(n, 'other', 'spotify', pathKey(n), { title: 'Spotify link' });
  if (hostIs(n, 'podcasters.spotify.com', 'creators.spotify.com', 'anchor.fm')) return undefined;
  if (n.host !== 'open.spotify.com') return undefined;
  const segs = n.segs.filter((s) => !/^(?:intl-[a-z-]+|embed|embed-podcast)$/i.test(s));
  const kind = (segs[0] ?? '').toLowerCase();
  const id = segs[1];
  if (!id) return null;
  if (kind === 'episode' || kind === 'show') return mk(n, 'podcast', 'spotify', `spotify:${kind}:${id}`, { url: `https://open.spotify.com/${kind}/${id}`, id, title: kind === 'show' ? 'Podcast on Spotify' : 'Spotify episode', domain: 'open.spotify.com' });
  if (['track', 'album', 'playlist', 'artist'].includes(kind)) return mk(n, 'other', 'music', `spotify:${kind}:${id}`, { url: `https://open.spotify.com/${kind}/${id}`, id, title: 'Spotify', domain: 'open.spotify.com' });
  return null;
};

const apple: Handler = (n) => {
  if (n.host === 'podcasts.apple.com' || n.host === 'itunes.apple.com') {
    const showIdx = n.segs.findIndex((s) => /^id\d+$/.test(s));
    if (showIdx < 0) return null;
    const show = n.segs[showIdx]!.slice(2);
    const ep = n.params.get('i');
    const slug = showIdx > 0 && lseg(n, showIdx - 1) !== 'podcast' ? seg(n, showIdx - 1) : undefined;
    const cc = /^[a-z]{2}$/.test(lseg(n, 0)) ? lseg(n, 0) + '/' : '';
    return mk(n, 'podcast', 'apple-podcasts', `apple-podcast:${show}${ep ? ':' + ep : ''}`, {
      url: `https://podcasts.apple.com/${cc}podcast/${slug ? slug + '/' : ''}id${show}${ep ? `?i=${ep}` : ''}`,
      id: ep ? `${show}:${ep}` : show,
      title: (slug && prettySlug(slug)) ?? 'Apple Podcasts',
      domain: 'podcasts.apple.com',
    });
  }
  if (n.host === 'apps.apple.com') {
    const idSeg = n.segs.find((s) => /^id\d+$/.test(s));
    if (!idSeg) return null;
    const appIdx = n.segs.findIndex((s) => s.toLowerCase() === 'app');
    const slug = appIdx >= 0 && n.segs[appIdx + 1] !== idSeg ? n.segs[appIdx + 1] : undefined;
    return mk(n, 'tool', 'app-store', `appstore:${idSeg.slice(2)}`, { url: `https://apps.apple.com/app/${slug ? slug + '/' : ''}${idSeg}`, id: idSeg.slice(2), title: (slug && prettySlug(slug)) ?? 'iOS app' });
  }
  if (n.host === 'music.apple.com') return mk(n, 'other', 'music', pathKey(n), { title: 'Apple Music' });
  if (n.host === 'books.apple.com') return mk(n, 'book', 'apple-books', pathKey(n), { title: slugTitle(n.segs) ?? 'Apple Books' });
  if (n.host === 'developer.apple.com') return mk(n, 'docs', 'apple', pathKey(n), { title: slugTitle(n.segs) });
  return undefined;
};

/* ---- google ---- */

const google: Handler = (n) => {
  const h = n.host;
  if (h === 'play.google.com') {
    const id = n.params.get('id');
    if (lseg(n, 0) === 'store' && lseg(n, 1) === 'apps' && id) return mk(n, 'tool', 'play-store', `play:${id.toLowerCase()}`, { url: `https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}`, id, title: id });
    if (lseg(n, 0) === 'store' && lseg(n, 1) === 'books' && id) return mk(n, 'book', 'google-books', `gbooks:${id}`, { url: `https://play.google.com/store/books/details?id=${encodeURIComponent(id)}`, id, title: 'Google Play Books' });
    return null;
  }
  if (h === 'chromewebstore.google.com' || (h === 'chrome.google.com' && lseg(n, 0) === 'webstore')) {
    const id = n.segs.find((s) => /^[a-p]{32}$/.test(s));
    if (!id) return null;
    const di = n.segs.findIndex((s) => s.toLowerCase() === 'detail');
    const slug = di >= 0 && n.segs[di + 1] !== id ? n.segs[di + 1] : undefined;
    return mk(n, 'tool', 'chrome-extension', `cws:${id}`, { url: `https://chromewebstore.google.com/detail/${slug ? slug + '/' : ''}${id}`, id, title: (slug && prettySlug(slug)) ?? 'Chrome extension', domain: 'chromewebstore.google.com' });
  }
  if (h === 'books.google.com' || /^books\.google\./.test(h) || (lseg(n, 0) === 'books' && /^google\./.test(h))) {
    const id = n.params.get('id') ?? (lseg(n, 1) === 'edition' ? seg(n, 3) : undefined);
    return id ? mk(n, 'book', 'google-books', `gbooks:${id}`, { url: `https://books.google.com/books?id=${encodeURIComponent(id)}`, id, title: lseg(n, 1) === 'edition' ? prettySlug(seg(n, 2)) : 'Google Books', domain: 'books.google.com' }) : null;
  }
  if (h === 'docs.google.com') {
    const kind = lseg(n, 0);
    const di = n.segs.findIndex((s) => s === 'd' || s === 'e');
    const id = di >= 0 ? n.segs[di + 1] : undefined;
    const sub = kind === 'spreadsheets' ? 'google-sheet' : kind === 'presentation' ? 'google-slides' : kind === 'forms' ? 'google-form' : 'google-doc';
    const label = kind === 'spreadsheets' ? 'Google Sheet' : kind === 'presentation' ? 'Google Slides' : kind === 'forms' ? 'Google Form' : 'Google Doc';
    if (!id) return null;
    return mk(n, 'other', sub, `gdocs:${id}`, { url: `https://docs.google.com/${kind}/d/${id}`, id, title: label });
  }
  if (h === 'drive.google.com') {
    const id = n.params.get('id') ?? (lseg(n, 0) === 'file' || lseg(n, 0) === 'drive' ? n.segs.find((s, i) => i > 0 && s.length > 20) : undefined);
    return id ? mk(n, 'other', 'google-drive', `gdrive:${id}`, { id, title: 'Google Drive file' }) : null;
  }
  if (h === 'colab.research.google.com') return mk(n, 'repo', 'notebook', pathKey(n), { title: slugTitle(n.segs) ?? 'Colab notebook' });
  if (h === 'developers.google.com') return n.path.includes('crash-course') ? mk(n, 'course', 'google', pathKey(n), { title: slugTitle(n.segs) }) : mk(n, 'docs', 'google', pathKey(n), { title: slugTitle(n.segs) });
  if (h === 'scholar.google.com' || h === 'news.google.com' || h === 'accounts.google.com' || h === 'mail.google.com' || h === 'calendar.google.com') return null;
  if (h === 'maps.google.com' || h === 'maps.app.goo.gl' || (h === 'goo.gl' && lseg(n, 0) === 'maps') || lseg(n, 0) === 'maps') return mk(n, 'other', 'place', pathKey(n), { title: 'Place on Google Maps' });
  if (/^google\.[a-z.]+$/.test(h) && (lseg(n, 0) === 'search' || !n.segs.length)) return null;
  return undefined;
};

/* ---- articles ---- */

const MEDIUM_RESERVED = new Set(['tag', 'topic', 'topics', 'search', 'me', 'm', 'plans', 'membership', 'about', 'jobs-at-medium', 'policy', 'creators', 'signin', 'new-story', 'following']);
const medium: Handler = (n) => {
  if (MEDIUM_RESERVED.has(lseg(n, 0)) || (n.host === 'medium.com' && !n.segs.length)) return null;
  const last = n.segs[n.segs.length - 1] ?? '';
  const hex = /-([0-9a-f]{8,12})$/i.exec(last)?.[1] ?? (lseg(n, 0) === 'p' && /^[0-9a-f]{8,12}$/i.test(seg(n, 1)) ? seg(n, 1) : undefined);
  if (hex) return mk(n, 'article', 'medium', `medium:${hex.toLowerCase()}`, { url: n.href.split('?')[0]!, title: slugTitle(n.segs) });
  if (!n.segs.length || (n.segs.length === 1 && (n.host !== 'medium.com' || lseg(n, 0).startsWith('@')))) return mk(n, 'article', 'newsletter', pathKey(n), { title: n.host !== 'medium.com' ? n.host.split('.')[0] : dec(seg(n, 0)) });
  return mk(n, 'article', 'medium', pathKey(n), { title: slugTitle(n.segs) });
};

const substack: Handler = (n) => {
  if (n.host === 'substack.com') {
    const first = lseg(n, 0);
    if (first === 'home' && lseg(n, 1) === 'post') {
      const id = /^p-(\d+)$/.exec(seg(n, 2))?.[1];
      return id ? mk(n, 'article', 'substack', `substack-post:${id}`, { id, title: 'Substack post' }) : null;
    }
    if (first.startsWith('@')) {
      if (n.segs[1]?.startsWith('p-')) return mk(n, 'article', 'substack', `substack-post:${n.segs[1].slice(2)}`, { title: 'Substack post' });
      if (n.segs.length === 1) return mk(n, 'article', 'newsletter', pathKey(n), { title: dec(seg(n, 0)) });
      return null;
    }
    return first === 'inbox' || first === 'notes' || first === 'profile' || first === 'sign-in' || !first ? null : undefined;
  }
  // <publication>.substack.com
  const pub = n.host.split('.')[0]!;
  const first = lseg(n, 0);
  if (first === 'p' && n.segs[1]) {
    return mk(n, 'article', 'substack', `substack:${n.host}/p/${seg(n, 1).toLowerCase()}`, { url: `https://${n.host}/p/${seg(n, 1)}`, title: prettySlug(seg(n, 1)) });
  }
  if (first === 'podcast') return mk(n, 'podcast', 'substack', pathKey(n), { title: prettySlug(pub) });
  if (!first || ['about', 'archive', 'subscribe', 'welcome', 'home'].includes(first)) return mk(n, 'article', 'newsletter', `newsletter:${n.host}`, { url: `https://${n.host}`, title: prettySlug(pub) ?? pub });
  if (first === 'note' || first === 'notes' || first === 'account' || first === 'action') return null;
  return undefined;
};

/* ---- jobs ---- */

const linkedin: Handler = (n) => {
  const first = lseg(n, 0);
  const jobId = n.params.get('currentJobId') ?? n.params.get('currentjobid');
  if (first === 'jobs' || (first === 'comm' && lseg(n, 1) === 'jobs')) {
    const viewIdx = n.segs.findIndex((s) => s.toLowerCase() === 'view');
    const fromView = viewIdx >= 0 ? /(\d{6,})$/.exec(seg(n, viewIdx + 1))?.[1] : undefined;
    const id = fromView ?? jobId ?? undefined;
    if (!id) return null;
    return mk(n, 'job', 'linkedin', `linkedin-job:${id}`, { url: `https://linkedin.com/jobs/view/${id}`, id, title: 'Job on LinkedIn', domain: 'linkedin.com' });
  }
  if (first === 'company' && lseg(n, 2) === 'jobs') return mk(n, 'job', 'linkedin', pathKey(n), { title: `${prettySlug(seg(n, 1)) ?? 'Company'} jobs` });
  if (first === 'pulse' && n.segs[1]) return mk(n, 'article', 'linkedin', pathKey(n), { title: prettySlug(seg(n, 1)) });
  if (first === 'newsletters' && n.segs[1]) return mk(n, 'article', 'newsletter', pathKey(n), { title: prettySlug(seg(n, 1)) });
  if (first === 'learning' && n.segs[1]) return mk(n, 'course', 'linkedin-learning', pathKey(n), { title: prettySlug(seg(n, 1)) });
  if (first === 'posts' || first === 'feed') return mk(n, 'other', 'discussion', pathKey(n), { title: 'LinkedIn post' });
  return null;
};

function jobBoard(subtype: string, extra?: (n: Norm) => Classified | null | undefined): Handler {
  return (n) => {
    const e = extra?.(n);
    if (e !== undefined) return e;
    if (!n.segs.length) return mk(n, 'job', 'board', pathKey(n), { title: brandOf(n.host) });
    const id = n.segs.map((s) => /(\d{5,})$/.exec(s)?.[1]).find(Boolean);
    return mk(n, 'job', subtype, id ? `${subtype}:${id}` : pathKey(n), { id, title: slugTitle(n.segs) });
  };
}

const atsBoard: Handler = (n) => {
  // boards.greenhouse.io/<company>/jobs/<id>, jobs.lever.co/<company>/<id>, jobs.ashbyhq.com/<company>/<id>
  const company = seg(n, 0);
  if (!company) return mk(n, 'job', 'board', pathKey(n), { title: brandOf(n.host) });
  return mk(n, 'job', 'ats', pathKey(n), { title: `${prettySlug(company) ?? company} — open role` });
};

/* ---- datasets & models ---- */

const HF_RESERVED = new Set(['models', 'settings', 'pricing', 'join', 'login', 'tasks', 'organizations', 'posts', 'chat', 'new', 'search', 'enterprise', 'welcome', 'inference-api', 'inference-endpoints', 'notifications', 'spaces', 'datasets', 'collections', 'papers', 'blog', 'docs', 'learn', 'api', 'terms-of-service', 'privacy', 'huggingface', 'changelog']);
const huggingface: Handler = (n) => {
  const first = lseg(n, 0);
  const a = seg(n, 1);
  const b = seg(n, 2);
  if (first === 'papers') {
    const id = arxivId(a);
    return id ? arxivRes(n, id) : null;
  }
  if (first === 'datasets' || first === 'spaces') {
    if (!a) return null;
    const id = b && !['viewer', 'tree', 'blob', 'resolve', 'discussions', 'discussion', 'commits', 'files'].includes(b.toLowerCase()) ? `${a}/${b}` : a;
    const sub = first === 'datasets' ? 'hf-dataset' : 'hf-space';
    return mk(n, 'dataset', sub, `hf:${first}/${id.toLowerCase()}`, { url: `https://huggingface.co/${first}/${id}`, id, title: id, domain: 'huggingface.co' });
  }
  if (first === 'collections' && a && b) return mk(n, 'dataset', 'hf-collection', `hf:collections/${a}/${b}`.toLowerCase(), { url: `https://huggingface.co/collections/${a}/${b}`, id: `${a}/${b}`, title: prettySlug(b.replace(/-[0-9a-f]{20,}$/i, '')) ?? `${a}/${b}`, domain: 'huggingface.co' });
  if (first === 'blog') return n.segs.length > 1 ? mk(n, 'article', 'huggingface', pathKey(n), { title: slugTitle(n.segs) }) : null;
  if (first === 'docs') return mk(n, 'docs', 'huggingface', pathKey(n), { title: slugTitle(n.segs) });
  if (first === 'learn') return mk(n, 'course', 'huggingface', pathKey(n), { title: slugTitle(n.segs) ?? 'Hugging Face course' });
  if (!first || HF_RESERVED.has(first) || !a) return null;
  const id = `${seg(n, 0)}/${a}`;
  return mk(n, 'dataset', 'hf-model', `hf:${id.toLowerCase()}`, { url: `https://huggingface.co/${id}`, id, title: id, domain: 'huggingface.co' });
};

const kaggle: Handler = (n) => {
  const first = lseg(n, 0);
  const a = seg(n, 1);
  const b = seg(n, 2);
  if (first === 'datasets' && a && b) return mk(n, 'dataset', 'kaggle-dataset', `kaggle:d/${a}/${b}`.toLowerCase(), { url: `https://kaggle.com/datasets/${a}/${b}`, id: `${a}/${b}`, title: prettySlug(b) ?? b });
  if ((first === 'competitions' || first === 'c') && a) return mk(n, 'dataset', 'kaggle-competition', `kaggle:c/${a}`.toLowerCase(), { url: `https://kaggle.com/competitions/${a}`, id: a, title: prettySlug(a) ?? a });
  if (first === 'code' && a && b) return mk(n, 'dataset', 'kaggle-notebook', `kaggle:code/${a}/${b}`.toLowerCase(), { url: `https://kaggle.com/code/${a}/${b}`, id: `${a}/${b}`, title: prettySlug(b) ?? b });
  if (first === 'models' && a && b) return mk(n, 'dataset', 'kaggle-model', `kaggle:m/${a}/${b}`.toLowerCase(), { url: `https://kaggle.com/models/${a}/${b}`, id: `${a}/${b}`, title: `${a}/${b}` });
  if (first === 'learn' && a) return mk(n, 'course', 'kaggle', pathKey(n), { title: prettySlug(a) });
  return null;
};

/* ---- books ---- */

const ASIN_RE = /^[A-Z0-9]{10}$/;

const amazon: Handler = (n) => {
  const segs = n.segs;
  let asin: string | undefined;
  let slug: string | undefined;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!.toLowerCase();
    const next = (segs[i + 1] ?? '').toUpperCase();
    if ((s === 'dp' || s === 'asin') && ASIN_RE.test(next)) {
      asin = next;
      if (i > 0 && !['gp', 'aw', 'd', '-'].includes(segs[i - 1]!.toLowerCase())) slug = segs[i - 1];
      break;
    }
    if (s === 'product' && (segs[i - 1] ?? '').toLowerCase() === 'gp' && ASIN_RE.test(next)) {
      asin = next;
      break;
    }
    if (s === 'd' && (segs[i - 1] ?? '').toLowerCase() === 'aw' && ASIN_RE.test(next)) {
      asin = next;
      break;
    }
  }
  if (!asin) {
    const fromQuery = n.params.get('asin');
    if (fromQuery && ASIN_RE.test(fromQuery.toUpperCase())) asin = fromQuery.toUpperCase();
  }
  if (!asin) return mk(n, 'other', 'amazon', pathKey(n), { title: slugTitle(segs) ?? 'Amazon' });
  return mk(n, 'book', 'amazon', `asin:${asin}`, { url: `https://${n.host}/dp/${asin}`, id: asin, title: (slug && prettySlug(slug)) ?? `Amazon ${asin}` });
};

const amazonShort: Handler = (n) => (n.segs.length ? mk(n, 'book', 'amazon-short', pathKey(n), { title: 'Amazon link' }) : null);

/* ---- registry ---- */

const H = new Map<string, Handler>();
const reg = (domains: string[], h: Handler) => {
  for (const d of domains) H.set(d, h);
};

const IGNORE = (): null => null;
/** Restrict a handler to exact hosts; other subdomains fall through to the generic rules. */
const only =
  (hosts: string[], h: Handler): Handler =>
  (n) =>
    hosts.includes(n.host) ? h(n) : undefined;
reg(['x.com', 'twitter.com'], (n) => {
  if (lseg(n, 0) === 'i' && lseg(n, 1) === 'article' && n.segs[2]) return mk(n, 'article', 'x-article', `x-article-url:${seg(n, 2)}`, { url: `https://x.com/i/article/${seg(n, 2)}`, id: seg(n, 2), title: 'Article on X', domain: 'x.com' });
  return null;
});
reg(['t.co', 'twimg.com', 'vxtwitter.com', 'fxtwitter.com', 'fixupx.com', 'fixvx.com', 'twittpr.com', 'linktr.ee', 'bio.link', 'beacons.ai', 'calendly.com', 'cal.com', 'wa.me', 'whatsapp.com', 't.me', 'telegram.me', 'discord.gg', 'discord.com', 'bing.com', 'duckduckgo.com', 'tinder.com', 'bsky.social'], IGNORE);

reg(['github.com'], github);
reg(['githubusercontent.com'], (n) => (n.host === 'raw.githubusercontent.com' ? ownerRepo(n, seg(n, 0), seg(n, 1), 'github', 'https://github.com', 'github.com') : null));
reg(['gitlab.com'], gitlab);
reg(['codeberg.org'], simpleOwnerRepo('codeberg', 'https://codeberg.org', 'codeberg.org', ['explore', 'user', 'repo', 'org']));
reg(['bitbucket.org'], simpleOwnerRepo('bitbucket', 'https://bitbucket.org', 'bitbucket.org', ['product', 'account', 'dashboard']));
reg(['sr.ht'], simpleOwnerRepo('sourcehut', 'https://git.sr.ht', 'git.sr.ht'));
reg(['npmjs.com'], pkg('npm', ['package'], true));
reg(['npm.im'], (n) => (n.segs[0] ? mk(n, 'repo', 'npm', `npm:${dec(n.segs.join('/')).toLowerCase()}`, { url: `https://www.npmjs.com/package/${n.segs.join('/')}`, id: dec(n.segs.join('/')), title: dec(n.segs.join('/')), domain: 'npmjs.com' }) : null));
reg(['pypi.org'], pkg('pypi', ['project']));
reg(['crates.io'], pkg('crates', ['crates']));
reg(['rubygems.org'], pkg('package', ['gems']));
reg(['pub.dev'], pkg('package', ['packages']));
reg(['hex.pm'], pkg('package', ['packages']));
reg(['nuget.org'], pkg('package', ['packages']));
reg(['jsr.io'], pkg('package', [], true));
reg(['pkg.go.dev'], (n) => (n.segs.length ? mk(n, 'repo', 'go', `go:${n.path.slice(1).toLowerCase()}`, { id: n.path.slice(1), title: n.path.slice(1) }) : null));
reg(['packagist.org'], (n) => (lseg(n, 0) === 'packages' && n.segs[2] ? mk(n, 'repo', 'package', `packagist:${seg(n, 1)}/${seg(n, 2)}`.toLowerCase(), { title: `${seg(n, 1)}/${seg(n, 2)}` }) : null));
reg(['codepen.io'], (n) => (n.segs[1] && ['pen', 'full', 'details', 'embed'].includes(lseg(n, 1)) && n.segs[2] ? mk(n, 'repo', 'sandbox', `codepen:${seg(n, 2)}`, { url: `https://codepen.io/${seg(n, 0)}/pen/${seg(n, 2)}`, id: seg(n, 2), title: `Pen by ${seg(n, 0)}` }) : undefined));
reg(['codesandbox.io', 'stackblitz.com', 'jsfiddle.net', 'val.town'], (n) => (n.segs.length >= 2 ? mk(n, 'repo', 'sandbox', pathKey(n), { title: slugTitle(n.segs) ?? 'Code sandbox' }) : undefined));
reg(['replit.com'], (n) => (lseg(n, 0).startsWith('@') && n.segs[1] ? mk(n, 'repo', 'sandbox', pathKey(n), { title: `${seg(n, 0)}/${seg(n, 1)}` }) : undefined));
reg(['observablehq.com'], (n) => (lseg(n, 0).startsWith('@') && n.segs[1] ? mk(n, 'repo', 'notebook', pathKey(n), { title: prettySlug(seg(n, 1)) }) : undefined));

reg(['arxiv.org', 'ar5iv.org', 'alphaxiv.org', 'arxiv-sanity-lite.com'], arxiv);
reg(['doi.org'], (n) => {
  const doi = doiFromPath(n.path);
  return doi ? doiRes(n, doi, `https://doi.org/${doi}`) : null;
});
reg(['nature.com'], (n) => (lseg(n, 0) === 'articles' && n.segs[1] ? doiRes(n, `10.1038/${lseg(n, 1)}`) : undefined));
reg(['openreview.net'], (n) => {
  const id = n.params.get('id');
  return id ? mk(n, 'paper', 'openreview', `openreview:${id}`, { url: `https://openreview.net/forum?id=${encodeURIComponent(id)}`, id, title: 'OpenReview paper' }) : null;
});
reg(['semanticscholar.org'], paperAt('semantic-scholar', (n) => n.segs.find((s) => /^[0-9a-f]{40}$/i.test(s))?.toLowerCase(), (n) => (n.segs.length > 2 ? prettySlug(seg(n, 1)) : undefined)));
reg(['paperswithcode.com'], (n) => {
  const first = lseg(n, 0);
  if (first === 'paper' && n.segs[1]) return mk(n, 'paper', 'papers-with-code', `pwc:${lseg(n, 1)}`, { id: seg(n, 1), title: prettySlug(seg(n, 1)) });
  if (first === 'dataset' && n.segs[1]) return mk(n, 'dataset', 'pwc-dataset', `pwc-dataset:${lseg(n, 1)}`, { id: seg(n, 1), title: prettySlug(seg(n, 1)) });
  return null;
});
reg(['aclanthology.org'], paperAt('acl', (n) => (n.segs[0] ? n.segs[0].replace(/\.pdf$/i, '').toLowerCase() : undefined), () => undefined));
reg(['neurips.cc', 'nips.cc'], paperAt('neurips', (n) => n.segs.map((s) => /^([0-9a-f]{32})/i.exec(s)?.[1]).find(Boolean)?.toLowerCase()));
reg(['mlr.press'], paperAt('pmlr', (n) => (n.segs.length >= 2 ? `${lseg(n, 0)}/${n.segs[1]!.replace(/\.(?:html|pdf)$/i, '').replace(/^.*?\//, '').toLowerCase()}` : undefined)));
reg(['thecvf.com'], paperAt('cvf', (n) => (n.segs.length > 2 ? n.path.replace(/_(?:paper|supplemental)\.(?:html|pdf)$/i, '').toLowerCase() : undefined)));
reg(['jmlr.org'], paperAt('jmlr', (n) => (lseg(n, 0) === 'papers' && n.segs.length > 1 ? n.path.replace(/\.(?:html|pdf)$/i, '').toLowerCase() : undefined)));
reg(['ieee.org'], (n) => (n.host === 'ieeexplore.ieee.org' ? paperAt('ieee', (x) => x.segs.find((s) => /^\d{5,}$/.test(s)), () => 'IEEE paper')(n) : undefined));
reg(['researchgate.net'], paperAt('researchgate', (n) => (lseg(n, 0) === 'publication' ? /^(\d+)/.exec(seg(n, 1))?.[1] : undefined), (n) => prettySlug(seg(n, 1).replace(/^\d+_/, ''))));
reg(['ssrn.com'], paperAt('ssrn', (n) => n.params.get('abstract_id') ?? n.params.get('abstractid') ?? /abstract=(\d+)/.exec(n.path)?.[1] ?? undefined, () => 'SSRN paper'));
reg(['nih.gov'], (n) => {
  if (n.host === 'pubmed.ncbi.nlm.nih.gov' && /^\d+$/.test(seg(n, 0))) return mk(n, 'paper', 'pubmed', `pmid:${seg(n, 0)}`, { id: seg(n, 0), title: `PubMed ${seg(n, 0)}` });
  const pmc = n.segs.find((s) => /^PMC\d+$/i.test(s));
  if (pmc) return mk(n, 'paper', 'pmc', `pmc:${pmc.toUpperCase()}`, { id: pmc.toUpperCase(), title: pmc.toUpperCase() });
  return undefined;
});
reg(['sciencedirect.com'], (n) => {
  const pii = n.segs[n.segs.findIndex((s) => s.toLowerCase() === 'pii') + 1];
  return pii && lseg(n, 0) === 'science' ? mk(n, 'paper', 'sciencedirect', `pii:${pii.toUpperCase()}`, { id: pii, title: 'ScienceDirect article' }) : undefined;
});
reg(['jstor.org'], paperAt('jstor', (n) => (lseg(n, 0) === 'stable' ? n.segs.find((s) => /^\d+$/.test(s)) : undefined), () => 'JSTOR paper'));
reg(['iacr.org'], (n) => (n.host === 'eprint.iacr.org' && /^\d{4}$/.test(seg(n, 0)) && n.segs[1] ? mk(n, 'paper', 'iacr', `iacr:${seg(n, 0)}/${seg(n, 1).replace(/\.pdf$/, '')}`, { title: `IACR ePrint ${seg(n, 0)}/${seg(n, 1).replace(/\.pdf$/, '')}` }) : undefined));
reg(['distill.pub', 'transformer-circuits.pub'], (n) => (n.segs.length >= 2 ? mk(n, 'paper', 'distill', pathKey(n), { title: slugTitle(n.segs) }) : undefined));
reg(['osf.io', 'hal.science', 'philpapers.org', 'chemrxiv.org', 'biorxiv.org', 'medrxiv.org'], (n) => {
  const doi = doiFromPath(n.path);
  if (doi) return doiRes(n, doi);
  return n.segs.length >= 2 ? mk(n, 'paper', 'preprint', pathKey(n), { title: slugTitle(n.segs) }) : undefined;
});

reg(['youtube.com', 'youtu.be', 'youtube-nocookie.com'], youtube);
reg(['vimeo.com'], vimeo);
reg(['loom.com'], videoAt('loom', (n) => (lseg(n, 0) === 'share' || lseg(n, 0) === 'embed' ? /([0-9a-f]{32})$/i.exec(seg(n, 1))?.[1] ?? seg(n, 1) : null), (id) => `https://loom.com/share/${id}`));
reg(['ted.com'], videoAt('ted', (n) => (lseg(n, 0) === 'talks' ? seg(n, 1) : null), (id) => `https://ted.com/talks/${id}`));
reg(['dailymotion.com', 'dai.ly'], videoAt('dailymotion', (n) => (n.host === 'dai.ly' ? seg(n, 0) : lseg(n, 0) === 'video' ? seg(n, 1) : null), (id) => `https://dailymotion.com/video/${id}`));
reg(['streamable.com'], videoAt('streamable', (n) => seg(n, 0) || null));
reg(['twitch.tv'], (n) => {
  if (n.host === 'clips.twitch.tv' && n.segs[0]) return mk(n, 'video', 'twitch', `twitch-clip:${lseg(n, 0)}`, { title: 'Twitch clip' });
  if (lseg(n, 0) === 'videos' && n.segs[1]) return mk(n, 'video', 'twitch', `twitch:${seg(n, 1)}`, { id: seg(n, 1), title: 'Twitch video' });
  if (n.segs.length === 1) return mk(n, 'video', 'channel', `twitch-channel:${lseg(n, 0)}`, { id: seg(n, 0), title: seg(n, 0) });
  return null;
});
reg(['tiktok.com'], (n) => {
  if (n.host === 'vm.tiktok.com' || n.host === 'vt.tiktok.com') return n.segs[0] ? mk(n, 'video', 'tiktok', `tiktok-short:${seg(n, 0)}`, { title: 'TikTok video' }) : null;
  const vi = n.segs.findIndex((s) => s.toLowerCase() === 'video');
  const id = vi >= 0 ? seg(n, vi + 1) : '';
  return /^\d+$/.test(id) ? mk(n, 'video', 'tiktok', `tiktok:${id}`, { url: `https://tiktok.com/${seg(n, 0)}/video/${id}`, id, title: `TikTok by ${seg(n, 0)}` }) : null;
});
reg(['instagram.com'], (n) => {
  const first = lseg(n, 0);
  if ((first === 'reel' || first === 'reels' || first === 'tv') && n.segs[1]) return mk(n, 'video', 'instagram', `ig:${seg(n, 1)}`, { url: `https://instagram.com/reel/${seg(n, 1)}`, id: seg(n, 1), title: 'Instagram reel' });
  if (first === 'p' && n.segs[1]) return mk(n, 'other', 'discussion', `ig:${seg(n, 1)}`, { url: `https://instagram.com/p/${seg(n, 1)}`, id: seg(n, 1), title: 'Instagram post' });
  return null;
});
reg(['facebook.com', 'fb.watch'], (n) => {
  if (n.host === 'fb.watch') return n.segs[0] ? mk(n, 'video', 'facebook', `fbw:${seg(n, 0)}`, { title: 'Facebook video' }) : null;
  const v = n.params.get('v');
  if (lseg(n, 0) === 'watch' && v) return mk(n, 'video', 'facebook', `fbv:${v}`, { id: v, title: 'Facebook video' });
  const vi = n.segs.findIndex((s) => s.toLowerCase() === 'videos');
  if (vi >= 0 && n.segs[vi + 1]) return mk(n, 'video', 'facebook', `fbv:${seg(n, vi + 1)}`, { title: 'Facebook video' });
  if (n.segs.some((s) => /^(?:posts|permalink\.php|story\.php)$/i.test(s))) return mk(n, 'other', 'discussion', pathKey(n), { title: 'Facebook post' });
  return null;
});
reg(['bilibili.com'], videoAt('bilibili', (n) => (lseg(n, 0) === 'video' ? seg(n, 1) : null)));
reg(['nebula.tv'], videoAt('nebula', (n) => (lseg(n, 0) === 'videos' ? seg(n, 1) : null)));
reg(['rumble.com'], (n) => (/^v[a-z0-9]+-/i.test(seg(n, 0)) ? mk(n, 'video', 'rumble', pathKey(n), { title: slugTitle(n.segs) }) : null));
reg(['wistia.com'], videoAt('wistia', (n) => (lseg(n, 0) === 'medias' ? seg(n, 1) : null)));

reg(['spotify.com', 'spotify.link'], spotify);
reg(['apple.com'], apple);
reg(['overcast.fm', 'pca.st', 'pocketcasts.com', 'castbox.fm', 'podbean.com', 'pod.link', 'transistor.fm', 'simplecast.com', 'buzzsprout.com', 'libsyn.com', 'castro.fm', 'podcastaddict.com', 'listennotes.com', 'podchaser.com', 'anchor.fm', 'podcasters.spotify.com', 'creators.spotify.com'], (n) =>
  n.segs.length || n.host.split('.').length > 2 ? mk(n, 'podcast', 'podcast', pathKey(n), { title: slugTitle(n.segs) ?? `${brandOf(n.host)} podcast` }) : null,
);
reg(['soundcloud.com'], (n) => (n.segs.length >= 2 ? mk(n, 'other', 'music', pathKey(n), { title: slugTitle(n.segs) ?? 'SoundCloud' }) : null));

reg(['google.com', 'goo.gl', 'app.goo.gl'], google);
reg(['substack.com'], substack);
reg(['medium.com'], medium);
reg(['hashnode.dev', 'hashnode.com'], (n) =>
  !n.segs.length ? (n.host.split('.').length > 2 ? mk(n, 'article', 'newsletter', `newsletter:${n.host}`, { title: n.host.split('.')[0] }) : null) : mk(n, 'article', 'hashnode', pathKey(n), { title: slugTitle(n.segs) }),
);
reg(['dev.to'], (n) => (n.segs.length >= 2 ? mk(n, 'article', 'devto', pathKey(n), { title: slugTitle(n.segs) }) : null));
reg(['wikipedia.org'], (n) => {
  if (lseg(n, 0) !== 'wiki' || !n.segs[1]) return null;
  const lang = n.host.split('.')[0]!;
  const title = dec(n.segs.slice(1).join('/')).replace(/_/g, ' ');
  return mk(n, 'article', 'wikipedia', `wiki:${lang}:${title.toLowerCase()}`, { url: `https://${n.host}/wiki/${n.segs.slice(1).join('/')}`, id: title, title });
});
reg(['linkedin.com', 'lnkd.in'], (n) => (n.host === 'lnkd.in' ? mk(n, 'other', 'short', pathKey(n), { title: 'LinkedIn link' }) : linkedin(n)));
reg(['news.ycombinator.com'], (n) => {
  const id = n.params.get('id');
  return lseg(n, 0) === 'item' && id ? mk(n, 'other', 'discussion', `hn:${id}`, { url: `https://news.ycombinator.com/item?id=${id}`, id, title: 'Hacker News discussion' }) : null;
});
reg(['ycombinator.com'], (n) => {
  if (n.host === 'news.ycombinator.com') return H.get('news.ycombinator.com')!(n);
  if (n.segs.some((s) => s.toLowerCase() === 'jobs')) return mk(n, 'job', 'yc', pathKey(n), { title: slugTitle(n.segs) ?? 'YC startup job' });
  if (lseg(n, 0) === 'companies' && n.segs[1]) return mk(n, 'tool', 'yc', `yc:${lseg(n, 1)}`, { url: `https://ycombinator.com/companies/${seg(n, 1)}`, title: prettySlug(seg(n, 1)) });
  return undefined;
});
reg(['reddit.com', 'redd.it'], (n) => {
  if (n.host === 'i.redd.it' || n.host === 'preview.redd.it') return mk(n, 'other', 'image', pathKey(n), { title: 'Image' });
  if (n.host === 'v.redd.it') return mk(n, 'video', 'reddit', pathKey(n), { title: 'Reddit video' });
  if (n.host === 'redd.it') return n.segs[0] ? mk(n, 'other', 'discussion', `reddit:${lseg(n, 0)}`, { url: `https://reddit.com/comments/${seg(n, 0)}`, title: 'Reddit thread' }) : null;
  const ci = n.segs.findIndex((s) => s.toLowerCase() === 'comments');
  const id = ci >= 0 ? n.segs[ci + 1] : undefined;
  if (!id) return null;
  const sub = lseg(n, 0) === 'r' ? seg(n, 1) : '';
  return mk(n, 'other', 'discussion', `reddit:${id.toLowerCase()}`, { url: `https://reddit.com/${sub ? `r/${sub}/` : ''}comments/${id}`, id, title: prettySlug(n.segs[ci + 2] ?? '') ?? (sub ? `r/${sub} thread` : 'Reddit thread') });
});
reg(['lobste.rs'], (n) => (lseg(n, 0) === 's' && n.segs[1] ? mk(n, 'other', 'discussion', `lobsters:${seg(n, 1)}`, { title: prettySlug(seg(n, 2)) ?? 'Lobsters discussion' }) : null));
reg(['threads.net', 'threads.com'], (n) => (lseg(n, 1) === 'post' && n.segs[2] ? mk(n, 'other', 'discussion', `threads:${seg(n, 2)}`, { url: `https://threads.net/${seg(n, 0)}/post/${seg(n, 2)}`, title: `Thread by ${seg(n, 0)}` }) : null));
reg(['bsky.app'], (n) => (lseg(n, 0) === 'profile' && lseg(n, 2) === 'post' && n.segs[3] ? mk(n, 'other', 'discussion', `bsky:${seg(n, 3)}`, { title: `Post by ${seg(n, 1)}` }) : null));

reg(['producthunt.com'], only(['producthunt.com'], (n) => {
  const first = lseg(n, 0);
  if ((first === 'posts' || first === 'products') && n.segs[1]) return mk(n, 'tool', 'product-hunt', `ph:${lseg(n, 1)}`, { url: `https://producthunt.com/${first}/${seg(n, 1)}`, id: seg(n, 1), title: prettySlug(seg(n, 1)) });
  if (first === 'stories' && n.segs[1]) return mk(n, 'article', 'product-hunt', pathKey(n), { title: prettySlug(seg(n, 1)) });
  return null;
}));
reg(['mozilla.org'], (n) => {
  if (n.host !== 'addons.mozilla.org') return n.host === 'developer.mozilla.org' ? mk(n, 'docs', 'mdn', pathKey(n), { title: slugTitle(n.segs) ?? 'MDN Web Docs' }) : undefined;
  const ai = n.segs.findIndex((s) => s.toLowerCase() === 'addon');
  return ai >= 0 && n.segs[ai + 1] ? mk(n, 'tool', 'firefox-addon', `amo:${n.segs[ai + 1]!.toLowerCase()}`, { url: `https://addons.mozilla.org/firefox/addon/${n.segs[ai + 1]}`, id: n.segs[ai + 1], title: prettySlug(n.segs[ai + 1]!) }) : null;
});
reg(['visualstudio.com'], (n) => {
  const item = n.params.get('itemName');
  return n.host === 'marketplace.visualstudio.com' && item ? mk(n, 'tool', 'vscode-extension', `vscode:${item.toLowerCase()}`, { url: `https://marketplace.visualstudio.com/items?itemName=${encodeURIComponent(item)}`, id: item, title: item }) : undefined;
});
reg(['open-vsx.org'], (n) => (lseg(n, 0) === 'extension' && n.segs[2] ? mk(n, 'tool', 'vscode-extension', `vscode:${seg(n, 1)}.${seg(n, 2)}`.toLowerCase(), { title: `${seg(n, 1)}.${seg(n, 2)}` }) : undefined));
reg(['raycast.com'], (n) => (n.segs.length === 2 && !['blog', 'changelog', 'store', 'pro', 'teams'].includes(lseg(n, 0)) ? mk(n, 'tool', 'raycast', `raycast:${n.path.slice(1).toLowerCase()}`, { title: prettySlug(seg(n, 1)) }) : undefined));
reg(['figma.com'], (n) => {
  const first = lseg(n, 0);
  if (first === 'community' && n.segs[2]) return mk(n, 'tool', 'figma', `figma-community:${seg(n, 2)}`, { url: `https://figma.com/community/${seg(n, 1)}/${seg(n, 2)}${n.segs[3] ? '/' + seg(n, 3) : ''}`, id: seg(n, 2), title: prettySlug(seg(n, 3)) ?? 'Figma community file' });
  if (['file', 'design', 'proto', 'board', 'slides', 'deck'].includes(first) && n.segs[1]) return mk(n, 'other', 'figma-file', `figma:${seg(n, 1)}`, { url: `https://figma.com/${first}/${seg(n, 1)}`, id: seg(n, 1), title: prettySlug(seg(n, 2)) ?? 'Figma file' });
  return undefined;
});
reg(['gumroad.com'], (n) => {
  const li = n.segs.findIndex((s) => s.toLowerCase() === 'l');
  return li >= 0 && n.segs[li + 1] ? mk(n, 'tool', 'gumroad', pathKey(n), { title: prettySlug(n.segs[li + 1]!) }) : undefined;
});
reg(['notion.so', 'notion.site'], (n) => (n.segs.length ? mk(n, 'other', 'notion', `notion:${(/([0-9a-f]{32})$/i.exec(n.segs[n.segs.length - 1]!)?.[1] ?? pathKey(n)).toLowerCase()}`, { title: slugTitle(n.segs.map((s) => s.replace(/-?[0-9a-f]{32}$/i, ''))) ?? 'Notion page' }) : undefined));
reg(['imgur.com'], (n) => (n.segs.length ? mk(n, 'other', 'image', pathKey(n), { title: 'Image on Imgur' }) : null));

reg(['amzn.to', 'amzn.in', 'amzn.eu', 'amzn.asia', 'a.co'], amazonShort);
reg(['goodreads.com'], only(['goodreads.com'], (n) => {
  const bi = n.segs.findIndex((s) => s.toLowerCase() === 'show');
  if ((lseg(n, 0) === 'book' || lseg(n, 1) === 'book') && bi >= 0 && n.segs[bi + 1]) {
    const raw = n.segs[bi + 1]!;
    const id = /^(\d+)/.exec(raw)?.[1];
    if (!id) return null;
    return mk(n, 'book', 'goodreads', `goodreads:${id}`, { url: `https://goodreads.com/book/show/${raw}`, id, title: prettySlug(raw.replace(/^\d+[.-]?/, '').replace(/_/g, ' ')) ?? 'Book on Goodreads' });
  }
  if (lseg(n, 0) === 'series' && n.segs[1]) return mk(n, 'book', 'goodreads', pathKey(n), { title: prettySlug(seg(n, 1)) });
  return null;
}));
reg(['openlibrary.org'], (n) => (['works', 'books', 'isbn'].includes(lseg(n, 0)) && n.segs[1] ? mk(n, 'book', 'open-library', `openlibrary:${lseg(n, 1)}`, { url: `https://openlibrary.org/${lseg(n, 0)}/${seg(n, 1)}`, id: seg(n, 1), title: prettySlug(seg(n, 2)) ?? 'Open Library book' }) : null));
reg(['bookshop.org'], (n) => (lseg(n, 0) === 'p' || lseg(n, 0) === 'a' || lseg(n, 0) === 'books' ? mk(n, 'book', 'bookshop', findIsbn(n.href) ? `isbn:${findIsbn(n.href)}` : pathKey(n), { title: slugTitle(n.segs) }) : null));
reg(['oreilly.com'], (n) => {
  const vi = n.segs.findIndex((s) => s.toLowerCase() === 'view');
  if (lseg(n, 0) === 'library' && vi >= 0 && n.segs[vi + 1]) {
    const isbn = n.segs.find((s) => /^97[89]\d{10}$/.test(s));
    return mk(n, 'book', 'oreilly', isbn ? `isbn:${isbn}` : pathKey(n), { id: isbn, title: prettySlug(n.segs[vi + 1]!) });
  }
  return undefined;
});
reg(['manning.com', 'pragprog.com', 'nostarch.com', 'leanpub.com', 'apress.com'], (n) => {
  const first = lseg(n, 0);
  if (n.host === 'leanpub.com' ? n.segs.length >= 1 && !['blog', 'faq', 'authors', 'bookstore', 'courses'].includes(first) : ['books', 'titles', 'book'].includes(first) && n.segs[1]) {
    return mk(n, 'book', brandOf(n.host).toLowerCase(), pathKey(n), { title: slugTitle(n.segs) });
  }
  return undefined;
});
reg(['audible.com', 'audible.in', 'audible.co.uk'], (n) => (lseg(n, 0) === 'pd' && n.segs[1] ? mk(n, 'book', 'audible', `audible:${(n.segs[n.segs.length - 1] ?? '').toUpperCase()}`, { title: prettySlug(seg(n, 1)) ?? 'Audiobook' }) : undefined));
reg(['thestorygraph.com', 'storytel.com', 'kobo.com', 'barnesandnoble.com', 'bookswagon.com', 'crossword.in', 'sapnaonline.com', 'gutenberg.org', 'standardebooks.org', 'penguin.co.in', 'penguinrandomhouse.com', 'harpercollins.com', 'harpercollins.co.in'], (n) =>
  n.segs.length >= 2 ? mk(n, 'book', 'book', findIsbn(n.href) ? `isbn:${findIsbn(n.href)}` : pathKey(n), { title: slugTitle(n.segs) }) : undefined,
);
reg(['scribd.com'], (n) => (lseg(n, 0) === 'book' || lseg(n, 0) === 'audiobook' ? mk(n, 'book', 'scribd', pathKey(n), { title: slugTitle(n.segs) }) : mk(n, 'other', 'document', pathKey(n), { title: slugTitle(n.segs) ?? 'Scribd document' })));
reg(['flipkart.com'], (n) => {
  const slug = seg(n, 0);
  if (lseg(n, 1) !== 'p') return null;
  const isBook = /book|novel|paperback|hardcover|edition/i.test(slug) || !!findIsbn(n.href);
  return mk(n, isBook ? 'book' : 'tool', isBook ? 'flipkart' : 'product', `flipkart:${lseg(n, 2)}`, { url: `https://flipkart.com/${slug}/p/${seg(n, 2)}`, id: seg(n, 2), title: prettySlug(slug) });
});

const courseAt = (subtype: string, match: (n: Norm) => boolean, title?: (n: Norm) => string | undefined): Handler => (n) => (match(n) ? mk(n, 'course', subtype, `${subtype}:${(n.path || '/').toLowerCase()}`, { title: title?.(n) ?? slugTitle(n.segs) }) : undefined);
reg(['coursera.org'], only(['coursera.org'], (n) => {
  const first = lseg(n, 0);
  if (['learn', 'specializations', 'professional-certificates', 'projects', 'programs', 'degrees'].includes(first) && n.segs[1]) return mk(n, 'course', 'coursera', `coursera:${first}/${lseg(n, 1)}`, { url: `https://coursera.org/${first}/${seg(n, 1)}`, id: seg(n, 1), title: prettySlug(seg(n, 1)) });
  return first === 'articles' && n.segs[1] ? mk(n, 'article', 'coursera', pathKey(n), { title: prettySlug(seg(n, 1)) }) : null;
}));
reg(['udemy.com'], only(['udemy.com'], (n) => (lseg(n, 0) === 'course' && n.segs[1] ? mk(n, 'course', 'udemy', `udemy:${lseg(n, 1)}`, { url: `https://udemy.com/course/${seg(n, 1)}`, id: seg(n, 1), title: prettySlug(seg(n, 1)) }) : null)));
reg(['nptel.ac.in', 'swayam.gov.in', 'swayam2.ac.in'], (n) => {
  const code = n.segs.find((s) => /^(?:noc|nou|ugc|cec|aic|imb)\d{2}_[a-z]{2}\d+$/i.test(s));
  if (code) return mk(n, 'course', 'nptel', `nptel:${code.toLowerCase()}`, { id: code, title: `NPTEL ${code}` });
  const ci = n.segs.findIndex((s) => s.toLowerCase() === 'courses');
  const id = ci >= 0 ? n.segs.slice(ci + 1).join('/') : '';
  if (id) return mk(n, 'course', 'nptel', `nptel:${id.toLowerCase()}`, { id, title: `NPTEL course ${id}` });
  return n.segs.length ? mk(n, 'course', 'nptel', pathKey(n), { title: slugTitle(n.segs) ?? 'NPTEL course' }) : mk(n, 'course', 'nptel', pathKey(n), { title: n.host.includes('swayam') ? 'SWAYAM' : 'NPTEL' });
});
reg(['edx.org'], courseAt('edx', (n) => ['course', 'learn', 'professional-certificate', 'certificates', 'xseries', 'micromasters', 'masters', 'bachelors', 'executive-education'].includes(lseg(n, 0)) && n.segs.length >= 2));
reg(['scaler.com'], (n) => {
  const first = lseg(n, 0);
  if (first === 'topics') return n.segs.length >= 2 ? mk(n, 'article', 'scaler-topics', pathKey(n), { title: slugTitle(n.segs) }) : null;
  if (['courses', 'academy', 'data-science-course', 'devops-course', 'ai-ml-course'].includes(first) || /course/.test(first)) return mk(n, 'course', 'scaler', pathKey(n), { title: slugTitle(n.segs) ?? 'Scaler course' });
  return undefined;
});
reg(['khanacademy.org'], courseAt('khan-academy', (n) => n.segs.length >= 1));
reg(['freecodecamp.org'], (n) => (lseg(n, 0) === 'news' ? (n.segs.length >= 2 ? mk(n, 'article', 'freecodecamp', pathKey(n), { title: slugTitle(n.segs) }) : null) : lseg(n, 0) === 'learn' ? mk(n, 'course', 'freecodecamp', pathKey(n), { title: slugTitle(n.segs) ?? 'freeCodeCamp' }) : undefined));
reg(['egghead.io', 'frontendmasters.com', 'pluralsight.com', 'codecademy.com', 'brilliant.org', 'skillshare.com', 'datacamp.com', 'educative.io', 'zerotomastery.io', 'udacity.com', 'boot.dev', 'unacademy.com', 'mygreatlearning.com', 'simplilearn.com', 'upgrad.com', 'futurelearn.com', 'domestika.org', 'masterclass.com'], courseAt('course', (n) => n.segs.some((s) => /^(?:courses?|learn|classes|class|paths?|tracks?|catalog|program|nanodegree)$/i.test(s)) && n.segs.length >= 2));
reg(['mit.edu'], (n) => (n.host === 'ocw.mit.edu' && lseg(n, 0) === 'courses' && n.segs[1] ? mk(n, 'course', 'mit-ocw', `ocw:${lseg(n, 1)}`, { title: prettySlug(seg(n, 1)) }) : undefined));
reg(['harvard.edu'], (n) => (n.host === 'cs50.harvard.edu' || /^(?:course|courses)$/.test(lseg(n, 0)) ? mk(n, 'course', 'harvard', pathKey(n), { title: n.host === 'cs50.harvard.edu' ? `CS50${n.segs.length ? ' ' + n.segs.join(' ') : ''}` : slugTitle(n.segs) }) : undefined));
reg(['deeplearning.ai'], (n) => (n.segs.some((s) => /^(?:short-courses|courses|specializations)$/i.test(s)) && n.segs.length >= 2 ? mk(n, 'course', 'deeplearning-ai', `dlai:${lseg(n, n.segs.length - 1)}`, { title: slugTitle(n.segs) }) : n.host === 'learn.deeplearning.ai' ? mk(n, 'course', 'deeplearning-ai', pathKey(n), { title: slugTitle(n.segs) }) : undefined));
reg(['fast.ai'], (n) => (n.host === 'course.fast.ai' ? mk(n, 'course', 'fast-ai', `fastai:${n.path.toLowerCase()}`, { title: slugTitle(n.segs) ?? 'Practical Deep Learning (fast.ai)' }) : undefined));
reg(['teachable.com', 'thinkific.com', 'podia.com', 'maven.com'], (n) => (n.segs.length >= (n.host === 'maven.com' ? 2 : 1) ? mk(n, 'course', 'course', pathKey(n), { title: slugTitle(n.segs) }) : undefined));
reg(['microsoft.com'], (n) => (n.host === 'learn.microsoft.com' ? mk(n, n.segs.some((s) => s.toLowerCase() === 'training') ? 'course' : 'docs', 'microsoft-learn', pathKey(n), { title: slugTitle(n.segs) }) : undefined));

reg(['readthedocs.io', 'readthedocs.org', 'gitbook.io', 'docs.rs', 'devdocs.io', 'cppreference.com', 'man7.org', 'mintlify.app'], (n) => mk(n, 'docs', 'docs', pathKey(n), { title: slugTitle(n.segs) ?? brandOf(n.host) }));

reg(['huggingface.co', 'hf.co'], only(['huggingface.co', 'hf.co'], huggingface));
reg(['kaggle.com'], only(['kaggle.com'], kaggle));
reg(['ollama.com'], (n) => (n.segs.length >= 2 && !['blog', 'docs'].includes(lseg(n, 0)) ? mk(n, 'dataset', 'model', `ollama:${n.path.toLowerCase()}`, { title: lseg(n, 0) === 'library' ? seg(n, 1) : `${seg(n, 0)}/${seg(n, 1)}` }) : undefined));
reg(['replicate.com'], (n) => (n.segs.length === 2 && !['blog', 'docs', 'pricing', 'explore', 'collections', 'account'].includes(lseg(n, 0)) ? mk(n, 'dataset', 'model', `replicate:${n.path.toLowerCase()}`, { title: n.path.slice(1) }) : undefined));
reg(['civitai.com'], (n) => (lseg(n, 0) === 'models' && n.segs[1] ? mk(n, 'dataset', 'model', `civitai:${seg(n, 1)}`, { title: prettySlug(seg(n, 2)) ?? 'Model on Civitai' }) : undefined));
reg(['zenodo.org', 'figshare.com', 'data.gov.in', 'data.gov', 'data.europa.eu', 'openml.org', 'ourworldindata.org', 'datasetsearch.research.google.com'], (n) => (n.segs.length ? mk(n, 'dataset', 'dataset', pathKey(n), { title: slugTitle(n.segs) ?? `${brandOf(n.host)} dataset` }) : undefined));

reg(['wellfound.com', 'angel.co'], jobBoard('wellfound', (n) => (!n.segs.length || ['jobs', 'company', 'l', 'role', 'remote'].includes(lseg(n, 0)) ? undefined : null)));
reg(['naukri.com'], jobBoard('naukri'));
reg(['instahyre.com'], jobBoard('instahyre'));
reg(['cutshort.io', 'internshala.com', 'foundit.in', 'hirist.tech', 'hirist.com', 'iimjobs.com', 'remoteok.com', 'weworkremotely.com', 'remotive.com', 'workatastartup.com', 'otta.com', 'himalayas.app', 'unstop.com', 'turing.com', 'arc.dev'], jobBoard('job'));
reg(['indeed.com', 'indeed.co.in', 'indeed.co.uk'], (n) => {
  const jk = n.params.get('jk');
  return jk ? mk(n, 'job', 'indeed', `indeed:${jk}`, { id: jk, title: 'Job on Indeed' }) : n.segs.some((s) => /^(?:viewjob|jobs|q-.*|cmp)$/i.test(s)) ? mk(n, 'job', 'indeed', pathKey(n), { title: slugTitle(n.segs) ?? 'Jobs on Indeed' }) : null;
});
reg(['glassdoor.com', 'glassdoor.co.in', 'glassdoor.co.uk'], (n) => (n.segs.some((s) => /^(?:job-listing|job|jobs)$/i.test(s)) || /jobs?/i.test(seg(n, 0)) ? mk(n, 'job', 'glassdoor', pathKey(n), { title: slugTitle(n.segs) ?? 'Job on Glassdoor' }) : null));
reg(['greenhouse.io', 'lever.co', 'ashbyhq.com', 'workable.com', 'smartrecruiters.com', 'myworkdayjobs.com', 'breezy.hr', 'recruitee.com', 'jobvite.com', 'bamboohr.com', 'keka.com', 'zohorecruit.com', 'zohorecruit.in', 'freshteam.com', 'teamtailor.com', 'personio.de', 'rippling-ats.com'], atsBoard);
reg(['upwork.com'], (n) => (lseg(n, 0) === 'jobs' || lseg(n, 1) === 'jobs' ? mk(n, 'job', 'upwork', pathKey(n), { title: slugTitle(n.segs) ?? 'Upwork job' }) : undefined));
reg(['levels.fyi'], (n) => (lseg(n, 0) === 'jobs' ? mk(n, 'job', 'levels', pathKey(n), { title: 'Job on Levels.fyi' }) : undefined));

const SHORTENERS = ['bit.ly', 'buff.ly', 'ow.ly', 'tinyurl.com', 'dlvr.it', 'ift.tt', 'trib.al', 'shorturl.at', 'rb.gy', 'cutt.ly', 't.ly', 'is.gd', 's.id', 'hubs.ly', 'hubs.la', 'bit.do', 'rebrand.ly', 'tiny.cc', 'fb.me', 'wp.me', 'zpr.io', 'bl.ink', 'snip.ly', 'po.st', 'qr.ae', 'shorturl.com', 'v.gd', 'go.shr.lc', 'shrtco.de', 'surl.li', 'tinyurl.is', 'kutt.it', 'msft.it', 'aka.ms', 'apple.co', 'spoti.fi', 'g.co', 'goo.gle', 'nyti.ms', 'wapo.st', 'bloom.bg', 'on.ft.com', 'econ.st', 'reut.rs', 'cnb.cx', 'tcrn.ch', 'gizmo.do', 'mol.im'];
reg(SHORTENERS, (n) => (n.segs.length || n.qs ? mk(n, 'other', 'short', pathKey(n), { title: `${n.host} link` }) : null));

/* ---- generic heuristics ---- */

const NEWS = new Set(
  'nytimes.com wsj.com ft.com bloomberg.com reuters.com theverge.com techcrunch.com wired.com economist.com bbc.com bbc.co.uk theguardian.com washingtonpost.com theatlantic.com newyorker.com vox.com axios.com semafor.com forbes.com businessinsider.com cnbc.com cnn.com arstechnica.com engadget.com thenextweb.com venturebeat.com theinformation.com fortune.com time.com apnews.com npr.org aljazeera.com thehindu.com indianexpress.com livemint.com indiatimes.com hindustantimes.com ndtv.com moneycontrol.com business-standard.com scroll.in theprint.in thewire.in the-ken.com inc42.com yourstory.com entrackr.com medianama.com financialexpress.com deccanherald.com news18.com firstpost.com thequint.com newslaundry.com outlookindia.com indiatoday.in businesstoday.in 9to5mac.com 9to5google.com macrumors.com quantamagazine.org nautil.us aeon.co stratechery.com platformer.news every.to paulgraham.com theconversation.com scientificamerican.com newscientist.com technologyreview.com lennysnewsletter.com notboring.co'.split(' '),
);
const BLOG_REGS = new Set(['ghost.io', 'wordpress.com', 'blogspot.com', 'beehiiv.com', 'bearblog.dev', 'micro.blog', 'tumblr.com', 'svbtle.com', 'posthaven.com', 'typepad.com', 'mataroa.blog', 'write.as', 'buttondown.email', 'buttondown.com', 'mirror.xyz', 'paragraph.xyz', 'paragraph.com', 'ck.page', 'kit.com', 'blogger.com', 'hey.com', 'world.hey.com']);
const APP_HOSTS = new Set(['vercel.app', 'netlify.app', 'pages.dev', 'fly.dev', 'onrender.com', 'replit.app', 'repl.co', 'streamlit.app', 'lovable.app', 'bolt.host', 'glitch.me', 'herokuapp.com', 'web.app', 'firebaseapp.com', 'surge.sh', 'gradio.live', 'hf.space', 'framer.website', 'framer.ai', 'webflow.io', 'carrd.co', 'super.site']);
const JOB_SEGS = new Set(['careers', 'career', 'jobs', 'job', 'join-us', 'joinus', 'hiring', 'open-positions', 'openings', 'open-roles', 'vacancies', 'work-with-us', 'positions', 'were-hiring', 'we-are-hiring']);
const COURSE_SEGS = new Set(['course', 'courses', 'bootcamp', 'bootcamps', 'cohort', 'cohorts', 'workshop', 'workshops', 'masterclass', 'certification', 'nanodegree', 'specialization', 'curriculum', 'syllabus', 'lectures']);
const DOC_SEGS = new Set(['docs', 'doc', 'documentation', 'reference', 'api-reference', 'api-docs', 'apidocs', 'manual', 'handbook', 'learn', 'kb', 'knowledge-base', 'knowledgebase', 'help', 'support', 'wiki', 'dev-docs', 'devdocs', 'man']);
const ARTICLE_SEGS = new Set(['blog', 'blogs', 'post', 'posts', 'p', 'article', 'articles', 'news', 'stories', 'story', 'essay', 'essays', 'writing', 'writings', 'notes', 'insights', 'guide', 'guides', 'tutorial', 'tutorials', 'research', 'journal', 'newsletter', 'newsletters', 'thoughts', 'letters', 'memos', 'memo', 'publications', 'press', 'case-studies', 'case-study', 'engineering', 'updates', 'changelog', 'releases', 'announcements', 'index', 'opinion', 'analysis', 'column', 'columns', 'magazine', 'read', 'til', 'learnings']);
const VIDEO_SEGS = new Set(['video', 'videos', 'watch', 'talks', 'talk', 'webinar', 'webinars', 'livestream', 'recordings', 'recording']);
const PODCAST_SEGS = new Set(['podcast', 'podcasts', 'episode', 'episodes']);
const PRODUCT_SEGS = new Set(['features', 'pricing', 'download', 'downloads', 'product', 'products', 'app', 'apps', 'home', 'waitlist', 'beta', 'demo', 'signup', 'sign-up', 'get-started', 'start', 'try', 'platform', 'solutions', 'enterprise', 'extension', 'extensions', 'plugin', 'plugins', 'integrations', 'templates', 'template', 'tools', 'tool', 'marketplace', 'store', 'shop', 'buy', 'launch', 'early-access', 'preview', 'playground', 'studio', 'chat', 'agents', 'agent', 'ai', 'api', 'pro', 'teams', 'business', 'mobile', 'desktop', 'features-overview']);

function isSlug(s: string): boolean {
  if (EXT_RE.test(s) && !/\.pdf$/i.test(s)) return true;
  const words = dec(s).split(/[-_+]+/).filter((w) => /\p{L}{2,}/u.test(w));
  return words.length >= 2;
}

function generic(n: Norm): Classified {
  const segs = n.segs;
  const l = segs.map((s) => s.toLowerCase());
  const host = n.host;
  const title = () => slugTitle(segs);
  const key = pathKey(n);
  const reg = n.reg;

  if (/\.pdf$/i.test(n.path)) return mk(n, 'paper', 'pdf', key, { title: title() ?? `PDF on ${host}` });
  const doi = doiFromPath(n.path);
  if (doi) return doiRes(n, doi);
  const isbn = findIsbn(n.path + '?' + n.qs);
  if (isbn) return mk(n, 'book', 'isbn', `isbn:${isbn}`, { id: isbn, title: title() ?? `ISBN ${isbn}` });

  const first3 = l.slice(0, 3);
  if (/^(?:careers?|jobs|hiring|work|apply)\./.test(host) && host.split('.').length > 2) return mk(n, 'job', 'careers', key, { title: title() ?? `Careers at ${brandOf(host)}` });
  if (first3.some((s) => JOB_SEGS.has(s))) return mk(n, 'job', 'careers', key, { title: title() ?? `Careers at ${brandOf(host)}` });
  if (/^podcasts?\./.test(host) || l.slice(0, 2).some((s) => PODCAST_SEGS.has(s))) return mk(n, 'podcast', 'podcast', key, { title: title() ?? `${brandOf(host)} podcast` });
  if (/^(?:academy|courses?|learning|training|school|university|bootcamp)\./.test(host) || first3.some((s) => COURSE_SEGS.has(s))) return mk(n, 'course', 'course', key, { title: title() ?? `${brandOf(host)} course` });
  if (/^(?:docs?|documentation|developers?|devdocs|wiki|help|support|kb|reference|api-docs|apidocs|learn)\./.test(host) || DOC_SEGS.has(l[0] ?? '') || ['docs', 'documentation', 'reference'].includes(l[1] ?? '')) {
    return mk(n, 'docs', 'docs', key, { title: title() ?? `${brandOf(host)} docs` });
  }
  const isNews = NEWS.has(reg) || NEWS.has(host);
  const isBlog = BLOG_REGS.has(reg);
  if (/^(?:blogs?|news|engineering|eng|newsletter|stories|writing|journal|magazine|research|insights|tech|techblog|substack)\./.test(host) || isBlog) {
    return segs.length ? mk(n, 'article', 'blog', key, { title: title() }) : mk(n, 'article', 'newsletter', key, { title: brandOf(host.replace(/^(?:blogs?|news|engineering|newsletter)\./, '')) + (isBlog ? '' : ' blog') });
  }
  if (l.slice(0, 2).some((s) => ARTICLE_SEGS.has(s)) || first3.some((s) => /^(?:19|20)\d{2}$/.test(s)) || (l[0] ?? '').startsWith('@')) {
    return mk(n, 'article', isNews ? 'news' : 'article', key, { title: title() ?? brandOf(host) });
  }
  if (l.slice(0, 2).some((s) => VIDEO_SEGS.has(s))) return mk(n, 'video', 'video', key, { title: title() ?? `Video on ${host}` });
  if (!segs.length) {
    if (isNews) return mk(n, 'article', 'publication', key, { title: brandOf(host) });
    return mk(n, 'tool', APP_HOSTS.has(reg) ? 'app' : 'site', key, { title: APP_HOSTS.has(reg) ? prettySlug(host.split('.')[0]!) ?? host : brandOf(host) });
  }
  if (PRODUCT_SEGS.has(l[0]!)) return mk(n, 'tool', 'site', key, { title: segs.length === 1 ? `${brandOf(host)} ${prettySlug(segs[0]!)?.toLowerCase() ?? ''}`.trim() : title() ?? brandOf(host) });
  const last = segs[segs.length - 1]!;
  if (isSlug(last)) return mk(n, 'article', isNews ? 'news' : 'article', key, { title: title() });
  if (isNews) return mk(n, 'article', 'news', key, { title: title() ?? brandOf(host) });
  if (segs.length === 1 && /^[\p{L}][\p{L}\d]{1,30}$/u.test(dec(last))) return mk(n, 'tool', APP_HOSTS.has(reg) ? 'app' : 'site', key, { title: prettySlug(last) ?? brandOf(host) });
  return mk(n, 'other', 'link', key, { title: title() });
}

function classifyNorm(n: Norm): Classified | null {
  const h =
    H.get(n.host) ??
    H.get(n.reg) ??
    (AMAZON_REG.test(n.reg)
      ? n.host === n.reg || n.host === 'smile.' + n.reg
        ? amazon
        : undefined
      : /^google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/.test(n.reg)
        ? google
        : undefined);
  if (h) {
    const r = h(n);
    if (r !== undefined) return r;
  }
  if (n.host.endsWith('.substack.com')) {
    const r = substack(n);
    if (r !== undefined) return r;
  }
  if (n.host.endsWith('.medium.com')) {
    const r = medium(n);
    if (r !== undefined) return r;
  }
  return generic(n);
}

const urlCache = new Map<string, Classified | null>();

/** Classify one URL (null = not a resource: posts on X, profiles, search pages…). Cached. */
export function classifyUrl(raw: string): Classified | null {
  const hit = urlCache.get(raw);
  if (hit !== undefined) return hit;
  const n = normalize(raw);
  const c = n ? classifyNorm(n) : null;
  if (urlCache.size > 80_000) urlCache.clear();
  urlCache.set(raw, c);
  return c;
}

/* ------------------------------------------------------------------ */
/* Context refinement & titles                                         */
/* ------------------------------------------------------------------ */

const BOOK_HINT = /\b(?:books?|kindle|paperback|hardcover|hardback|audiobooks?|audible|novels?|isbn|memoir|biography|autobiography|e-?books?|reading list|must[- ]read|read this|authors?|chapters?)\b/i;
const PRODUCT_HINT = /₹|\$\s?\d|\brs\.?\s?\d|\bdeals?\b|\d+\s?% off|\bprice\b|\bdiscount|\bsale\b|\bcoupon|\bgadgets?\b|\bheadphones?\b|\bearbuds?\b|\bphones?\b|\blaptops?\b|\bmonitors?\b|\bkeyboards?\b|\bmouse\b|\bchargers?\b|\bcameras?\b|\bsmartwatch|\bspeakers?\b|\bdesk\b|\bchair\b/i;

const HOST_HINT: Array<[RegExp, ResourceType]> = [
  [/(?:^|\.)(?:youtube\.com|youtu\.be|vimeo\.com|loom\.com|ted\.com|twitch\.tv|tiktok\.com)$/, 'video'],
  [/(?:^|\.)(?:github\.com|gitlab\.com|npmjs\.com|pypi\.org)$/, 'repo'],
  [/(?:^|\.)(?:arxiv\.org|doi\.org|openreview\.net|semanticscholar\.org|biorxiv\.org|nature\.com)$/, 'paper'],
  [/(?:^|\.)(?:spotify\.com|podcasts\.apple\.com|overcast\.fm|pca\.st)$/, 'podcast'],
  [/(?:^|\.)(?:amazon\.[a-z.]+|goodreads\.com|audible\.[a-z.]+)$/, 'book'],
  [/(?:^|\.)(?:coursera\.org|udemy\.com|edx\.org|nptel\.ac\.in|scaler\.com|khanacademy\.org)$/, 'course'],
  [/(?:^|\.)(?:huggingface\.co|kaggle\.com)$/, 'dataset'],
  [/(?:^|\.)(?:producthunt\.com|apps\.apple\.com|play\.google\.com|chromewebstore\.google\.com)$/, 'tool'],
  [/(?:^|\.)(?:greenhouse\.io|lever\.co|wellfound\.com|naukri\.com|instahyre\.com)$/, 'job'],
];

interface Hit {
  c: Classified;
  title?: string;
  titleRank: number;
  description?: string;
  image?: string;
  cardDomain?: string;
  /** Raw preview-card text (before cleanup), used for context hints. */
  cardText?: string;
  who: Author;
}

function refine(h: Hit, text: string): Classified {
  const c = h.c;
  if (c.subtype === 'amazon' || c.subtype === 'amazon-short') {
    if (c.type !== 'book') return c;
    const card = h.cardText ?? '';
    let book: boolean;
    if (c.id && /^\d{9}[\dX]$/.test(c.id) && isbn10Valid(c.id)) book = true;
    else if (card) book = BOOK_HINT.test(card) || (!PRODUCT_HINT.test(card) && BOOK_HINT.test(text));
    else book = BOOK_HINT.test(text) || !PRODUCT_HINT.test(text);
    return book ? c : { ...c, type: 'tool', subtype: 'product' };
  }
  if (c.subtype === 'short' && h.cardDomain) {
    const dom = normHost(h.cardDomain.replace(/^https?:\/\//, '').split('/')[0] ?? '');
    if (!dom || !dom.includes('.')) return c;
    const type = HOST_HINT.find(([re]) => re.test(dom))?.[1] ?? 'article';
    return { ...c, type, subtype: 'link', domain: dom };
  }
  return c;
}

const SITE_SUFFIX =
  /\s*[|·•–—:-]\s*(?:YouTube|Vimeo|LinkedIn|Medium|Substack|DEV Community.*|Hacker News|Product Hunt|Kaggle|Coursera|Udemy|edX|Hugging Face|Wikipedia|Goodreads|GitHub|arXiv(?:\.org)?|Spotify|Apple Podcasts|Loom|Notion|Google Docs|Google Sheets|Google Drive|Google Play|Google Books|Chrome Web Store|NPTEL|Scaler Topics|freeCodeCamp(?:\.org)?|MDN Web Docs|MDN|Reddit|TED Talk|TED|Podcast on Spotify|Instagram|TikTok|Amazon\.[a-z.]+|Flipkart\.com|Wellfound|Naukri\.com|Instahyre|Dribbble|Behance|Figma|X|Twitter)\s*$/i;

/** Remove site boilerplate from preview-card titles. */
export function cleanCardTitle(raw: string, c: Pick<Classified, 'subtype' | 'domain'>): { title: string; description?: string } {
  let s = raw.replace(/\s+/g, ' ').trim();
  if (c.subtype === 'github') {
    const m = /^GitHub\s*-\s*([^\s:]+\/[^\s:]+?)(?::\s*(.+))?$/.exec(s);
    if (m) return { title: m[1]!, description: m[2]?.trim() || undefined };
  }
  s = s.replace(/^\[(?:\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(?:v\d+)?\]\s*/i, '');
  if (/amazon/i.test(c.domain) || c.subtype.startsWith('amazon') || c.subtype === 'product') {
    s = s
      .replace(/^Amazon\.[a-z.]+\s*:\s*/i, '')
      .replace(/^Buy\s+/i, '')
      .replace(/\s*:\s*(?:Books|Kindle Store|Electronics|Audible Books & Originals|Amazon\.[a-z.]+.*)$/i, '')
      .replace(/\s*:\s*(?:97[89])?\d{9}[\dX]\s*$/i, '')
      .replace(/\s*:\s*[A-Z][\p{L}'’.-]+,\s*[A-Z][\p{L}'’.-]+(?:\s[A-Z][\p{L}'’.-]+)*\s*$/u, '')
      .replace(/\s+Book Online at Low Prices in India.*$/i, '');
  }
  for (let i = 0; i < 2; i++) s = s.replace(SITE_SUFFIX, '');
  if (c.subtype === 'medium' || /medium\.com$/.test(c.domain)) s = s.replace(/\s*\|\s*by [^|]+$/i, '');
  s = s.replace(/\s*-\s*Apps on Google Play$/i, '').replace(/\s+on the App Store$/i, '').replace(/\s*\|\s*by\s.+\|\s*$/i, '');
  s = s.trim();
  return { title: s || raw.trim() };
}

function cleanDescription(d: string | undefined): string | undefined {
  if (!d) return undefined;
  const s = d.replace(/\s+/g, ' ').trim();
  if (!s) return undefined;
  return s.length > 320 ? s.slice(0, 317).trimEnd() + '…' : s;
}

function derivedTitle(c: Classified): string {
  if (c.title) return c.title;
  return `${c.domain}${(() => {
    try {
      const p = new URL(c.url).pathname;
      return p === '/' ? '' : p.length > 48 ? p.slice(0, 47) + '…' : p;
    } catch {
      return '';
    }
  })()}`;
}

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"'“”‘’]+/gi;
const postCache = new WeakMap<Bookmark, Hit[]>();

function applyCard(h: Hit, card: NonNullable<Bookmark['card']>, rank: number) {
  if (card.title && rank > h.titleRank) {
    const t = cleanCardTitle(card.title, h.c);
    if (t.title) {
      h.title = t.title;
      h.titleRank = rank;
    }
    if (t.description && !h.description) h.description = t.description;
  }
  const d = cleanDescription(card.description);
  if (d && !h.description) h.description = d;
  if (card.image && !h.image) h.image = card.image;
  if (card.domain && !h.cardDomain) h.cardDomain = card.domain;
  h.cardText = `${card.title ?? ''} ${card.description ?? ''}`.trim() || h.cardText;
}

/** Every resource referenced by one post (deduped within the post). Cached per bookmark object. */
function hitsFor(b: Bookmark): Hit[] {
  const cached = postCache.get(b);
  if (cached) return cached;
  const hits: Hit[] = [];
  const byKey = new Map<string, Hit>();
  const add = (raw: string, who: Author): Hit | undefined => {
    const c = classifyUrl(raw);
    if (!c) return undefined;
    const existing = byKey.get(c.key);
    if (existing) return existing;
    const h: Hit = { c, titleRank: 0, who };
    byKey.set(c.key, h);
    hits.push(h);
    return h;
  };

  let lastLink: Hit | undefined;
  for (const l of b.links) lastLink = add(l.url, b.author) ?? lastLink;

  const card = b.card;
  if (card && (card.title || card.image || card.description)) {
    const cc = card.url ? classifyUrl(card.url) : null;
    if (cc) {
      const target = byKey.get(cc.key) ?? add(card.url, b.author);
      if (target) applyCard(target, card, 3);
    } else if (lastLink && (!card.url || /^https?:\/\/t\.co\//i.test(card.url))) {
      // Unexpanded t.co card: X attaches the card to the last link in the post.
      applyCard(lastLink, card, 2);
    }
  }

  const qt = b.quoted?.text;
  if (qt && qt.includes('http')) for (const m of qt.matchAll(URL_IN_TEXT)) add(m[0], b.quoted!.author);
  if (!b.links.length && b.text.includes('http')) {
    for (const m of b.text.matchAll(URL_IN_TEXT)) if (!m[0].endsWith('…')) add(m[0], b.author);
  }

  if (b.article?.title) {
    hits.push({
      c: { type: 'article', subtype: 'x-article', key: `x-article:${b.id}`, url: b.url, domain: 'x.com', title: b.article.title },
      title: b.article.title,
      titleRank: 3,
      description: cleanDescription(b.article.preview),
      image: b.article.cover,
      who: b.author,
    });
  }

  for (const h of hits) {
    h.c = refine(h, b.text);
    if (!h.title) {
      h.title = derivedTitle(h.c);
      h.titleRank = h.c.title ? 1 : 0.5;
    }
  }
  postCache.set(b, hits);
  return hits;
}

/** Resources found in a single post (deduped), for detail views and tests. */
export function resourcesInPost(b: Bookmark): Array<Classified & { title: string; description?: string; image?: string }> {
  return hitsFor(b).map((h) => ({ ...h.c, title: h.title ?? derivedTitle(h.c), description: h.description, image: h.image }));
}

/* ------------------------------------------------------------------ */
/* Aggregation                                                         */
/* ------------------------------------------------------------------ */

const KIND: Record<string, string> = {
  gist: 'Gist', npm: 'Package', pypi: 'Package', crates: 'Crate', go: 'Go module', package: 'Package', sandbox: 'Sandbox', notebook: 'Notebook',
  pdf: 'PDF', doi: 'Paper', arxiv: 'Paper',
  short: 'Short link', 'yt-short': 'Short', channel: 'Channel', 'youtube-playlist': 'Playlist',
  newsletter: 'Newsletter', publication: 'Publication', wikipedia: 'Wiki', 'x-article': 'X Article', news: 'News',
  'app-store': 'iOS app', 'play-store': 'Android app', 'chrome-extension': 'Extension', 'firefox-addon': 'Add-on', 'vscode-extension': 'VS Code ext', 'product-hunt': 'Launch', product: 'Product', app: 'App', site: 'Site', figma: 'Figma',
  'hf-model': 'Model', model: 'Model', 'kaggle-model': 'Model', 'hf-dataset': 'Dataset', 'hf-space': 'Space', 'hf-collection': 'Collection', 'kaggle-competition': 'Competition', 'kaggle-notebook': 'Notebook',
  board: 'Job board', careers: 'Careers',
  discussion: 'Discussion', music: 'Music', place: 'Place', image: 'Image', 'google-doc': 'Google Doc', 'google-sheet': 'Sheet', 'google-slides': 'Slides', 'google-form': 'Form', 'google-drive': 'Drive file', notion: 'Notion', 'figma-file': 'Figma file', document: 'Document',
};

export function kindLabel(c: Pick<Classified, 'type' | 'subtype'>): string {
  return KIND[c.subtype] ?? RESOURCE_META[c.type].one;
}

interface Agg {
  c: Classified;
  title: string;
  titleRank: number;
  description?: string;
  image?: string;
  posts: Bookmark[];
  first: number;
  last: number;
  sharers: Map<string, Sharer>;
}

const emptyCounts = (): Record<ResourceType, number> => ({ repo: 0, paper: 0, video: 0, article: 0, tool: 0, book: 0, course: 0, podcast: 0, docs: 0, dataset: 0, job: 0, other: 0 });

/** Extract, dedupe and aggregate every resource across the library. */
export function buildShelf(bookmarks: readonly Bookmark[], opts: { includeArchived?: boolean } = {}): Shelf {
  const t0 = performance.now();
  const acc = new Map<string, Agg>();
  let posts = 0;
  for (const b of bookmarks) {
    if (b.archived && !opts.includeArchived) continue;
    const hits = hitsFor(b);
    if (!hits.length) continue;
    posts++;
    for (const h of hits) {
      let a = acc.get(h.c.key);
      if (!a) {
        a = { c: h.c, title: h.title ?? derivedTitle(h.c), titleRank: h.titleRank, description: h.description, image: h.image, posts: [], first: b.savedAt, last: b.savedAt, sharers: new Map() };
        acc.set(h.c.key, a);
      } else {
        if (h.titleRank > a.titleRank && h.title) {
          a.title = h.title;
          a.titleRank = h.titleRank;
        }
        if (!a.description && h.description) a.description = h.description;
        if (!a.image && h.image) a.image = h.image;
        if (a.c.type === 'tool' && a.c.subtype === 'product' && h.c.type === 'book') a.c = h.c;
        if (b.savedAt < a.first) a.first = b.savedAt;
        if (b.savedAt > a.last) a.last = b.savedAt;
      }
      a.posts.push(b);
      const hk = h.who.handle.toLowerCase();
      const s = a.sharers.get(hk);
      if (s) {
        s.count++;
        if (b.savedAt > s.last) s.last = b.savedAt;
      } else a.sharers.set(hk, { handle: h.who.handle, name: h.who.name, avatar: h.who.avatar, count: 1, last: b.savedAt });
    }
  }

  const counts = emptyCounts();
  const resources: Resource[] = [];
  const byKey = new Map<string, Resource>();
  for (const a of acc.values()) {
    if (a.posts.length > 1) a.posts.sort((x, y) => y.savedAt - x.savedAt);
    const sharers = [...a.sharers.values()];
    if (sharers.length > 1) sharers.sort((x, y) => y.count - x.count || y.last - x.last);
    const kind = kindLabel(a.c);
    const r: Resource = {
      ...a.c,
      kind,
      title: a.title,
      description: a.description,
      image: a.image,
      postIds: a.posts.map((p) => p.id),
      count: a.posts.length,
      firstSavedAt: a.first,
      lastSavedAt: a.last,
      sharers,
    };
    counts[r.type]++;
    resources.push(r);
    byKey.set(r.key, r);
  }
  resources.sort((x, y) => y.lastSavedAt - x.lastSavedAt);
  return { resources, byKey, counts, total: resources.length, posts, ms: performance.now() - t0 };
}

let memo: { input: readonly Bookmark[]; archived: boolean; shelf: Shelf } | null = null;

/** `buildShelf` memoized on the library array identity (shared by Shelf and the Home widget). */
export function getShelf(bookmarks: readonly Bookmark[], opts: { includeArchived?: boolean } = {}): Shelf {
  const archived = !!opts.includeArchived;
  if (memo && memo.input === bookmarks && memo.archived === archived) return memo.shelf;
  const shelf = buildShelf(bookmarks, opts);
  memo = { input: bookmarks, archived, shelf };
  return shelf;
}

/** The memoized shelf for this exact library array, if it has been built. */
export function peekShelf(bookmarks: readonly Bookmark[], opts: { includeArchived?: boolean } = {}): Shelf | null {
  return memo && memo.input === bookmarks && memo.archived === !!opts.includeArchived ? memo.shelf : null;
}

const yieldTask = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Build the shelf without blocking the UI: posts are read in ~`budgetMs`
 * slices (each post's resources are cached), then aggregated in one short
 * pass. `shelf.ms` reports the total active (non-yielded) time.
 */
export async function prepareShelf(bookmarks: readonly Bookmark[], opts: { includeArchived?: boolean; budgetMs?: number; signal?: AbortSignal } = {}): Promise<Shelf> {
  const hit = peekShelf(bookmarks, opts);
  if (hit) return hit;
  const budget = opts.budgetMs ?? 8;
  let active = 0;
  let t = performance.now();
  for (let i = 0; i < bookmarks.length; i++) {
    const b = bookmarks[i]!;
    if (!b.archived || opts.includeArchived) hitsFor(b);
    if ((i & 63) === 63 && performance.now() - t > budget) {
      active += performance.now() - t;
      await yieldTask();
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      t = performance.now();
    }
  }
  active += performance.now() - t;
  const built = peekShelf(bookmarks, opts);
  if (built) return built;
  const shelf = getShelf(bookmarks, opts);
  shelf.ms += active;
  return shelf;
}

/* ------------------------------------------------------------------ */
/* Search, sort, export, library hand-off                              */
/* ------------------------------------------------------------------ */

export type ShelfSort = 'shared' | 'recent' | 'az';

export const SHELF_SORT_LABELS: Record<ShelfSort, string> = {
  shared: 'Most shared',
  recent: 'Recently saved',
  az: 'A–Z',
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function sortResources(list: readonly Resource[], sort: ShelfSort): Resource[] {
  const arr = list.slice();
  if (sort === 'shared') arr.sort((a, b) => b.count - a.count || b.sharers.length - a.sharers.length || b.lastSavedAt - a.lastSavedAt);
  else if (sort === 'recent') arr.sort((a, b) => b.lastSavedAt - a.lastSavedAt || b.count - a.count);
  else arr.sort((a, b) => collator.compare(a.title.replace(/^[^\p{L}\p{N}]+/u, ''), b.title.replace(/^[^\p{L}\p{N}]+/u, '')));
  return arr;
}

/**
 * Filter by type and a search query. Words must all match (title,
 * description, domain, URL, sharers); supports `from:@handle`,
 * `site:`/`domain:` and `type:` operators and "quoted phrases".
 */
export function filterResources(list: readonly Resource[], query: string, type: ResourceType | 'all' = 'all'): Resource[] {
  const words: string[] = [];
  const from: string[] = [];
  const sites: string[] = [];
  let qType: ResourceType | null = null;
  const re = /(-?)(\w+):("[^"]*"|\S+)|"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  const q = query.toLowerCase();
  while ((m = re.exec(q))) {
    if (m[2]) {
      const v = m[3]!.replace(/^"|"$/g, '');
      if (m[2] === 'from' || m[2] === 'by') from.push(v.replace(/^@/, ''));
      else if (m[2] === 'site' || m[2] === 'domain') sites.push(v.replace(/^https?:\/\//, '').replace(/^www\./, ''));
      else if (m[2] === 'type' || m[2] === 'is') qType = typeFromSlug(v) ?? qType;
      else words.push(m[0]);
    } else if (m[4] !== undefined) {
      if (m[4].trim()) words.push(m[4].trim());
    } else if (m[5]) words.push(m[5]);
  }
  const t = qType ?? (type === 'all' ? null : type);
  if (!t && !words.length && !from.length && !sites.length) return list.slice();
  return list.filter((r) => {
    if (t && r.type !== t) return false;
    if (sites.length && !sites.every((s) => r.domain === s || r.domain.endsWith('.' + s) || r.domain.includes(s))) return false;
    if (from.length && !from.every((f) => r.sharers.some((s) => s.handle.toLowerCase() === f || s.handle.toLowerCase().startsWith(f)))) return false;
    if (words.length) {
      const h = haystackOf(r);
      for (const w of words) if (!h.includes(w)) return false;
    }
    return true;
  });
}

const haystacks = new WeakMap<Resource, string>();

/** Lowercased search text for a resource (built lazily, on first search). */
function haystackOf(r: Resource): string {
  let h = haystacks.get(r);
  if (h === undefined) {
    h = `${r.title}\n${r.description ?? ''}\n${r.domain}\n${r.url}\n${r.kind}\n${RESOURCE_META[r.type].label}\n${r.sharers.map((x) => `@${x.handle} ${x.name}`).join(' ')}`.toLowerCase();
    haystacks.set(r, h);
  }
  return h;
}

/** Library search that finds the posts referencing a resource (`#/library/all?q=…`). */
export function libraryQuery(r: Pick<Resource, 'subtype' | 'id' | 'url' | 'domain' | 'key'>): string {
  let needle: string;
  if (r.subtype === 'github' && r.id) needle = `github.com/${r.id}`;
  else if (r.id && r.id.length >= 5 && !r.id.includes(' ') && r.url.toLowerCase().includes(r.id.toLowerCase())) needle = r.id;
  else {
    try {
      const u = new URL(r.url);
      needle = `${u.host.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`;
      if (u.pathname === '/' || u.pathname.length < 2) return `domain:${r.domain}`;
    } catch {
      return `domain:${r.domain}`;
    }
  }
  return `"${needle.toLowerCase().replace(/"/g, '')}"`;
}

const mdText = (s: string) => s.replace(/([\\[\]*_`<>])/g, '\\$1').replace(/\s+/g, ' ').trim();
const mdUrl = (s: string) => s.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\s/g, '%20');
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Markdown export grouped by type: title, URL, who shared it and how often it was saved. */
export function shelfToMarkdown(list: readonly Resource[], o: { heading?: string; scope?: string; now?: number } = {}): string {
  const now = o.now ?? Date.now();
  const lines: string[] = [`# ${o.heading ?? 'Shelf'}`, '', `Resources from my saved X posts — exported from twtdash on ${isoDay(now)}${o.scope ? ` · ${o.scope}` : ''} · ${list.length} ${list.length === 1 ? 'resource' : 'resources'}`, ''];
  for (const t of RESOURCE_TYPES) {
    const items = list.filter((r) => r.type === t);
    if (!items.length) continue;
    lines.push(`## ${RESOURCE_META[t].label} (${items.length})`, '');
    for (const r of items) {
      const desc = r.description ? ` — ${mdText(r.description.length > 160 ? r.description.slice(0, 157) + '…' : r.description)}` : '';
      lines.push(`- [${mdText(r.title)}](${mdUrl(r.url)})${desc}`);
      const who = r.sharers.slice(0, 5).map((s) => `@${s.handle}`).join(', ') + (r.sharers.length > 5 ? ` +${r.sharers.length - 5} more` : '');
      lines.push(`  - Shared by ${who || 'unknown'} · saved in ${r.count} ${r.count === 1 ? 'post' : 'posts'} · last saved ${isoDay(r.lastSavedAt)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
