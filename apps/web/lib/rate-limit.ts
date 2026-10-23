/**
 * In-memory sliding-window rate limiter for the hosted categorize API.
 *
 * Limits per license key:
 *   - 30 requests per rolling minute
 *   - 3,000 posts per rolling 24 hours
 *
 * IMPORTANT: this state lives in the memory of a single server instance.
 * Serverless platforms (Vercel, etc.) run many short-lived instances that do
 * NOT share memory, so these limits are best-effort only. For production,
 * swap this module for a shared store such as Upstash Redis
 * (`@upstash/ratelimit`) or any Redis with sorted sets — the
 * `checkRateLimit` / `recordPosts` interface is all the route depends on.
 */

export const REQUESTS_PER_MINUTE = 30;
export const POSTS_PER_DAY = 3_000;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60_000;
const MAX_TRACKED_KEYS = 10_000;

interface Usage {
  /** Timestamps of accepted requests in the last minute. */
  requests: number[];
  /** [timestamp, postCount] entries in the last 24 hours. */
  posts: Array<[number, number]>;
  lastSeen: number;
}

const usage = new Map<string, Usage>();
let callsSinceSweep = 0;

function prune(entry: Usage, now: number): void {
  while (entry.requests.length > 0 && entry.requests[0]! <= now - MINUTE_MS) entry.requests.shift();
  while (entry.posts.length > 0 && entry.posts[0]![0] <= now - DAY_MS) entry.posts.shift();
}

function sweep(now: number): void {
  for (const [key, entry] of usage) {
    prune(entry, now);
    if (entry.requests.length === 0 && entry.posts.length === 0) usage.delete(key);
  }
  // Hard cap: drop the least recently seen keys if we're still too big.
  if (usage.size > MAX_TRACKED_KEYS) {
    const byAge = [...usage.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    for (const [key] of byAge.slice(0, usage.size - MAX_TRACKED_KEYS)) usage.delete(key);
  }
}

function getEntry(key: string, now: number): Usage {
  if (++callsSinceSweep >= 500) {
    callsSinceSweep = 0;
    sweep(now);
  }
  let entry = usage.get(key);
  if (!entry) {
    entry = { requests: [], posts: [], lastSeen: now };
    usage.set(key, entry);
  }
  entry.lastSeen = now;
  prune(entry, now);
  return entry;
}

export type RateLimitResult =
  | { ok: true; remainingRequests: number; remainingPosts: number }
  | { ok: false; message: string; retryAfterSeconds: number };

/**
 * Check both windows for `key` and, if allowed, count this request against the
 * per-minute window. Posts are only counted once the request succeeds — call
 * `recordPosts` afterwards — so failed upstream calls don't eat the daily quota.
 */
export function checkRateLimit(key: string, postCount: number, now = Date.now()): RateLimitResult {
  const entry = getEntry(key, now);

  if (entry.requests.length >= REQUESTS_PER_MINUTE) {
    const retryAfterMs = entry.requests[0]! + MINUTE_MS - now;
    return {
      ok: false,
      message: `Too many requests — the limit is ${REQUESTS_PER_MINUTE} per minute.`,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  const postsToday = entry.posts.reduce((sum, [, n]) => sum + n, 0);
  if (postsToday + postCount > POSTS_PER_DAY) {
    // Find when enough of the window expires to fit this request.
    let freed = 0;
    let retryAt = now + DAY_MS;
    const needed = postsToday + postCount - POSTS_PER_DAY;
    for (const [ts, n] of entry.posts) {
      freed += n;
      if (freed >= needed) {
        retryAt = ts + DAY_MS;
        break;
      }
    }
    const remaining = Math.max(0, POSTS_PER_DAY - postsToday);
    return {
      ok: false,
      message: `Daily AI limit reached — ${POSTS_PER_DAY.toLocaleString("en-US")} posts per 24 hours (${remaining.toLocaleString("en-US")} left).`,
      retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1000)),
    };
  }

  entry.requests.push(now);
  return {
    ok: true,
    remainingRequests: REQUESTS_PER_MINUTE - entry.requests.length,
    remainingPosts: POSTS_PER_DAY - postsToday,
  };
}

/** Count successfully categorized posts against the daily window. */
export function recordPosts(key: string, postCount: number, now = Date.now()): void {
  if (postCount <= 0) return;
  getEntry(key, now).posts.push([now, postCount]);
}
