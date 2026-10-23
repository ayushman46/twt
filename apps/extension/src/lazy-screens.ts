/**
 * Code-split screens. Loading starts on intent (hovering the nav link) or
 * a few seconds after the library has settled — never while it is busy.
 */
export const loadInsights = () => import('@/views/InsightsView');

let warmed = false;

/** Fetch lazy screens and fonts once the app has been quiet for a while. */
export function warmLaterScreens(delayMs = 4000) {
  if (warmed) return;
  warmed = true;
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
  setTimeout(
    () =>
      idle(
        () => {
          void loadInsights();
          void document.fonts?.load('italic 400 40px "Instrument Serif"').catch(() => undefined);
          void document.fonts?.load('600 16px "Geist Variable"').catch(() => undefined);
        },
        { timeout: 4000 },
      ),
    delayMs,
  );
}
