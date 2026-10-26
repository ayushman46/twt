/**
 * Wrapped share image: drawn on a <canvas> at 1080×1350 (feed, 4:5) or
 * 1080×1920 (story, 9:16), plus the "share studio" UI (preview, options,
 * download / copy / share).
 *
 * The card follows the app's identity: a flat off-white or near-black page,
 * one accent, Geist, hairline rules on a simple grid. Everything is drawn from
 * data and vector paths — no remote images unless an avatar can be fetched
 * with CORS — so the canvas never gets tainted and export always works.
 */
import { Check, ChevronDown, Copy, Download, LoaderCircle, Share2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { buildShareText, shareIntentUrl, WRAPPED_SITE, type WrappedStats } from '@/lib/wrapped';
import { Menu, MenuContent, MenuItem, MenuTrigger } from './ui/overlays';
import { Button, cn } from './ui/primitives';

export type ShareFormat = 'feed' | 'story';
/** Card style. ("gradient" is gone; older saved preferences fall back to dark.) */
export type ShareTheme = 'dark' | 'light';

export interface ShareOptions {
  format: ShareFormat;
  theme: ShareTheme;
  /** Privacy: leave other people's names and avatars off the image. */
  hideAuthors: boolean;
  /** The viewer's own X handle, if known. */
  handle?: string | null;
}

export const SHARE_SIZES: Record<ShareFormat, { w: number; h: number; label: string; ratio: string }> = {
  feed: { w: 1080, h: 1350, label: 'Feed', ratio: '4:5' },
  story: { w: 1080, h: 1920, label: 'Story', ratio: '9:16' },
};

/* ======================================================================== */
/* Canvas renderer                                                           */
/* ======================================================================== */

type Ctx = CanvasRenderingContext2D;

const SANS = '"Geist Variable", "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Nirmala UI", "Noto Sans Devanagari", sans-serif, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"';

interface Theme {
  bg: string;
  fg: string;
  fg2: string;
  muted: string;
  line: string;
  track: string;
  /** Secondary bar fill (the top row uses the accent). */
  bar: string;
  accent: string;
  /** Text on the accent (the logo's bookmark). */
  onAccent: string;
  avatarBg: string;
}

/** Same values as the app's tokens (styles/globals.css). */
const THEMES: Record<ShareTheme, Theme> = {
  dark: {
    bg: '#0C0C0D',
    fg: '#F2F2F0',
    fg2: '#CFCFCB',
    muted: '#8F8F8A',
    line: 'rgba(255,255,255,0.12)',
    track: 'rgba(255,255,255,0.08)',
    bar: 'rgba(242,242,240,0.3)',
    accent: '#7F8FFF',
    onAccent: '#FFFFFF',
    avatarBg: '#1A1A1D',
  },
  light: {
    bg: '#F7F7F5',
    fg: '#141414',
    fg2: '#3B3B39',
    muted: '#6B6B67',
    line: 'rgba(17,17,17,0.12)',
    track: 'rgba(17,17,17,0.07)',
    bar: 'rgba(20,20,20,0.24)',
    accent: '#3D5BD9',
    onAccent: '#FFFFFF',
    avatarBg: '#EBEBE7',
  },
};

/* ---------------------------------------------------------------- Helpers */

function font(ctx: Ctx, weight: number, size: number) {
  ctx.font = `${weight} ${size}px ${SANS}`;
}

function tracking(ctx: Ctx, px: number) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** A 2px hairline (reads as 1px once X or Instagram scale the image down). */
function rule(ctx: Ctx, t: Theme, x: number, y: number, w: number) {
  ctx.fillStyle = t.line;
  ctx.fillRect(x, Math.round(y), w, 2);
}

function ellipsize(ctx: Ctx, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  const chars = Array.from(text);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(chars.slice(0, mid).join('').trimEnd() + '…').width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return chars.slice(0, lo).join('').trimEnd() + '…';
}

/** Greedy word wrap; the last allowed line is ellipsized. */
function wrap(ctx: Ctx, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i]!;
    if (ctx.measureText(next).width <= maxW || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = words[i]!;
    if (lines.length === maxLines - 1) {
      line = words.slice(i).join(' ');
      break;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines).map((l, i, arr) => (i === arr.length - 1 ? ellipsize(ctx, l, maxW) : l));
}

/** Largest size (stepping down) at which `text` fits `maxW` in `maxLines`. */
function fitWrap(ctx: Ctx, text: string, maxW: number, maxLines: number, from: number, to: number, set: (size: number) => void): { size: number; lines: string[] } {
  for (let size = from; size >= to; size -= 4) {
    set(size);
    const words = text.split(/\s+/);
    if (words.some((w) => ctx.measureText(w).width > maxW)) continue;
    const lines = wrap(ctx, text, maxW, 99);
    if (lines.length <= maxLines) return { size, lines };
  }
  set(to);
  return { size: to, lines: wrap(ctx, text, maxW, maxLines) };
}

function fitSize(ctx: Ctx, text: string, maxW: number, from: number, to: number, set: (size: number) => void): number {
  for (let size = from; size > to; size -= 2) {
    set(size);
    if (ctx.measureText(text).width <= maxW) return size;
  }
  set(to);
  return to;
}

const LOGO_BOOKMARK = 'M44 24h44a7 7 0 0 1 7 7v71.2a3.2 3.2 0 0 1-5 2.6L66 88 42 104.8a3.2 3.2 0 0 1-5-2.6V31a7 7 0 0 1 7-7z';

/** The twtdash mark (same geometry as components/Brand.tsx): a flat accent tile, a white bookmark, an accent pill. */
function drawLogo(ctx: Ctx, t: Theme, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 128, size / 128);
  roundRect(ctx, 0, 0, 128, 128, 28);
  ctx.fillStyle = t.accent;
  ctx.fill();
  ctx.save();
  ctx.translate(-2, 0);
  ctx.fillStyle = t.onAccent;
  ctx.fill(new Path2D(LOGO_BOOKMARK));
  ctx.restore();
  roundRect(ctx, 52, 49, 24, 9, 4.5);
  ctx.fillStyle = t.accent;
  ctx.fill();
  ctx.restore();
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => Array.from(w)[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  );
}

/** Real avatar when it could be fetched; otherwise a neutral circle with initials (never random colours). */
function drawAvatar(ctx: Ctx, t: Theme, cx: number, cy: number, r: number, name: string, handle: string, bitmap: ImageBitmap | null | undefined) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  if (bitmap) {
    ctx.save();
    ctx.clip();
    ctx.drawImage(bitmap, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = t.avatarBg;
    ctx.fill();
    ctx.fillStyle = t.muted;
    font(ctx, 500, Math.round(r * 0.72));
    tracking(ctx, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initialsOf(name || handle), cx, cy + r * 0.04);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = t.line;
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------- Assets */

const avatarCache = new Map<string, Promise<ImageBitmap | null>>();

function biggerAvatar(url: string): string {
  return url.replace(/_(normal|bigger|mini|200x200|400x400)\./, '_200x200.');
}

/** CORS-only avatar fetch; any failure (or a slow CDN) falls back to monograms. */
function loadAvatar(url: string): Promise<ImageBitmap | null> {
  if (!/^https:\/\//.test(url) || typeof createImageBitmap !== 'function') return Promise.resolve(null);
  let p = avatarCache.get(url);
  if (!p) {
    p = (async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2500);
        const res = await fetch(biggerAvatar(url), { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob.type.startsWith('image/')) return null;
        return await createImageBitmap(blob);
      } catch {
        return null;
      }
    })();
    avatarCache.set(url, p);
  }
  return p;
}

const fontsReady = new Map<string, Promise<void>>();

/** Load the brand face (and the glyph subsets `sample` needs) before drawing. */
function loadFonts(sample: string): Promise<void> {
  const key = sample;
  let p = fontsReady.get(key);
  if (!p) {
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    p = fonts?.load
      ? Promise.race([
          Promise.all([
            fonts.load('600 64px "Geist Variable"', sample),
            fonts.load('500 64px "Geist Variable"', sample),
            fonts.load('400 64px "Geist Variable"', sample),
            fonts.load('600 120px "Geist Variable"', '0123456789,.%AMP ·—'),
          ]).then(() => undefined),
          new Promise<void>((r) => setTimeout(r, 3000)),
        ]).catch(() => undefined)
      : Promise.resolve();
    fontsReady.set(key, p);
  }
  return p;
}

/* ------------------------------------------------------------- Drawing */

interface Block {
  h: number;
  /** Relative share of leftover space added before this block. */
  gap: number;
  draw: (y: number) => void;
}

function periodLabel(s: WrappedStats): string {
  if (s.period === 'year') return `${s.label} Wrapped`;
  if (s.period === '12m') return '12-month Wrapped';
  if (s.period === '30d') return '30-day Wrapped';
  return 'All-time Wrapped';
}

function compactNumber(n: number): string {
  if (n < 100_000) return new Intl.NumberFormat().format(n);
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Draw the share card. Exported for tests and custom exports. */
export function drawShareCard(canvas: HTMLCanvasElement, s: WrappedStats, opts: ShareOptions, avatars: Map<string, ImageBitmap | null> = new Map()) {
  const { w: W, h: H } = SHARE_SIZES[opts.format];
  const story = opts.format === 'story';
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas is not available');
  const t = THEMES[opts.theme] ?? THEMES.dark;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  if ('fontKerning' in ctx) ctx.fontKerning = 'normal';

  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);

  const P = 88;
  const CW = W - P * 2;
  const top = story ? 136 : 88;
  const bottom = story ? 128 : 80;

  // Header ------------------------------------------------------------
  const headerH = 56;
  const drawHeader = (y: number) => {
    drawLogo(ctx, t, P, y, 56);
    font(ctx, 600, 38);
    tracking(ctx, -0.8);
    ctx.fillStyle = t.fg;
    ctx.fillText('twtdash', P + 76, y + 40);
    font(ctx, 500, 28);
    tracking(ctx, -0.2);
    const label = periodLabel(s);
    const lw = ctx.measureText(label).width;
    ctx.fillStyle = t.muted;
    ctx.fillText(label, W - P - lw, y + 39);
    tracking(ctx, 0);
  };

  // Persona -------------------------------------------------------------
  const persona = s.persona;
  const kicker = opts.handle ? `@${opts.handle.replace(/^@/, '')} · Bookmark persona` : 'My bookmark persona';
  const setName = (sz: number) => {
    font(ctx, 600, sz);
    tracking(ctx, -sz * 0.04);
  };
  const nameFit = fitWrap(ctx, persona.name, CW - 40, 2, story ? 136 : 120, story ? 84 : 76, setName);
  const nameLH = Math.round(nameFit.size * 0.98);
  const lineSize = story ? 38 : 34;
  font(ctx, 400, lineSize);
  tracking(ctx, -0.3);
  const lineLines = wrap(ctx, persona.line, CW - 40, 2);
  const lineLH = Math.round(lineSize * 1.36);
  const kickerH = 34;
  const personaH = kickerH + 28 + nameLH * nameFit.lines.length + 26 + lineLH * lineLines.length;
  const drawPersona = (y: number) => {
    font(ctx, 500, 28);
    tracking(ctx, -0.2);
    ctx.fillStyle = t.muted;
    ctx.fillText(ellipsize(ctx, kicker, CW), P, y + 26);
    // Name, with the accent full stop that marks every Wrapped headline.
    setName(nameFit.size);
    ctx.fillStyle = t.fg;
    let ny = y + kickerH + 28 + nameFit.size * 0.78;
    nameFit.lines.forEach((line, i) => {
      ctx.fillText(line, P - nameFit.size * 0.04, ny);
      if (i === nameFit.lines.length - 1 && !/[.…!?]$/.test(line)) {
        const lw = ctx.measureText(line).width;
        ctx.fillStyle = t.accent;
        ctx.fillText('.', P - nameFit.size * 0.04 + lw, ny);
        ctx.fillStyle = t.fg;
      }
      ny += nameLH;
    });
    tracking(ctx, 0);
    // One-liner
    font(ctx, 400, lineSize);
    tracking(ctx, -0.3);
    ctx.fillStyle = t.fg2;
    let ly = y + kickerH + 28 + nameLH * nameFit.lines.length + 26 + lineLH * 0.74;
    for (const l of lineLines) {
      ctx.fillText(l, P, ly);
      ly += lineLH;
    }
    tracking(ctx, 0);
  };

  // Key numbers: three columns between hairlines -------------------------
  const tiles: Array<{ value: string; label: string }> = [
    { value: compactNumber(s.total), label: s.total === 1 ? 'post saved' : 'posts saved' },
    { value: s.streak ? String(s.streak.days) : '—', label: s.streak && s.streak.days === 1 ? 'day streak' : 'day streak' },
    { value: s.busiestHour ? s.busiestHour.label : '—', label: 'peak hour' },
  ];
  const tileH = story ? 220 : 200;
  const drawTiles = (y: number) => {
    rule(ctx, t, P, y, CW);
    rule(ctx, t, P, y + tileH - 2, CW);
    const colW = CW / 3;
    tiles.forEach((tile, i) => {
      const x = P + i * colW + (i ? 36 : 0);
      if (i) {
        ctx.fillStyle = t.line;
        ctx.fillRect(P + i * colW, y + 32, 2, tileH - 64);
      }
      const size = fitSize(ctx, tile.value, colW - 56, story ? 100 : 92, 48, (sz) => {
        font(ctx, 600, sz);
        tracking(ctx, -sz * 0.045);
      });
      ctx.fillStyle = t.fg;
      ctx.fillText(tile.value, x - size * 0.03, y + 40 + size * 0.74);
      tracking(ctx, 0);
      font(ctx, 400, story ? 27 : 25);
      ctx.fillStyle = t.muted;
      ctx.fillText(tile.label, x, y + tileH - 40);
    });
  };

  // Lists ------------------------------------------------------------------
  const showAuthors = !opts.hideAuthors && s.authors.length > 0;
  const rowH = story ? 74 : 68;
  const sectionLabel = (text: string, x: number, y: number) => {
    font(ctx, 500, 26);
    tracking(ctx, -0.2);
    ctx.fillStyle = t.muted;
    ctx.fillText(text, x, y + 24);
    tracking(ctx, 0);
  };
  const maxShare = s.categories[0]?.share || 1;
  const drawCategories = (x: number, y: number, w: number, rows: number) => {
    sectionLabel('Top categories', x, y);
    let ry = y + 56;
    s.categories.slice(0, rows).forEach((c, i) => {
      font(ctx, 500, 24);
      ctx.fillStyle = t.muted;
      ctx.fillText(pad2(i + 1), x, ry + 30);
      const pctText = `${Math.max(1, Math.round(c.share * 100))}%`;
      font(ctx, 500, 27);
      const pw = ctx.measureText(pctText).width;
      ctx.fillStyle = t.fg2;
      ctx.fillText(pctText, x + w - pw, ry + 30);
      font(ctx, 500, 29);
      tracking(ctx, -0.4);
      ctx.fillStyle = t.fg;
      ctx.fillText(ellipsize(ctx, c.name, w - 52 - pw - 20), x + 52, ry + 30);
      tracking(ctx, 0);
      // Bar
      const bx = x + 52;
      const by = ry + 46;
      const bw = w - 52;
      roundRect(ctx, bx, by, bw, 6, 3);
      ctx.fillStyle = t.track;
      ctx.fill();
      roundRect(ctx, bx, by, Math.max(10, bw * (c.share / maxShare)), 6, 3);
      ctx.fillStyle = i === 0 ? t.accent : t.bar;
      ctx.fill();
      ry += rowH;
    });
  };
  const drawAuthors = (x: number, y: number, w: number, rows: number) => {
    sectionLabel('Most saved accounts', x, y);
    let ry = y + 56;
    for (const a of s.authors.slice(0, rows)) {
      const r = 24;
      drawAvatar(ctx, t, x + r, ry + 24, r, a.name, a.handle, avatars.get(a.avatar));
      const count = compactNumber(a.count);
      font(ctx, 500, 27);
      const cw = ctx.measureText(count).width;
      ctx.fillStyle = t.fg2;
      ctx.fillText(count, x + w - cw, ry + 22);
      font(ctx, 500, 27);
      tracking(ctx, -0.3);
      ctx.fillStyle = t.fg;
      ctx.fillText(ellipsize(ctx, a.name || a.handle, w - 2 * r - 20 - cw - 16), x + 2 * r + 18, ry + 20);
      tracking(ctx, 0);
      font(ctx, 400, 22);
      ctx.fillStyle = t.muted;
      ctx.fillText(ellipsize(ctx, `@${a.handle}`, w - 2 * r - 20 - cw - 16), x + 2 * r + 18, ry + 48);
      ry += rowH;
    }
  };

  const facts = s.funFacts.filter((f) => !opts.hideAuthors || !f.mentionsAuthor);
  const factBlock = (count: number): Block | null => {
    const list = facts.slice(0, count);
    if (!list.length) return null;
    font(ctx, 400, 29);
    const textX = P + 52;
    const wrapped = list.map((f) => wrap(ctx, f.text, W - P - textX, 2));
    const rowsH = wrapped.map((l) => 28 + l.length * 40 + 8);
    const h = rowsH.reduce((a, b) => a + b, 0);
    return {
      h,
      gap: 0.8,
      draw: (y) => {
        let fy = y;
        list.forEach((_, i) => {
          rule(ctx, t, P, fy, CW);
          font(ctx, 500, 24);
          ctx.fillStyle = t.muted;
          ctx.fillText(pad2(i + 1), P, fy + 28 + 28);
          font(ctx, 400, 29);
          tracking(ctx, -0.2);
          ctx.fillStyle = t.fg2;
          wrapped[i]!.forEach((l, j) => ctx.fillText(l, textX, fy + 28 + 29 + j * 40));
          tracking(ctx, 0);
          fy += rowsH[i]!;
        });
      },
    };
  };

  // Footer ------------------------------------------------------------------
  const footerH = 40;
  const drawFooter = (y: number) => {
    rule(ctx, t, P, y - 32, CW);
    font(ctx, 500, 26);
    tracking(ctx, -0.2);
    ctx.fillStyle = t.fg;
    ctx.fillText(WRAPPED_SITE.replace(/^https?:\/\//, ''), P, y + 30);
    font(ctx, 400, 24);
    const cta = 'Get your own Wrapped, free';
    const cw = ctx.measureText(cta).width;
    ctx.fillStyle = t.muted;
    ctx.fillText(cta, W - P - cw, y + 30);
    tracking(ctx, 0);
  };

  // Layout ------------------------------------------------------------------
  // Try richer layouts first and keep the first one that fits; leftover space
  // is shared out between the gaps so every card feels composed, not crammed.
  const listH = (rows: number) => 56 + rows * rowH - 14;
  const personaBlock: Block = { h: personaH, gap: 1.15, draw: drawPersona };
  const tilesBlock: Block = { h: tileH, gap: 1, draw: drawTiles };
  const catsBlock = (rows: number, x = P, w = CW): Block | null => {
    const n = Math.min(rows, s.categories.length);
    return n ? { h: listH(n), gap: 0.9, draw: (y) => drawCategories(x, y, w, n) } : null;
  };
  const authorsBlock = (rows: number): Block | null => {
    const n = Math.min(rows, s.authors.length);
    return n ? { h: listH(n), gap: 0.8, draw: (y) => drawAuthors(P, y, CW, n) } : null;
  };
  const twoColumns = (rows: number): Block | null => {
    const n = Math.min(rows, Math.max(s.categories.length, s.authors.length));
    if (!n) return null;
    const colW = (CW - 64) / 2;
    return {
      h: listH(n),
      gap: 0.9,
      draw: (y) => {
        drawCategories(P, y, colW, Math.min(n, s.categories.length));
        drawAuthors(P + colW + 64, y, colW, Math.min(n, s.authors.length));
      },
    };
  };
  const configs: Array<Array<Block | null>> = [];
  if (story && showAuthors) {
    for (const [c, a, f] of [[5, 3, 1], [5, 3, 0], [4, 3, 0], [4, 2, 0], [3, 2, 0], [4, 0, 0], [3, 0, 0]] as const) configs.push([catsBlock(c), a ? authorsBlock(a) : null, f ? factBlock(f) : null]);
  } else if (story) {
    for (const [c, f] of [[5, 2], [5, 1], [5, 0], [4, 0], [3, 0]] as const) configs.push([catsBlock(c), f ? factBlock(f) : null]);
  } else if (showAuthors) {
    for (const r of [4, 3, 2]) configs.push([twoColumns(r)]);
  } else {
    for (const [c, f] of [[4, 1], [4, 0], [3, 0], [2, 0]] as const) configs.push([catsBlock(c), f ? factBlock(f) : null]);
  }
  configs.push([]);

  const avail = H - top - bottom - headerH - footerH - 64; // keep air above the footer rule
  const minGap = story ? 48 : 32;
  const fits = (list: Block[]) => list.reduce((a, b) => a + b.h + minGap, 0) <= avail;
  let chosen: Block[] = [personaBlock, tilesBlock];
  for (const extra of configs) {
    const list = [personaBlock, tilesBlock, ...extra.filter((b): b is Block => !!b)];
    if (fits(list)) {
      chosen = list;
      break;
    }
  }
  const used = chosen.reduce((a, b) => a + b.h, 0);
  const totalGap = chosen.reduce((a, b) => a + b.gap, 0);
  const free = Math.max(0, avail - used);
  drawHeader(top);
  let y = top + headerH;
  for (const b of chosen) {
    y += Math.max(minGap, (free * b.gap) / totalGap);
    b.draw(y);
    y += b.h;
  }
  drawFooter(H - bottom - footerH);
}

/** Render a share image (fonts and CORS avatars loaded first). */
export async function renderShareImage(s: WrappedStats, opts: ShareOptions): Promise<Blob> {
  const sample = [s.persona.name, s.persona.line, ...s.categories.map((c) => c.name), ...s.authors.map((a) => `${a.name} @${a.handle}`), ...s.funFacts.map((f) => f.text), opts.handle ?? ''].join(' ');
  const avatars = new Map<string, ImageBitmap | null>();
  const wantAvatars = !opts.hideAuthors ? s.authors.slice(0, 4).filter((a) => a.avatar) : [];
  await Promise.all([
    loadFonts(sample),
    ...wantAvatars.map(async (a) => {
      avatars.set(a.avatar, await loadAvatar(a.avatar));
    }),
  ]);
  const canvas = document.createElement('canvas');
  drawShareCard(canvas, s, opts, avatars);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image'))), 'image/png'));
}

/* ======================================================================== */
/* Share studio (preview, options, actions)                                  */
/* ======================================================================== */

const PREFS_KEY = 'twtdash:wrapped-share';

function readPrefs(): Pick<ShareOptions, 'format' | 'theme' | 'hideAuthors'> {
  const fallback = { format: 'feed' as ShareFormat, theme: 'dark' as ShareTheme, hideAuthors: false };
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as { format?: string; theme?: string; hideAuthors?: boolean } | null;
    return {
      format: raw?.format === 'story' ? 'story' : 'feed',
      theme: raw?.theme === 'light' ? 'light' : 'dark',
      hideAuthors: !!raw?.hideAuthors,
    };
  } catch {
    return fallback;
  }
}

function fileName(s: WrappedStats, format: ShareFormat): string {
  const tag = s.period === 'year' ? s.label : s.period;
  return `twtdash-wrapped-${tag}-${format}.png`;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const canCopyImage = () => typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;

function canNativeShare(): boolean {
  try {
    const probe = new File([new Blob(['x'], { type: 'image/png' })], 'probe.png', { type: 'image/png' });
    return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const THEME_SWATCH: Record<ShareTheme, { label: string; bg: string; fg: string }> = {
  dark: { label: 'Dark', bg: THEMES.dark.bg, fg: THEMES.dark.fg },
  light: { label: 'Light', bg: THEMES.light.bg, fg: THEMES.light.fg },
};

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ id: T; label: string; hint?: string; swatch?: { bg: string; fg: string } }>; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-0.5 rounded-lg border border-line bg-panel p-[3px]">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn(
              'flex min-h-8 flex-1 items-center justify-center gap-2 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 active:scale-[0.98]',
              on ? 'bg-accent-soft text-accent' : 'text-fg-2 hover:bg-panel-2 hover:text-fg',
            )}
          >
            {o.swatch ? <span aria-hidden className="size-3.5 shrink-0 rounded-full ring-1 ring-line-strong" style={{ background: o.swatch.bg }} /> : null}
            {o.label}
            {o.hint ? <span className={cn('text-[12px] font-normal tabular-nums', on ? 'text-accent' : 'text-muted')}>{o.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function ShareStudio({ stats, handle, className }: { stats: WrappedStats; handle?: string | null; className?: string }) {
  const [prefs, setPrefs] = useState(readPrefs);
  const [preview, setPreview] = useState<{ key: string; url: string; blob: Blob } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<null | 'copy' | 'x' | 'download' | 'share'>(null);
  const [copied, setCopied] = useState(false);
  const native = useMemo(canNativeShare, []);
  const coarse = useMemo(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches, []);
  const copyable = useMemo(canCopyImage, []);

  const opts: ShareOptions = useMemo(() => ({ ...prefs, handle }), [prefs, handle]);
  const key = `${stats.period}|${stats.total}|${stats.now}|${opts.format}|${opts.theme}|${opts.hideAuthors}|${handle ?? ''}`;
  const latest = useRef(key);
  latest.current = key;

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* private mode */
    }
  }, [prefs]);

  const urlRef = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    renderShareImage(stats, opts)
      .then((blob) => {
        if (!alive) return;
        const url = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setPreview({ key, url, blob });
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    },
    [],
  );

  const blobFor = async (format: ShareFormat): Promise<Blob> => {
    if (format === opts.format && preview?.key === latest.current) return preview.blob;
    return renderShareImage(stats, { ...opts, format });
  };

  const copyImage = async (): Promise<boolean> => {
    if (!copyable) return false;
    try {
      // Hand the clipboard a promise so the user gesture is still valid while the image renders.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobFor(opts.format) })]);
      return true;
    } catch {
      return false;
    }
  };

  const onCopy = async () => {
    setBusy('copy');
    const ok = await copyImage();
    setBusy(null);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success('Image copied', { description: 'Paste it anywhere: a post, a story or a chat.' });
    } else toast.error('Couldn’t copy the image', { description: 'Your browser blocked it. Use Download instead.' });
  };

  const onDownload = async (which: ShareFormat | 'both') => {
    setBusy('download');
    try {
      const formats: ShareFormat[] = which === 'both' ? ['feed', 'story'] : [which];
      for (const f of formats) {
        saveBlob(await blobFor(f), fileName(stats, f));
        if (formats.length > 1) await new Promise((r) => setTimeout(r, 350));
      }
      toast.success(formats.length > 1 ? 'Both images downloaded' : 'Image downloaded', { description: formats.map((f) => `${SHARE_SIZES[f].label} · ${SHARE_SIZES[f].w}×${SHARE_SIZES[f].h}`).join(' and ') });
    } catch {
      toast.error('Couldn’t create the image');
    } finally {
      setBusy(null);
    }
  };

  const onShareX = async () => {
    setBusy('x');
    const copied = await copyImage();
    if (!copied) {
      try {
        saveBlob(await blobFor(opts.format), fileName(stats, opts.format));
      } catch {
        /* the post still opens */
      }
    }
    setBusy(null);
    window.open(shareIntentUrl(stats), '_blank', 'noopener,noreferrer');
    toast.success(copied ? 'Image copied. Paste it into your post.' : 'Image downloaded. Attach it to your post.', {
      description: copied ? 'Press Ctrl+V (⌘V on Mac) in the X composer to add your Wrapped card.' : 'Use the image button in the X composer to add your Wrapped card.',
      duration: 8000,
    });
  };

  const onNativeShare = async () => {
    setBusy('share');
    try {
      const blob = await blobFor(opts.format);
      const file = new File([blob], fileName(stats, opts.format), { type: 'image/png' });
      await navigator.share({ files: [file], title: 'My twtdash Wrapped', text: buildShareText(stats) });
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast.error('Sharing didn’t work', { description: 'Try Download or Copy image instead.' });
    } finally {
      setBusy(null);
    }
  };

  const size = SHARE_SIZES[opts.format];
  const ready = preview?.key === key;
  const nativePrimary = native && coarse;
  const spin = <LoaderCircle className="animate-spin" />;

  return (
    <div className={cn('grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] md:gap-12 [&_svg.lucide]:stroke-[1.75]', className)}>
      <figure className="flex min-w-0 justify-center">
        <div
          className="relative overflow-hidden rounded-xl border border-line bg-panel transition-[aspect-ratio,height] duration-200 ease-out"
          style={{ aspectRatio: `${size.w} / ${size.h}`, height: opts.format === 'story' ? 'min(64vh, 560px)' : 'min(56vh, 500px)', maxWidth: '100%' }}
        >
          {preview ? <img src={preview.url} alt={`Preview of your Wrapped card: ${stats.persona.name}, ${stats.total} saves`} className={cn('size-full object-contain transition-opacity duration-200', !ready && 'opacity-60')} /> : null}
          {!ready && !failed ? (
            <div className="absolute inset-0 grid place-items-center">
              <LoaderCircle className="size-5 animate-spin text-muted" aria-label="Rendering image" />
            </div>
          ) : null}
          {failed ? <div className="absolute inset-0 grid place-items-center p-6 text-center text-[13px] text-muted">Couldn’t draw the image in this browser.</div> : null}
        </div>
        <figcaption className="sr-only">
          {size.label} image, {size.w} by {size.h} pixels
        </figcaption>
      </figure>

      <div className="flex min-w-0 flex-col gap-5" data-no-tap>
        <div className="space-y-2">
          <div className="text-[13px] font-medium text-fg-2">Size</div>
          <Segmented
            label="Image size"
            value={prefs.format}
            onChange={(format) => setPrefs((p) => ({ ...p, format }))}
            options={[
              { id: 'feed', label: 'Feed', hint: '4:5' },
              { id: 'story', label: 'Story', hint: '9:16' },
            ]}
          />
        </div>
        <div className="space-y-2">
          <div className="text-[13px] font-medium text-fg-2">Style</div>
          <Segmented
            label="Card style"
            value={prefs.theme}
            onChange={(theme) => setPrefs((p) => ({ ...p, theme }))}
            options={(Object.keys(THEME_SWATCH) as ShareTheme[]).map((id) => ({ id, label: THEME_SWATCH[id].label, swatch: THEME_SWATCH[id] }))}
          />
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-3 border-y border-line py-3">
          <span className="min-w-0">
            <span className="block text-[13.5px] font-medium text-fg">Hide author names</span>
            <span className="block text-[12.5px] text-muted">Keep other accounts off your image</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.hideAuthors}
            onClick={() => setPrefs((p) => ({ ...p, hideAuthors: !p.hideAuthors }))}
            className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150', prefs.hideAuthors ? 'bg-accent' : 'bg-panel-3 ring-1 ring-line-strong ring-inset')}
          >
            <span className="sr-only">Hide author names</span>
            <span className={cn('block size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform duration-150 ease-out', prefs.hideAuthors ? 'translate-x-[18px]' : 'translate-x-[2px]')} />
          </button>
        </label>

        <div className="flex flex-col gap-2">
          {nativePrimary ? (
            <Button variant="primary" size="lg" className="h-10 w-full rounded-lg text-[14px]" onClick={() => void onNativeShare()} disabled={!!busy}>
              {busy === 'share' ? spin : <Share2 />} Share image
            </Button>
          ) : null}
          <Button variant={nativePrimary ? 'outline' : 'primary'} size="lg" className={cn('h-10 w-full rounded-lg text-[14px]', nativePrimary && 'shadow-none')} onClick={() => void onShareX()} disabled={!!busy}>
            {busy === 'x' ? spin : <XLogo className="size-4" />} Share on X
          </Button>
          <div className="flex gap-2">
            {copyable ? (
              <Button variant="outline" className="h-9 flex-1 rounded-lg shadow-none" onClick={() => void onCopy()} disabled={!!busy}>
                {busy === 'copy' ? spin : copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy image'}
              </Button>
            ) : null}
            <Menu>
              <MenuTrigger asChild>
                <Button variant="outline" className="h-9 flex-1 rounded-lg shadow-none" disabled={!!busy}>
                  {busy === 'download' ? spin : <Download />} Download <ChevronDown className="!size-3.5 text-muted" />
                </Button>
              </MenuTrigger>
              <MenuContent align="end" className="min-w-[230px]">
                <MenuItem onSelect={() => void onDownload(opts.format)}>
                  <Download strokeWidth={1.75} /> This size <span className="ml-auto text-[11.5px] text-muted tabular-nums">{`${size.w}×${size.h}`}</span>
                </MenuItem>
                <MenuItem onSelect={() => void onDownload('both')}>
                  <Download strokeWidth={1.75} /> Both sizes <span className="ml-auto text-[11.5px] text-muted">feed + story</span>
                </MenuItem>
              </MenuContent>
            </Menu>
            {native && !nativePrimary ? (
              <Button variant="outline" size="icon" className="size-9 rounded-lg shadow-none" onClick={() => void onNativeShare()} disabled={!!busy} aria-label="More sharing options">
                {busy === 'share' ? spin : <Share2 />}
              </Button>
            ) : null}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">Your image is made on this device. Nothing is uploaded; you choose where it goes.</p>
        </div>
      </div>
    </div>
  );
}
