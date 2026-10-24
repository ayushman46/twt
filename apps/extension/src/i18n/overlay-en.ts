/**
 * Strings for the on-x.com overlay (content script). English is built in;
 * extension pages write the active language's versions to storage so the
 * content script never has to bundle other languages.
 */
import { storage } from 'wxt/utils/storage';

export const OVERLAY_EN = {
  'overlay.found': 'found',
  'overlay.new': 'new',
  'overlay.openDashboard': 'Open dashboard',
  'overlay.stop': 'Stop',
  'overlay.close': 'Close',
  'overlay.sync': 'Sync',
  'overlay.open': 'Open',
  'overlay.hideButton': 'Hide twtdash button',
  'overlay.saved': 'Saved to twtdash',
  'overlay.likeSaved': 'Like saved to twtdash',
  'overlay.yourLibrary': 'Your library',
  'overlay.inTwtdash': '{count} in twtdash',
  'overlay.syncingBookmarks': 'Syncing your bookmarks…',
  'overlay.syncingLikes': 'Syncing your likes…',
  'overlay.paused': 'Sync paused',
  'overlay.pausedSub': 'Come back to this tab to continue.',
  'overlay.quickSub': 'Quick sync — stops when it reaches posts you already have.',
  'overlay.fullSub': 'Full sync — scrolling through everything you saved.',
  'overlay.hint': 'Keep this tab open and visible. You can keep using your computer.',
  'overlay.needsAttention': 'Sync needs attention',
  'overlay.stopped': 'Sync stopped',
  'overlay.allBookmarksSynced': 'All bookmarks synced',
  'overlay.allLikesSynced': 'All likes synced',
  'overlay.addedBookmarks': '{count} new bookmarks added and auto-categorized.',
  'overlay.addedLikes': '{count} new likes added and auto-categorized.',
  'overlay.upToDate': 'Your library is up to date.',
  'overlay.loggedOut': 'Log in to X in this tab, then press Sync again.',
  'overlay.noProfile': 'Couldn’t find your profile. Make sure you’re logged in to X.',
  'overlay.rateLimited': 'X is rate-limiting requests. Wait a few minutes and run sync again — it will pick up where it left off.',
  'overlay.slowDown': 'X asked us to slow down — retrying in {seconds}s…',
  'overlay.loadFailed': 'Couldn’t load your bookmarks. Make sure you’re logged in, then try again.',
};

export type OverlayKey = keyof typeof OVERLAY_EN;

export interface OverlayStrings {
  /** BCP 47 locale for number formatting, e.g. "hi-IN-u-nu-latn". */
  locale: string;
  /** Translated overlay strings (missing keys fall back to English). */
  strings: Partial<Record<OverlayKey, string>>;
}

export const overlayStringsItem = storage.defineItem<OverlayStrings | null>('local:i18nOverlay', { fallback: null });
