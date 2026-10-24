/**
 * Lightweight on-page UI for x.com (sync progress card, capture toasts and
 * the bookmarks-page button). Vanilla DOM inside a closed shadow root so it
 * never collides with X's styles and stays tiny.
 *
 * Strings: English is built in; the extension pages store the active
 * language's overlay strings (see @/i18n/core), so no dictionaries ship here.
 */
import { OVERLAY_EN, overlayStringsItem, type OverlayKey, type OverlayStrings } from '@/i18n/overlay-en';

const LOGO = `<svg viewBox="0 0 128 128" width="100%" height="100%" aria-hidden="true"><defs><linearGradient id="sxo-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7B61FF"/><stop offset=".55" stop-color="#B14CF2"/><stop offset="1" stop-color="#FF5C9D"/></linearGradient><linearGradient id="sxo-gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><linearGradient id="sxo-mk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6D4BFF"/><stop offset="1" stop-color="#E0479A"/></linearGradient></defs><rect width="128" height="128" rx="30" fill="url(#sxo-bg)"/><rect width="128" height="64" rx="30" fill="url(#sxo-gl)"/><rect x="31" y="27" width="56" height="74" rx="10" fill="#fff" fill-opacity=".28" transform="rotate(-10 59 64)"/><path d="M44 24h44a7 7 0 0 1 7 7v71.2a3.2 3.2 0 0 1-5 2.6L66 88 42 104.8a3.2 3.2 0 0 1-5-2.6V31a7 7 0 0 1 7-7z" fill="#fff"/><path d="M53 41.5Q66 51.5 79 41.5Q69 54.5 79 67.5Q66 57.5 53 67.5Q63 54.5 53 41.5Z" fill="url(#sxo-mk)"/></svg>`;

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.layer { position: fixed; inset: auto 0 0 auto; z-index: 2147483646; font: 14px/1.4 'Geist Variable', Geist, Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Nirmala UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Bengali", "Noto Sans Tamil", "Noto Sans Telugu", "Noto Sans Kannada", "Noto Sans Malayalam", "Noto Sans Gujarati", "Noto Sans Gurmukhi", "Kohinoor Devanagari", "Kohinoor Bangla", "Tamil Sangam MN", "Telugu Sangam MN", "Kannada Sangam MN", "Malayalam Sangam MN", "Gujarati Sangam MN", "Gurmukhi MN", Mangal, sans-serif; color: #F4F4F6; -webkit-font-smoothing: antialiased; }
.layer:not(:lang(en)) .title, .layer:not(:lang(en)) .stat b { letter-spacing: normal; }
.layer:not(:lang(en)) { line-height: 1.5; }
.card { position: fixed; right: 20px; bottom: 20px; width: 336px; padding: 16px; border-radius: 20px; background: rgba(14,14,20,.9); backdrop-filter: blur(16px) saturate(140%); -webkit-backdrop-filter: blur(16px) saturate(140%); border: 1px solid rgba(255,255,255,.09); box-shadow: 0 24px 60px -16px rgba(0,0,0,.6), 0 0 0 1px rgba(150,110,255,.12), 0 0 50px -20px rgba(150,80,255,.45); transform: translateY(12px) scale(.98); opacity: 0; transition: transform .28s cubic-bezier(.2,.9,.3,1.2), opacity .2s ease; }
.card.show { transform: none; opacity: 1; }
.row { display: flex; align-items: center; gap: 12px; }
.logo { width: 36px; height: 36px; flex: none; border-radius: 10px; filter: drop-shadow(0 6px 14px rgba(150,80,255,.55)); }
.title { font-weight: 650; font-size: 14.5px; letter-spacing: -.01em; }
.sub { color: #A1A1AA; font-size: 12.5px; margin-top: 1px; }
.count { font-variant-numeric: tabular-nums; }
.bar { position: relative; height: 6px; margin: 14px 0 12px; border-radius: 99px; background: rgba(255,255,255,.07); overflow: hidden; }
.bar > i { position: absolute; inset: 0 auto 0 0; width: 38%; border-radius: inherit; background: linear-gradient(90deg,#7B61FF,#B14CF2,#FF5C9D); animation: slide 1.25s ease-in-out infinite; }
.bar.full > i { width: 100%; animation: none; }
.bar.error > i { width: 100%; animation: none; background: #F87171; }
.bar.paused > i { animation-play-state: paused; opacity: .5; }
@keyframes slide { 0% { left: -38%; } 100% { left: 100%; } }
.stats { display: flex; gap: 8px; margin-bottom: 12px; }
.stat { flex: 1; padding: 8px 10px; border-radius: 12px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06); }
.stat b { display: block; font-size: 17px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.stat span { color: #A1A1AA; font-size: 11.5px; }
.hint { color: #8B8B95; font-size: 12px; margin: -2px 0 12px; }
.actions { display: flex; gap: 8px; }
button { all: unset; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 10px; font: 600 13px/1.2 Inter, ui-sans-serif, system-ui, "Nirmala UI", "Noto Sans", "Noto Sans Devanagari", "Kohinoor Devanagari", Mangal, sans-serif; white-space: nowrap; transition: background .15s, transform .1s; }
button:active { transform: scale(.97); }
button:focus-visible { outline: 2px solid #A996FF; outline-offset: 2px; }
.primary { flex: 1; background: linear-gradient(135deg,#7B61FF 0%,#B14CF2 60%,#FF5C9D 130%); color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 8px 20px -8px rgba(150,80,255,.85); }
.primary:hover { filter: brightness(1.08); }
.ghost { background: rgba(255,255,255,.06); color: #E4E4E7; }
.ghost:hover { background: rgba(255,255,255,.11); }
.x { position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; padding: 0; border-radius: 8px; color: #8B8B95; font-size: 16px; }
.x:hover { background: rgba(255,255,255,.08); color: #fff; }
.toast { position: fixed; left: 20px; bottom: 20px; display: flex; align-items: center; gap: 10px; max-width: 360px; padding: 10px 14px 10px 10px; border-radius: 14px; background: rgba(17,17,22,.94); border: 1px solid rgba(255,255,255,.09); box-shadow: 0 16px 40px -12px rgba(0,0,0,.5); transform: translateY(16px); opacity: 0; transition: transform .3s cubic-bezier(.2,.9,.3,1.2), opacity .2s; }
.toast.show { transform: none; opacity: 1; }
.toast .logo { width: 26px; height: 26px; border-radius: 8px; }
.toast .t1 { font-weight: 600; font-size: 13px; }
.toast .t2 { color: #A1A1AA; font-size: 12px; }
.pill { position: fixed; right: 20px; bottom: 20px; display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 8px; border-radius: 999px; background: rgba(17,17,22,.92); border: 1px solid rgba(255,255,255,.09); box-shadow: 0 14px 34px -12px rgba(0,0,0,.5); backdrop-filter: blur(14px); transform: translateY(12px); opacity: 0; transition: transform .28s, opacity .2s; }
.pill.show { transform: none; opacity: 1; }
.pill .logo { width: 26px; height: 26px; border-radius: 8px; }
.pill .label { font-size: 12.5px; color: #D4D4D8; padding-right: 2px; white-space: nowrap; }
.pill button { height: 30px; padding: 0 12px; border-radius: 999px; font-size: 12.5px; }
.pill .close { width: 26px; height: 26px; padding: 0; color: #8B8B95; font-size: 14px; }
@media (prefers-reduced-motion: reduce) { .card, .toast, .pill { transition: none; } .bar > i { animation: none; width: 100%; opacity: .6; } }
`;

export type SyncCardState = 'running' | 'paused' | 'done' | 'error';

export interface SyncCardView {
  state: SyncCardState;
  title: string;
  subtitle: string;
  found: number;
  added: number;
  hint?: string;
  onStop?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
}

let nf = new Intl.NumberFormat();
let strings: OverlayStrings['strings'] = {};
let lang = 'en';
let loading: Promise<void> | null = null;

function applyStrings(v: OverlayStrings | null) {
  strings = v?.strings ?? {};
  lang = v?.locale?.split('-')[0] || 'en';
  try {
    nf = new Intl.NumberFormat(v?.locale);
  } catch {
    nf = new Intl.NumberFormat();
  }
}

/** Load the active UI language's overlay strings and follow changes. Idempotent. */
export function loadOverlayStrings(): Promise<void> {
  loading ??= overlayStringsItem
    .getValue()
    .then((v) => {
      applyStrings(v);
      overlayStringsItem.watch(applyStrings);
    })
    .catch(() => undefined);
  return loading;
}

/** Overlay string in the active language. `{name}` placeholders; numbers are locale-formatted. */
export function ot(key: OverlayKey, vars?: Record<string, string | number>): string {
  const msg = strings[key] ?? OVERLAY_EN[key];
  if (!vars) return msg;
  return msg.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vars[k];
    return v === undefined ? m : typeof v === 'number' ? nf.format(v) : v;
  });
}

/** Locale-formatted count (Indian grouping for Indian languages / en-IN). */
export function fmtCount(n: number): string {
  return nf.format(n);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function logo(): HTMLElement {
  const d = el('div', 'logo');
  d.innerHTML = LOGO;
  return d;
}

export class Overlay {
  private host = document.createElement('twtdash-ui');
  private root: ShadowRoot;
  private layer: HTMLDivElement;
  private card: HTMLDivElement | null = null;
  private pill: HTMLDivElement | null = null;
  private toastTimer: number | undefined;

  constructor() {
    this.root = this.host.attachShadow({ mode: 'closed' });
    const style = el('style');
    style.textContent = CSS;
    this.layer = el('div', 'layer');
    this.root.append(style, this.layer);
    void loadOverlayStrings();
  }

  private mount() {
    this.layer.lang = lang;
    if (!this.host.isConnected) (document.body ?? document.documentElement).append(this.host);
  }

  showSync(view: SyncCardView) {
    this.mount();
    this.hidePill();
    const card = el('div', 'card');
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');

    const head = el('div', 'row');
    const textBox = el('div');
    textBox.append(el('div', 'title', view.title), el('div', 'sub', view.subtitle));
    head.append(logo(), textBox);

    const bar = el('div', 'bar' + (view.state === 'done' ? ' full' : view.state === 'error' ? ' error' : view.state === 'paused' ? ' paused' : ''));
    bar.append(el('i'));

    const stats = el('div', 'stats');
    const s1 = el('div', 'stat');
    s1.append(el('b', 'count', nf.format(view.found)), el('span', '', ot('overlay.found')));
    const s2 = el('div', 'stat');
    s2.append(el('b', 'count', nf.format(view.added)), el('span', '', ot('overlay.new')));
    stats.append(s1, s2);

    card.append(head, bar, stats);
    if (view.hint) card.append(el('div', 'hint', view.hint));

    const actions = el('div', 'actions');
    if (view.onOpen) {
      const b = el('button', 'primary', ot('overlay.openDashboard'));
      b.onclick = view.onOpen;
      actions.append(b);
    }
    if (view.onStop) {
      const b = el('button', 'ghost', ot('overlay.stop'));
      b.onclick = view.onStop;
      actions.append(b);
    }
    if (actions.childElementCount) card.append(actions);
    if (view.onClose) {
      const x = el('button', 'x', '×');
      x.setAttribute('aria-label', ot('overlay.close'));
      x.onclick = view.onClose;
      card.append(x);
    }

    const wasShown = !!this.card;
    this.card?.remove();
    this.card = card;
    this.layer.append(card);
    if (wasShown) card.classList.add('show');
    else requestAnimationFrame(() => card.classList.add('show'));
  }

  hideSync() {
    const c = this.card;
    this.card = null;
    if (!c) return;
    c.classList.remove('show');
    setTimeout(() => c.remove(), 250);
  }

  toast(title: string, subtitle: string) {
    this.mount();
    this.root.querySelector('.toast')?.remove();
    const t = el('div', 'toast');
    t.setAttribute('role', 'status');
    const box = el('div');
    box.append(el('div', 't1', title), el('div', 't2', subtitle));
    t.append(logo(), box);
    this.layer.append(t);
    requestAnimationFrame(() => t.classList.add('show'));
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 2800);
  }

  showPill(opts: { label: string; onSync: () => void; onOpen: () => void; onDismiss: () => void }) {
    if (this.card) return;
    this.mount();
    this.pill?.remove();
    const p = el('div', 'pill');
    const sync = el('button', 'primary', ot('overlay.sync'));
    sync.onclick = opts.onSync;
    const open = el('button', 'ghost', ot('overlay.open'));
    open.onclick = opts.onOpen;
    const close = el('button', 'ghost close', '×');
    close.setAttribute('aria-label', ot('overlay.hideButton'));
    close.onclick = opts.onDismiss;
    p.append(logo(), el('span', 'label', opts.label), sync, open, close);
    this.pill = p;
    this.layer.append(p);
    requestAnimationFrame(() => p.classList.add('show'));
  }

  hidePill() {
    const p = this.pill;
    this.pill = null;
    if (!p) return;
    p.classList.remove('show');
    setTimeout(() => p.remove(), 250);
  }

  get pillVisible() {
    return !!this.pill;
  }
}
