import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { db, ensureCategories, uid } from '@/lib/db';
import { ingestTweets, recategorizeAll, removeSource, resetOrderCursor } from '@/lib/ingest';
import type { Message, MessageMap, MessageType, SyncTask } from '@/lib/messages';
import {
  getSettings,
  IDLE_SYNC,
  isSyncActive,
  lastSyncItem,
  syncStateItem,
  unseenItem,
  viewerItem,
  type SyncState,
} from '@/lib/storage';
import type { Collection, Source } from '@/lib/types';

const DASHBOARD_PATH = '/dashboard.html';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    await ensureCategories();
    if (reason === 'install') await openDashboard('#/welcome');
  });

  browser.runtime.onStartup.addListener(async () => {
    await ensureCategories();
    const s = await syncStateItem.getValue();
    if (isSyncActive(s)) await syncStateItem.setValue({ ...s, status: 'stopped', message: 'Browser was closed during sync.' });
    await refreshBadge();
  });

  browser.commands?.onCommand.addListener((command) => {
    if (command === 'open-dashboard') void openDashboard();
  });

  browser.tabs.onRemoved.addListener(async (tabId) => {
    const s = await syncStateItem.getValue();
    if (isSyncActive(s) && s.tabId === tabId) await finishSync(s.runId!, 'stopped', 'The X tab was closed.');
  });

  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const msg = raw as Message;
    // Messages meant for extension pages (e.g. dashboard/focus) are not ours.
    if (!msg || typeof msg.type !== 'string' || !(msg.type in handlers)) return false;
    handle(msg, sender).then(sendResponse, (err: unknown) => {
      console.error('[twtdash]', msg.type, err);
      sendResponse({ error: err instanceof Error ? err.message : String(err) });
    });
    return true;
  });

  unseenItem.watch(() => void refreshBadge());
  syncStateItem.watch(() => void refreshBadge());
  void refreshBadge();
});

type Handler<T extends MessageType> = (msg: Message<T>, sender: Browser.runtime.MessageSender) => Promise<MessageMap[T]['res']>;
type Handlers = { [T in MessageType]: Handler<T> };

const handlers: Handlers = {
  async 'capture/timeline'(msg, sender) {
    const state = await syncStateItem.getValue();
    const isSyncTab = isSyncActive(state) && sender.tab?.id === state.tabId;
    let collectionId: string | undefined;
    if (msg.folderId) collectionId = (await ensureFolderCollection(msg.folderId))?.id;
    const res = await ingestTweets(msg.tweets, { source: msg.source, collectionId });
    if (res.added) await unseenItem.setValue((await unseenItem.getValue()) + res.added);
    if (isSyncTab) {
      await syncStateItem.setValue({ ...state, status: 'running', found: state.found + res.count, added: state.added + res.added });
    }
    return { count: res.count, added: res.added, updated: res.updated };
  },

  async 'capture/saved'(msg) {
    const settings = await getSettings();
    if (msg.source === 'like' && !settings.captureLikes) return { ok: false, isNew: false };
    let collectionId: string | undefined;
    if (msg.folderId) collectionId = (await ensureFolderCollection(msg.folderId))?.id;
    if (!msg.tweet) {
      // Nothing to store yet — keep the id so the next sync fills it in.
      return { ok: false, isNew: false };
    }
    const res = await ingestTweets([{ tweet: msg.tweet }], { source: msg.source, partial: msg.partial, collectionId, savedNow: true });
    if (res.added) await unseenItem.setValue((await unseenItem.getValue()) + res.added);
    const saved = await db.bookmarks.get(msg.tweet.id);
    const cat = saved ? await db.categories.get(saved.category) : undefined;
    return { ok: true, isNew: res.added > 0, category: cat ? { name: cat.name, emoji: cat.emoji } : undefined };
  },

  async 'capture/removed'(msg) {
    const settings = await getSettings();
    if (msg.source === 'like' && !settings.captureLikes) return { ok: false };
    await removeSource(msg.tweetId, msg.source, settings.mirrorDeletions);
    return { ok: true };
  },

  async 'capture/folders'(msg) {
    for (const f of msg.folders) await ensureFolderCollection(f.id, f.name);
    return { ok: true };
  },

  async 'capture/viewer'(msg) {
    if (msg.handle) await viewerItem.setValue({ handle: msg.handle, seenAt: Date.now() });
    return { ok: true };
  },

  async 'sync/start'(msg) {
    return startSync(msg.source, msg.mode);
  },

  async 'sync/claim'(_msg, sender) {
    const s = await syncStateItem.getValue();
    if (!isSyncActive(s) || !s.runId || sender.tab?.id !== s.tabId) return { task: null };
    const viewer = await viewerItem.getValue();
    const task: SyncTask = { runId: s.runId, source: s.source, mode: s.mode, viewerHandle: viewer?.handle };
    if (s.status === 'starting') await syncStateItem.setValue({ ...s, status: 'running' });
    return { task };
  },

  async 'sync/finish'(msg) {
    await finishSync(msg.runId, msg.status, msg.message);
    return { ok: true };
  },

  async 'sync/stop'() {
    const s = await syncStateItem.getValue();
    if (isSyncActive(s) && s.runId) {
      if (s.tabId !== undefined) {
        // Tell the page to stop scrolling; it reports back via sync/finish.
        await browser.tabs.sendMessage(s.tabId, { type: 'sync/abort' }).catch(() => undefined);
      }
      await finishSync(s.runId, 'stopped', 'Stopped.');
    }
    return { ok: true };
  },

  async 'open/dashboard'(msg) {
    await openDashboard(msg.hash);
    return { ok: true };
  },

  async 'stats/get'() {
    const total = await db.bookmarks.count();
    const unread = await db.bookmarks.where('read').equals(0).count();
    // Index-only counts: no records are read or deserialized.
    const cats = await db.categories.toArray();
    const counts = await Promise.all(cats.map((c) => db.bookmarks.where('[archived+category]').equals([0, c.id]).count()));
    return {
      total,
      unread,
      categories: cats
        .map((c, i) => ({ id: c.id, count: counts[i]! }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count),
    };
  },

  async 'library/recategorize'(msg) {
    return { updated: await recategorizeAll(msg.keepAi) };
  },
};

function handle(msg: Message, sender: Browser.runtime.MessageSender): Promise<unknown> {
  const fn = handlers[msg.type] as Handler<MessageType>;
  return fn(msg as never, sender);
}

async function ensureFolderCollection(folderId: string, name?: string): Promise<Collection | undefined> {
  if (!folderId) return undefined;
  const existing = await db.collections.where('xFolderId').equals(folderId).first();
  if (existing) {
    if (name && existing.name !== name) await db.collections.update(existing.id, { name });
    return existing;
  }
  const count = await db.collections.count();
  const col: Collection = {
    id: uid('col_'),
    name: name ?? 'X folder',
    emoji: '📁',
    color: '#7C5CFF',
    description: 'Imported from your X bookmark folders',
    xFolderId: folderId,
    createdAt: Date.now(),
    order: count,
  };
  await db.collections.add(col);
  return col;
}

async function startSync(source: Source, mode: 'quick' | 'full'): Promise<{ ok: boolean; error?: string }> {
  const current = await syncStateItem.getValue();
  if (isSyncActive(current) && current.tabId !== undefined) {
    const alive = await browser.tabs.get(current.tabId).catch(() => null);
    if (alive) {
      await browser.tabs.update(current.tabId, { active: true });
      if (alive.windowId !== undefined) await browser.windows.update(alive.windowId, { focused: true }).catch(() => undefined);
      return { ok: true };
    }
  }

  const viewer = await viewerItem.getValue();
  const url = source === 'bookmark' ? 'https://x.com/i/bookmarks' : viewer?.handle ? `https://x.com/${viewer.handle}/likes` : 'https://x.com/home';

  const tab = await browser.tabs.create({ url, active: true });
  if (tab.id === undefined) return { ok: false, error: 'Could not open X.' };

  resetOrderCursor(source);
  const state: SyncState = {
    status: 'starting',
    runId: uid('run_'),
    source,
    mode,
    tabId: tab.id,
    startedAt: Date.now(),
    found: 0,
    added: 0,
  };
  await syncStateItem.setValue(state);
  return { ok: true };
}

async function finishSync(runId: string, status: 'done' | 'stopped' | 'error', message?: string) {
  const s = await syncStateItem.getValue();
  if (s.runId !== runId || !isSyncActive(s)) return;
  const finishedAt = Date.now();
  await syncStateItem.setValue({ ...s, status, finishedAt, message });
  await db.syncRuns.put({
    id: runId,
    source: s.source,
    mode: s.mode,
    startedAt: s.startedAt ?? finishedAt,
    finishedAt,
    found: s.found,
    added: s.added,
    status,
    message,
  });
  if (status === 'done' || s.found > 0) {
    const last = await lastSyncItem.getValue();
    await lastSyncItem.setValue({ ...last, [s.source]: finishedAt });
  }
}

/**
 * Focus an open dashboard tab (it answers `dashboard/focus` with its tab id —
 * this avoids needing the broad "tabs" permission) or open a new one.
 */
async function openDashboard(hash = '') {
  const reply = (await browser.runtime.sendMessage({ type: 'dashboard/focus', hash }).catch(() => null)) as
    | { tabId?: number; windowId?: number }
    | null
    | undefined;
  if (reply?.tabId !== undefined) {
    await browser.tabs.update(reply.tabId, { active: true });
    if (reply.windowId !== undefined) await browser.windows.update(reply.windowId, { focused: true }).catch(() => undefined);
    return;
  }
  await browser.tabs.create({ url: browser.runtime.getURL(DASHBOARD_PATH) + hash });
}

async function refreshBadge() {
  const [s, unseen] = await Promise.all([syncStateItem.getValue().catch(() => IDLE_SYNC), unseenItem.getValue().catch(() => 0)]);
  const action = browser.action ?? (browser as unknown as { browserAction: typeof browser.action }).browserAction;
  if (!action) return;
  if (isSyncActive(s)) {
    await action.setBadgeBackgroundColor({ color: '#7C5CFF' });
    await action.setBadgeText({ text: s.found > 999 ? `${Math.floor(s.found / 1000)}k` : s.found ? String(s.found) : '…' });
    return;
  }
  await action.setBadgeBackgroundColor({ color: '#7C5CFF' });
  await action.setBadgeText({ text: unseen > 0 ? (unseen > 99 ? '99+' : String(unseen)) : '' });
}
