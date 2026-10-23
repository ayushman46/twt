import { mark } from '@/lib/perf';
mark('app:boot');
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import { db, ensureCategories } from '@/lib/db';
import { loadDemoLibrary } from '@/lib/demo';
import { App } from '@/entrypoints/dashboard/App';
import { PopupApp } from '@/entrypoints/popup/App';

const params = new URLSearchParams(location.search);
if (params.get('theme') === 'dark' || (!params.get('theme') && matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
}

await ensureCategories();
if (params.has('demo') && !(await db.bookmarks.count())) await loadDemoLibrary();
if (params.has('bench')) {
  // Benchmark library: seeded once per size, then reused across runs.
  const n = Number(params.get('bench')) || 10_000;
  if ((await db.bookmarks.count()) !== n) {
    const { makeBenchLibrary } = await import('./bench-data');
    const list = makeBenchLibrary(n);
    await db.bookmarks.clear();
    for (let i = 0; i < list.length; i += 1000) await db.bookmarks.bulkPut(list.slice(i, i + 1000));
  }
  const oldest = await db.bookmarks.orderBy('savedAt').filter((b) => !b.archived).first();
  const w = window as unknown as { __benchReady: boolean; __benchOldestId?: string };
  w.__benchOldestId = oldest?.id;
  w.__benchReady = true;
}
if (params.has('reset')) {
  await db.bookmarks.clear();
  location.replace(location.pathname + location.hash);
}

if (params.has('overlay')) {
  // Render the on-x.com overlay (sync card + toast + bookmarks-page pill) for design review.
  const { Overlay } = await import('@/entrypoints/x-bridge.content/overlay');
  document.body.style.background = '#000';
  const o = new Overlay();
  o.showSync({ state: 'running', title: 'Syncing your bookmarks…', subtitle: 'Full sync — scrolling through everything you saved.', found: 1284, added: 312, hint: 'Keep this tab open and visible.', onStop: () => undefined });
  o.toast('Saved to twtdash', '🤖 AI & ML');
} else
createRoot(document.getElementById('root')!).render(<StrictMode>{params.has('popup') ? <div className="p-6"><div className="w-fit overflow-hidden rounded-2xl border border-line shadow-pop"><PopupApp /></div></div> : <App />}</StrictMode>);
