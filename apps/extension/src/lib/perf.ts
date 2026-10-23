/**
 * Lightweight performance marks (User Timing API). Near-zero cost; used by
 * the benchmark harness (`bench/run.mjs`) and visible in DevTools > Performance.
 */
import { useEffect, useRef } from 'react';

export function mark(name: string) {
  try {
    performance.mark(name);
  } catch {
    /* unsupported */
  }
}

/** Mark once the current frame has been presented (rAF + task). */
export function markAfterPaint(name: string) {
  requestAnimationFrame(() => setTimeout(() => mark(name), 0));
}

/** Emit `name` after paint each time `key` changes while `ready` is true. */
export function usePaintMark(name: string, ready: boolean, key = '') {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || last.current === key) return;
    last.current = key;
    markAfterPaint(name);
  }, [name, ready, key]);
}

type PerfStore = Record<string, number[]>;

/** Record a duration sample (read by the benchmark via `__twtdashPerf`). */
export function perfStat(name: string, ms: number) {
  const g = globalThis as unknown as { __twtdashPerf?: PerfStore };
  const store = (g.__twtdashPerf ??= {});
  (store[name] ??= []).push(Math.round(ms * 10) / 10);
}
