import { Menu as MenuIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { browser } from 'wxt/browser';
import { t, useT } from '@/i18n';
import { AiError, aiReady, pendingAiCount } from '@/lib/ai-config';
import { ensureCategories } from '@/lib/db';
import { licenseNeedsCheck, validateLicense } from '@/lib/license';
import { unseenItem, type ViewMode } from '@/lib/storage';
import { useSettings, useThemeClass } from '@/hooks/data';
import { LibraryProvider, useLibrary } from '@/hooks/library';
import { navigate, useRoute } from '@/hooks/route';
import { useUi } from '@/store/ui';
import { Logo, Wordmark } from '@/components/Brand';
import { CommandPalette } from '@/components/CommandPalette';
import { DemoBanner } from '@/components/DemoBanner';
import { CollectionDialog, ShortcutsDialog } from '@/components/Dialogs';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';
import { Sidebar } from '@/components/Sidebar';
import { TooltipProvider } from '@/components/ui/overlays';
import { HomeView } from '@/views/HomeView';
import { LibraryView } from '@/views/LibraryView';
import { WelcomeView } from '@/views/WelcomeView';

import { loadAsk, loadInsights, loadRecall, loadShelf, loadWrapped, warmLaterScreens } from '@/lazy-screens';
import { SettingsView } from '@/views/SettingsView';

// Heavy, rarely-first screens load on demand (charts library, settings forms).
const InsightsView = lazy(() => loadInsights().then((m) => ({ default: m.InsightsView })));
const RecallView = lazy(() => loadRecall().then((m) => ({ default: m.RecallView })));
const ShelfView = lazy(() => loadShelf().then((m) => ({ default: m.ShelfView })));
const AskView = lazy(() => loadAsk().then((m) => ({ default: m.AskView })));
const WrappedView = lazy(() => loadWrapped().then((m) => ({ default: m.WrappedView })));

function ScreenFallback() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pt-8 sm:px-8">
      <div className="skeleton h-8 w-44 rounded-lg" />
      <div className="skeleton mt-6 h-[320px] rounded-2xl" />
    </div>
  );
}

const VIEW_KEYS: Record<string, ViewMode> = { '1': 'grid', '2': 'list', '3': 'table', '4': 'gallery' };

function isTyping(e: KeyboardEvent) {
  return !!(e.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
}

function Shell() {
  useT();
  const route = useRoute();
  const [settings, update, loaded] = useSettings();
  const lib = useLibrary();
  const [drawer, setDrawer] = useState(false);
  const setQuery = useUi((s) => s.setQuery);
  const setAi = useUi((s) => s.setAi);
  const aiRunning = useUi((s) => s.ai.running);
  const abortRef = useRef<AbortController | null>(null);
  useThemeClass(settings.theme);

  // Deep link: #/library/all?q=…
  useEffect(() => {
    if (route.q !== undefined) setQuery(route.q);
  }, [route.q, setQuery]);

  useEffect(() => {
    void ensureCategories();
    const clearBadge = () => void unseenItem.setValue(0);
    clearBadge();
    window.addEventListener('focus', clearBadge);
    // Let the background focus this tab instead of opening a new one.
    const onMsg = (msg: unknown, _sender: unknown, sendResponse: (r: unknown) => void) => {
      const m = msg as { type?: string; hash?: string };
      if (m?.type !== 'dashboard/focus') return false;
      void browser.tabs.getCurrent().then((tab) => {
        if (m.hash) navigate(m.hash);
        sendResponse({ tabId: tab?.id, windowId: tab?.windowId });
      });
      return true;
    };
    browser.runtime.onMessage.addListener(onMsg);
    return () => {
      window.removeEventListener('focus', clearBadge);
      browser.runtime.onMessage.removeListener(onMsg);
    };
  }, []);

  // Keep the Pro license fresh.
  useEffect(() => {
    if (!loaded || !licenseNeedsCheck(settings.license)) return;
    void validateLicense(settings.license!)
      .then((license) => update({ license }))
      .catch(() => undefined);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAi = useCallback(
    async (ids?: string[], force?: boolean) => {
      if (useUi.getState().ai.running) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setAi({ running: true, done: 0, total: 0, failed: 0, error: undefined });
      try {
        const { runAiCategorization } = await import('@/lib/ai');
        const p = await runAiCategorization({ ids, force, signal: controller.signal, onProgress: (pr) => setAi({ done: pr.done, total: pr.total, failed: pr.failed }) });
        if (p.total) toast.success(t('app.aiOrganized', { count: p.done }), { description: p.failed ? t('app.aiPartial', { count: p.failed }) : undefined });
        setAi({ running: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : t('app.aiFailed');
        setAi({ running: false, error: message });
        toast.error(message, err instanceof AiError && (err.code === 'auth' || err.code === 'license' || err.code === 'config') ? { action: { label: t('nav.settings'), onClick: () => navigate('#/settings/ai') } } : undefined);
      }
    },
    [setAi],
  );

  // Auto-organize new posts with AI.
  useEffect(() => {
    if (!loaded || !settings.ai.autoRun || !aiReady(settings) || aiRunning || lib.loading) return;
    const t = setTimeout(async () => {
      if ((await pendingAiCount()) > 0) void runAi();
    }, 2500);
    return () => clearTimeout(t);
  }, [loaded, settings.ai.provider, settings.ai.autoRun, settings.ai.apiKey, settings.license?.status, lib.counts.total, aiRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global shortcuts
  useEffect(() => {
    let g = false;
    let gTimer: number | undefined;
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.setPaletteOpen(!ui.paletteOpen);
        return;
      }
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey || ui.paletteOpen) return;
      if (e.key === '?') {
        ui.setShortcutsOpen(true);
        return;
      }
      if (g) {
        g = false;
        const dest = { h: '#/home', a: '#/library/all', u: '#/library/unread', s: '#/library/starred', i: '#/insights', c: '#/settings/categories', r: '#/recall', l: '#/shelf', q: '#/ask', w: '#/wrapped' }[e.key];
        if (dest) {
          e.preventDefault();
          navigate(dest);
        }
        return;
      }
      if (e.key === 'g') {
        g = true;
        window.clearTimeout(gTimer);
        gTimer = window.setTimeout(() => (g = false), 900);
        return;
      }
      const view = VIEW_KEYS[e.key];
      if (view && route.page === 'library') ui.setView(view);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route.page]);

  useEffect(() => setDrawer(false), [route.page, route.scope.kind, route.scope.value]);

  // A post opened on one screen does not follow you to another.
  useEffect(() => useUi.getState().openDetail(null), [route.page]);

  // Once the library has fully loaded and things are quiet, warm later screens.
  useEffect(() => {
    if (!lib.loading && !lib.partial) warmLaterScreens();
  }, [lib.loading, lib.partial]);

  const fullBleedWelcome = route.page === 'welcome' && !lib.counts.total;

  const page =
    route.page === 'library' ? (
      <LibraryView route={route} settings={settings} aiAvailable={aiReady(settings)} onAi={(ids) => void runAi(ids, !!ids)} />
    ) : route.page === 'insights' ? (
      <InsightsView />
    ) : route.page === 'recall' ? (
      <RecallView />
    ) : route.page === 'shelf' ? (
      <ShelfView route={route} />
    ) : route.page === 'ask' ? (
      <AskView route={route} settings={settings} />
    ) : route.page === 'wrapped' ? (
      <WrappedView />
    ) : route.page === 'settings' ? (
      <SettingsView route={route} settings={settings} update={update} onAi={(ids, force) => void runAi(ids, force)} />
    ) : route.page === 'welcome' ? (
      <WelcomeView settings={settings} />
    ) : (
      <HomeView settings={settings} />
    );

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-bg text-fg">
        {!fullBleedWelcome ? (
          <div className="sticky top-0 hidden h-screen lg:block">
            <Sidebar route={route} />
          </div>
        ) : null}

        {drawer ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={() => setDrawer(false)} />
            <div className="relative h-full w-fit animate-rise shadow-pop">
              <Sidebar route={route} onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col">
          {!fullBleedWelcome ? (
            <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-bg px-4 lg:hidden">
              <button type="button" onClick={() => setDrawer(true)} className="grid size-8 place-items-center rounded-lg hover:bg-panel-2" aria-label={t('nav.openMenu')}>
                <MenuIcon className="size-5" />
              </button>
              <Logo className="size-6" />
              <Wordmark className="text-[15px]" />
            </div>
          ) : null}
          <DemoBanner />
          <div key={route.page} className="flex-1 animate-fade-in">
            <ScreenErrorBoundary resetKey={route.page + route.scope.kind + (route.scope.value ?? '')}>
              <Suspense fallback={<ScreenFallback />}>{page}</Suspense>
            </ScreenErrorBoundary>
          </div>
        </main>
      </div>
      <CommandPalette />
      <CollectionDialog />
      <ShortcutsDialog />
      <Toaster
        position="bottom-right"
        theme={settings.theme === 'system' ? 'system' : settings.theme}
        toastOptions={{ className: '!rounded-2xl !border-line !bg-panel !text-fg !shadow-pop !font-sans', descriptionClassName: '!text-muted' }}
      />
    </TooltipProvider>
  );
}

export function App() {
  return (
    <LibraryProvider>
      <Shell />
    </LibraryProvider>
  );
}
