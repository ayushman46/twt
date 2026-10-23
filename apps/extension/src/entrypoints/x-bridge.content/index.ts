/**
 * Isolated-world bridge on x.com: forwards captured data to the background,
 * runs auto-scroll syncs, and shows the on-page twtdash UI.
 */
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { isMainEnvelope, type MainMessage } from '@/lib/bridge-protocol';
import { send, type IngestSummary, type SyncTask } from '@/lib/messages';
import { getSettings } from '@/lib/storage';
import { findRetryButton, findViewerHandle, isLoggedOut, scrapeTweet } from './scrape';
import { Overlay } from './overlay';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_start',
  noScriptStartedPostMessage: true,
  main(ctx) {
    void start(ctx);
  },
});

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Page-level timeline stats, counted from page load so early batches aren't missed. */
const pageStats = {
  found: 0,
  added: 0,
  batches: 0,
  lastBatchAt: 0,
  ended: false,
  zeroNewStreak: 0,
};

let overlay: Overlay | null = null;
const getOverlay = () => (overlay ??= new Overlay());
let runner: SyncRunner | null = null;

function contextAlive(): boolean {
  return Boolean(browser.runtime?.id);
}

async function forward(msg: MainMessage) {
  if (!contextAlive()) return;
  try {
    switch (msg.kind) {
      case 'timeline': {
        const res = await send('capture/timeline', {
          source: msg.source,
          op: msg.op,
          tweets: msg.tweets,
          entryCount: msg.entryCount,
          folderId: msg.folderId,
        });
        onBatch(res, msg.tweets.length, msg.entryCount);
        return;
      }
      case 'saved': {
        const tweet = msg.tweet ?? scrapeTweet(msg.tweetId);
        const res = await send('capture/saved', {
          source: msg.source,
          tweetId: msg.tweetId,
          tweet,
          partial: !msg.tweet,
          folderId: msg.folderId,
        });
        const settings = await getSettings();
        if (res.ok && res.isNew && settings.toasts) {
          const cat = res.category ? `${res.category.emoji} ${res.category.name}` : 'Your library';
          getOverlay().toast(msg.source === 'like' ? 'Like saved to twtdash' : 'Saved to twtdash', cat);
        }
        return;
      }
      case 'removed':
        await send('capture/removed', { source: msg.source, tweetId: msg.tweetId });
        return;
      case 'folders':
        await send('capture/folders', { folders: msg.folders });
        return;
    }
  } catch (err) {
    console.debug('[twtdash] capture failed', err);
  }
}

function onBatch(res: IngestSummary, tweetCount: number, entryCount: number) {
  pageStats.batches++;
  pageStats.found += res.count;
  pageStats.added += res.added;
  pageStats.lastBatchAt = Date.now();
  // The last page of a timeline only contains cursor entries.
  if (tweetCount === 0 && entryCount > 0 && entryCount <= 3) pageStats.ended = true;
  if (res.count > 0 && res.added === 0) pageStats.zeroNewStreak++;
  else if (res.added > 0) pageStats.zeroNewStreak = 0;
  runner?.render();
  if (overlay?.pillVisible) void refreshPill();
}

async function start(ctx: ContentScriptContext) {
  const listener = (e: MessageEvent) => {
    if (e.source !== window || !isMainEnvelope(e.data)) return;
    void forward(e.data.msg);
  };
  window.addEventListener('message', listener);
  ctx.onInvalidated(() => window.removeEventListener('message', listener));

  browser.runtime.onMessage.addListener((msg: unknown) => {
    if ((msg as { type?: string })?.type === 'sync/abort') runner?.stop('stopped');
    return false;
  });

  if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));

  void reportViewer();

  const { task } = await send('sync/claim', {}).catch(() => ({ task: null }));
  if (task) {
    runner = new SyncRunner(task);
    void runner.run();
  } else {
    void refreshPill();
  }

  ctx.addEventListener(window, 'wxt:locationchange', () => {
    if (!runner) void refreshPill();
  });
}

async function reportViewer() {
  for (let i = 0; i < 20; i++) {
    const handle = findViewerHandle();
    if (handle) {
      await send('capture/viewer', { handle }).catch(() => undefined);
      return;
    }
    await sleep(750);
  }
}

const PILL_DISMISSED_KEY = 'twtdash:pill-dismissed';

async function refreshPill() {
  if (!contextAlive()) return;
  const onBookmarks = /^\/i\/bookmarks/.test(location.pathname);
  const settings = await getSettings().catch(() => null);
  if (!onBookmarks || !settings?.pageButton || sessionStorage.getItem(PILL_DISMISSED_KEY)) {
    overlay?.hidePill();
    return;
  }
  const stats = await send('stats/get', {}).catch(() => null);
  const total = stats?.total ?? 0;
  getOverlay().showPill({
    label: total ? `${new Intl.NumberFormat().format(total)} in twtdash` : 'twtdash',
    onSync: () => void send('sync/start', { source: 'bookmark', mode: total ? 'quick' : 'full' }),
    onOpen: () => void send('open/dashboard', {}),
    onDismiss: () => {
      sessionStorage.setItem(PILL_DISMISSED_KEY, '1');
      overlay?.hidePill();
    },
  });
}

class SyncRunner {
  private stopped = false;
  private finished = false;
  private paused = false;
  private message = '';

  constructor(private task: SyncTask) {}

  private get label() {
    return this.task.source === 'like' ? 'likes' : 'bookmarks';
  }

  render() {
    if (this.finished) return;
    const o = getOverlay();
    o.showSync({
      state: this.paused ? 'paused' : 'running',
      title: this.paused ? 'Sync paused' : `Syncing your ${this.label}…`,
      subtitle: this.paused
        ? 'Come back to this tab to continue.'
        : this.task.mode === 'quick'
          ? 'Quick sync — stops when it reaches posts you already have.'
          : 'Full sync — scrolling through everything you saved.',
      found: pageStats.found,
      added: pageStats.added,
      hint: this.message || 'Keep this tab open and visible. You can keep using your computer.',
      onStop: () => this.stop('stopped'),
    });
  }

  stop(status: 'stopped' | 'done' | 'error', message?: string) {
    if (this.stopped) return;
    this.stopped = true;
    void this.finish(status, message);
  }

  private async finish(status: 'done' | 'stopped' | 'error', message?: string) {
    if (this.finished) return;
    this.finished = true;
    await send('sync/finish', { runId: this.task.runId, status, message }).catch(() => undefined);
    const o = getOverlay();
    const noun = this.label;
    o.showSync({
      state: status === 'error' ? 'error' : 'done',
      title: status === 'error' ? 'Sync needs attention' : status === 'stopped' ? 'Sync stopped' : `All ${noun} synced`,
      subtitle:
        message ??
        (pageStats.added
          ? `${new Intl.NumberFormat().format(pageStats.added)} new ${noun} added and auto-categorized.`
          : `Your library is up to date.`),
      found: pageStats.found,
      added: pageStats.added,
      onOpen: () => void send('open/dashboard', { hash: '#/library' }),
      onClose: () => o.hideSync(),
    });
    window.scrollTo({ top: 0 });
  }

  async run() {
    this.render();

    if (isLoggedOut()) {
      this.stop('error', 'Log in to X in this tab, then press Sync again.');
      return;
    }

    // Likes live on the profile — navigate there first if needed.
    if (this.task.source === 'like' && !/\/likes\/?$/.test(location.pathname)) {
      let handle = this.task.viewerHandle ?? null;
      for (let i = 0; !handle && i < 20; i++) {
        await sleep(500);
        handle = findViewerHandle();
      }
      if (!handle) {
        this.stop('error', "Couldn't find your profile. Make sure you're logged in to X.");
        return;
      }
      location.assign(`/${handle}/likes`);
      return;
    }

    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden;
      this.render();
    });

    // Give the first page time to load.
    const t0 = Date.now();
    while (!pageStats.batches && Date.now() - t0 < 12_000 && !this.stopped) await sleep(300);

    let lastHeight = 0;
    let idleRounds = 0;
    let retries = 0;
    const delay = this.task.mode === 'quick' ? 650 : 850;

    while (!this.stopped) {
      if (document.hidden) {
        await sleep(500);
        continue;
      }
      const articles = document.querySelectorAll('article');
      articles[articles.length - 1]?.scrollIntoView({ block: 'end' });
      window.scrollTo({ top: document.documentElement.scrollHeight });
      await sleep(delay + Math.random() * 300);

      if (pageStats.ended) break;
      if (this.task.mode === 'quick' && pageStats.zeroNewStreak >= 2) break;

      const height = document.documentElement.scrollHeight;
      const quietFor = Date.now() - pageStats.lastBatchAt;
      if (height === lastHeight && quietFor > 2500) {
        idleRounds++;
        const retry = findRetryButton();
        if (retry) {
          retries++;
          if (retries > 6) {
            this.stop('error', 'X is rate-limiting requests. Wait a few minutes and run sync again — it will pick up where it left off.');
            return;
          }
          this.message = `X asked us to slow down — retrying in ${Math.min(60, 5 * retries)}s…`;
          this.render();
          await sleep(Math.min(60_000, 5_000 * retries));
          retry.click();
          this.message = '';
          idleRounds = 0;
          continue;
        }
        // Nudge X's infinite scroll.
        window.scrollBy({ top: -900 });
        await sleep(350);
        if (idleRounds >= (pageStats.batches ? 8 : 4)) break;
      } else {
        idleRounds = 0;
      }
      lastHeight = height;
    }

    if (!this.stopped) {
      this.stopped = true;
      if (!pageStats.batches) {
        await this.finish('error', "Couldn't load your bookmarks. Make sure you're logged in, then try again.");
        return;
      }
      await this.finish('done');
    }
  }
}
