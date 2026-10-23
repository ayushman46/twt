/**
 * Windowed masonry. Only items near the viewport are mounted; heights are
 * estimated up front, measured once rendered, and the container always has
 * the full height so the scrollbar reflects the whole library (jumping to the
 * oldest post is instant instead of loading batch after batch).
 */
import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

export interface VirtualMasonryProps<T> {
  items: T[];
  getKey: (item: T) => string;
  /** Estimated height in px for an item at a given column width. */
  estimate: (item: T, colWidth: number) => number;
  render: (item: T, index: number) => ReactNode;
  minColWidth: number;
  maxCols: number;
  gap: number;
  /** Extra px rendered above/below the viewport. */
  overscan?: number;
  /** Fixed aspect: when set, every item is exactly colWidth * ratio tall (no measuring). */
  squareRatio?: number;
}

/** Observes its own size for the lifetime of the mount (not on every render). */
function VItem({ vkey, observer, style, children }: { vkey: string; observer: ResizeObserver | null; style: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !observer) return;
    observer.observe(el);
    return () => observer.unobserve(el);
  }, [observer]);
  return (
    <div ref={ref} data-vkey={vkey} style={{ ...style, contain: 'layout style' }}>
      {children}
    </div>
  );
}

/** Lets keyboard navigation scroll to items that aren't mounted yet. */
export const virtualRegistry: { scrollToKey?: (key: string) => boolean } = {};

export function VirtualMasonry<T>({ items, getKey, estimate, render, minColWidth, maxCols, gap, overscan = 900, squareRatio }: VirtualMasonryProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [version, setVersion] = useState(0);
  const [range, setRange] = useState({ top: 0, bottom: typeof window !== 'undefined' ? window.innerHeight : 1000 });
  const measured = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols = width ? Math.max(1, Math.min(maxCols, Math.floor((width + gap) / (minColWidth + gap)))) : 1;
  const colWidth = width ? (width - gap * (cols - 1)) / cols : minColWidth;

  // Column assignment uses estimates only, so items never jump columns as they get measured.
  const assignment = useMemo(() => {
    const colItems: number[][] = Array.from({ length: cols }, () => []);
    const heights = new Array<number>(cols).fill(0);
    const colOf = new Int32Array(items.length);
    for (let i = 0; i < items.length; i++) {
      let c = 0;
      for (let k = 1; k < cols; k++) if (heights[k]! < heights[c]!) c = k;
      colItems[c]!.push(i);
      colOf[i] = c;
      heights[c]! += (squareRatio ? colWidth * squareRatio : estimate(items[i]!, colWidth)) + gap;
    }
    return { colItems, colOf };
  }, [items, cols, colWidth, estimate, gap, squareRatio]);

  // Positions use measured heights where known.
  const layout = useMemo(() => {
    const tops = new Float64Array(items.length);
    const hs = new Float64Array(items.length);
    let total = 0;
    for (const list of assignment.colItems) {
      let y = 0;
      for (const i of list) {
        const h = squareRatio ? colWidth * squareRatio : (measured.current.get(getKey(items[i]!)) ?? estimate(items[i]!, colWidth));
        tops[i] = y;
        hs[i] = h;
        y += h + gap;
      }
      total = Math.max(total, y - gap);
    }
    return { tops, hs, total: Math.max(0, total) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment, version, colWidth, squareRatio]);

  const keyIndex = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((it, i) => m.set(getKey(it), i));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Latest layout/range for the ResizeObserver callback.
  const live = useRef({ layout, range, keyIndex });
  live.current = { layout, range, keyIndex };

  // Track the visible window (re-render only after moving a meaningful distance).
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const top = -rect.top;
      const bottom = top + window.innerHeight;
      // Low priority: mounting new items must never block a scroll frame.
      startTransition(() => setRange((r) => (Math.abs(r.top - top) < overscan / 3 && Math.abs(r.bottom - bottom) < overscan / 3 ? r : { top, bottom })));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [overscan, layout.total]);

  // Measure rendered items; apply before paint so nothing overlaps.
  const observer = useMemo(() => {
    if (squareRatio || typeof ResizeObserver === 'undefined') return null;
    return new ResizeObserver((entries) => {
      let changed = false;
      let onScreen = false;
      const { layout: l, range: r, keyIndex: ki } = live.current;
      for (const e of entries) {
        const key = (e.target as HTMLElement).dataset.vkey;
        if (!key) continue;
        const h = e.borderBoxSize?.[0]?.blockSize ?? (e.target as HTMLElement).offsetHeight;
        const prev = measured.current.get(key);
        if (prev === undefined || Math.abs(prev - h) > 0.5) {
          measured.current.set(key, h);
          changed = true;
          const i = ki.get(key);
          if (i !== undefined && l.tops[i]! < r.bottom && l.tops[i]! + h > r.top) onScreen = true;
        }
      }
      if (!changed) return;
      // Only force a synchronous re-layout when a visible item moved; items in the
      // overscan zone are corrected before they scroll into view.
      if (onScreen) flushSync(() => setVersion((v) => v + 1));
      else setVersion((v) => v + 1);
    });
  }, [squareRatio]);
  useEffect(() => () => observer?.disconnect(), [observer]);

  useEffect(() => {
    virtualRegistry.scrollToKey = (key) => {
      const i = keyIndex.get(key);
      const el = ref.current;
      if (i === undefined || !el) return false;
      const absTop = el.getBoundingClientRect().top + window.scrollY + layout.tops[i]!;
      const viewTop = window.scrollY + 140;
      const viewBottom = window.scrollY + window.innerHeight - 40;
      if (absTop < viewTop) window.scrollTo({ top: absTop - 140 });
      else if (absTop + layout.hs[i]! > viewBottom) window.scrollTo({ top: absTop + layout.hs[i]! - window.innerHeight + 40 });
      return true;
    };
    return () => {
      virtualRegistry.scrollToKey = undefined;
    };
  }, [layout, keyIndex]);

  const top = range.top - overscan;
  const bottom = range.bottom + overscan;
  const visible: number[] = [];
  for (const list of assignment.colItems) {
    // Binary search the first item in this column that ends below `top`.
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const i = list[mid]!;
      if (layout.tops[i]! + layout.hs[i]! < top) lo = mid + 1;
      else hi = mid;
    }
    for (let k = lo; k < list.length; k++) {
      const i = list[k]!;
      if (layout.tops[i]! > bottom) break;
      visible.push(i);
    }
  }
  visible.sort((a, b) => a - b);

  return (
    <div ref={ref} style={{ position: 'relative', height: layout.total }}>
      {width
        ? visible.map((i) => {
            const item = items[i]!;
            const key = getKey(item);
            const c = assignment.colOf[i]!;
            return (
              <VItem key={key} vkey={key} observer={observer} style={{ position: 'absolute', top: 0, left: 0, width: colWidth, transform: `translate3d(${c * (colWidth + gap)}px, ${layout.tops[i]}px, 0)` }}>
                {render(item, i)}
              </VItem>
            );
          })
        : null}
    </div>
  );
}
