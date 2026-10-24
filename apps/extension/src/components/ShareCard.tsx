/**
 * Wrapped share image: drawn on a <canvas> at 1080×1350 (feed, 4:5) or
 * 1080×1920 (story, 9:16), plus the "share studio" UI (preview, options,
 * download / copy / share).
 *
 * Everything is drawn from data and vector paths — no remote images unless an
 * avatar can be fetched with CORS — so the canvas never gets tainted and export
 * always works.
 */
import { Check, ChevronDown, Copy, Download, LoaderCircle, Share2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { buildShareText, shareIntentUrl, WRAPPED_SITE, type WrappedStats } from '@/lib/wrapped';
import { Menu, MenuContent, MenuItem, MenuTrigger } from './ui/overlays';
import { cn } from './ui/primitives';

export type ShareFormat = 'feed' | 'story';
export type ShareTheme = 'gradient' | 'dark' | 'light';

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
type Paint = string | CanvasGradient;

const SANS = '"Geist Variable", "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"';
const SERIF = '"Instrument Serif", ui-serif, Georgia, "Times New Roman", serif';
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';
const BRAND = ['#7B61FF', '#B14CF2', '#FF5C9D'] as const;

interface Theme {
  bg(ctx: Ctx, w: number, h: number): void;
  fg: string;
  fg2: string;
  fg3: string;
  panel: string;
  panelStroke: string;
  track: string;
  bar(ctx: Ctx, x0: number, x1: number): Paint;
  accent(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): Paint;
  dash(ctx: Ctx, x0: number, x1: number): Paint;
  pillBg: string;
  pillStroke: string;
  glow: string;
  grain: number;
  grainOp: GlobalCompositeOperation;
}

function linear(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: readonly string[]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c));
  return g;
}

function glowAt(ctx: Ctx, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const THEMES: Record<ShareTheme, Theme> = {
  gradient: {
    bg(ctx, w, h) {
      ctx.fillStyle = linear(ctx, 0, 0, w, h, ['#6E55F5', '#A94BEE', '#F45A9A']);
      ctx.fillRect(0, 0, w, h);
      glowAt(ctx, w * 0.88, h * 0.06, w * 0.75, 'rgba(255,255,255,0.24)');
      glowAt(ctx, w * 0.02, h * 0.5, w * 0.85, 'rgba(60,24,150,0.40)');
      const shade = ctx.createLinearGradient(0, h * 0.4, 0, h);
      shade.addColorStop(0, 'rgba(32,8,64,0)');
      shade.addColorStop(1, 'rgba(32,8,64,0.5)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, w, h);
    },
    fg: '#FFFFFF',
    fg2: 'rgba(255,255,255,0.88)',
    fg3: 'rgba(255,255,255,0.7)',
    panel: 'rgba(255,255,255,0.13)',
    panelStroke: 'rgba(255,255,255,0.24)',
    track: 'rgba(255,255,255,0.2)',
    bar: () => '#FFFFFF',
    accent: () => '#FFFFFF',
    dash: () => 'rgba(255,255,255,0.78)',
    pillBg: 'rgba(255,255,255,0.16)',
    pillStroke: 'rgba(255,255,255,0.3)',
    glow: 'rgba(255,255,255,0.38)',
    grain: 0.07,
    grainOp: 'overlay',
  },
  dark: {
    bg(ctx, w, h) {
      ctx.fillStyle = '#09080F';
      ctx.fillRect(0, 0, w, h);
      glowAt(ctx, w * 0.08, h * 0.02, w * 0.95, 'rgba(123,97,255,0.42)');
      glowAt(ctx, w * 1.02, h * 0.42, w * 0.75, 'rgba(255,92,157,0.24)');
      glowAt(ctx, w * 0.3, h * 1.04, w * 0.95, 'rgba(177,76,242,0.30)');
    },
    fg: '#F4F3F8',
    fg2: 'rgba(244,243,248,0.8)',
    fg3: 'rgba(244,243,248,0.56)',
    panel: 'rgba(255,255,255,0.045)',
    panelStroke: 'rgba(255,255,255,0.1)',
    track: 'rgba(255,255,255,0.08)',
    bar: (ctx, x0, x1) => linear(ctx, x0, 0, x1, 0, BRAND),
    accent: (ctx, x0, y0, x1, y1) => linear(ctx, x0, y0, x1, y1, ['#A08CFF', '#CB7BFF', '#FF7EB0']),
    dash: (ctx, x0, x1) => linear(ctx, x0, 0, x1, 0, ['#A08CFF', '#FF7EB0']),
    pillBg: 'rgba(255,255,255,0.06)',
    pillStroke: 'rgba(255,255,255,0.12)',
    glow: 'rgba(148,121,255,0.5)',
    grain: 0.06,
    grainOp: 'overlay',
  },
  light: {
    bg(ctx, w, h) {
      ctx.fillStyle = '#F8F6FD';
      ctx.fillRect(0, 0, w, h);
      glowAt(ctx, w * 0.08, h * 0.02, w * 0.95, 'rgba(123,97,255,0.22)');
      glowAt(ctx, w * 1.02, h * 0.42, w * 0.75, 'rgba(255,92,157,0.15)');
      glowAt(ctx, w * 0.3, h * 1.04, w * 0.95, 'rgba(177,76,242,0.15)');
    },
    fg: '#0C0B12',
    fg2: '#34323F',
    fg3: '#6C6A7A',
    panel: 'rgba(255,255,255,0.8)',
    panelStroke: 'rgba(20,18,40,0.07)',
    track: 'rgba(20,18,40,0.07)',
    bar: (ctx, x0, x1) => linear(ctx, x0, 0, x1, 0, BRAND),
    accent: (ctx, x0, y0, x1, y1) => linear(ctx, x0, y0, x1, y1, ['#6A4CFF', '#A33EE6', '#E8457F']),
    dash: (ctx, x0, x1) => linear(ctx, x0, 0, x1, 0, BRAND),
    pillBg: 'rgba(255,255,255,0.85)',
    pillStroke: 'rgba(20,18,40,0.08)',
    glow: 'rgba(123,97,255,0.28)',
    grain: 0.035,
    grainOp: 'multiply',
  },
};

/* ---------------------------------------------------------------- Helpers */

function font(ctx: Ctx, weight: number, size: number, family: string, italic = false) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
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

function panel(ctx: Ctx, t: Theme, x: number, y: number, w: number, h: number, r: number) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = t.panel;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = t.panelStroke;
  ctx.stroke();
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

let grainTile: HTMLCanvasElement | null = null;
/**
 * Film grain: hides gradient banding once X/Instagram recompress the image.
 * Coarse (2×2) and quantised so the PNG stays small (~1 MB, not ~3 MB).
 */
function grain(ctx: Ctx, t: Theme, w: number, h: number) {
  if (!grainTile) {
    const N = 96;
    grainTile = document.createElement('canvas');
    grainTile.width = grainTile.height = N * 2;
    const g = grainTile.getContext('2d');
    if (!g) return;
    const img = g.createImageData(N * 2, N * 2);
    let seed = 1234567;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const v = [0, 96, 160, 255][seed >>> 30]!;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
          const i = ((y * 2 + dy) * N * 2 + (x * 2 + dx)) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
      }
    }
    g.putImageData(img, 0, 0);
  }
  const pattern = ctx.createPattern(grainTile, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = t.grain;
  ctx.globalCompositeOperation = t.grainOp;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

const LOGO_BOOKMARK = 'M44 24h44a7 7 0 0 1 7 7v71.2a3.2 3.2 0 0 1-5 2.6L66 88 42 104.8a3.2 3.2 0 0 1-5-2.6V31a7 7 0 0 1 7-7z';
const LOGO_SPARK = 'M53 41.5Q66 51.5 79 41.5Q69 54.5 79 67.5Q66 57.5 53 67.5Q63 54.5 53 41.5Z';

/** The twtdash mark (same geometry as components/Brand.tsx). */
function drawLogo(ctx: Ctx, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 128, size / 128);
  roundRect(ctx, 0, 0, 128, 128, 30);
  ctx.fillStyle = linear(ctx, 0, 0, 128, 128, BRAND);
  ctx.fill();
  roundRect(ctx, 0, 0, 128, 64, 30);
  ctx.fillStyle = linear(ctx, 0, 0, 0, 64, ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']);
  ctx.fill();
  ctx.save();
  ctx.translate(59, 64);
  ctx.rotate((-10 * Math.PI) / 180);
  ctx.translate(-59, -64);
  roundRect(ctx, 31, 27, 56, 74, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.fill(new Path2D(LOGO_BOOKMARK));
  ctx.fillStyle = linear(ctx, 53, 41.5, 79, 67.5, ['#6D4BFF', '#E0479A']);
  ctx.fill(new Path2D(LOGO_SPARK));
  ctx.restore();
}

const MONO = [
  ['#7B61FF', '#22D3EE'],
  ['#F97316', '#EC4899'],
  ['#10B981', '#3B82F6'],
  ['#EAB308', '#F97316'],
  ['#A855F7', '#EC4899'],
  ['#06B6D4', '#6366F1'],
] as const;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
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

function drawAvatar(ctx: Ctx, cx: number, cy: number, r: number, name: string, handle: string, bitmap: ImageBitmap | null | undefined, ring: string) {
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
    const [a, b] = MONO[hash(handle || name) % MONO.length]!;
    ctx.fillStyle = linear(ctx, cx - r, cy - r, cx + r, cy + r, [a, b]);
    ctx.fill();
    ctx.fillStyle = '#fff';
    font(ctx, 600, Math.round(r * 0.78), SANS);
    tracking(ctx, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initialsOf(name || handle), cx, cy + r * 0.04);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = ring;
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

/** Load the brand faces (and the glyph subsets `sample` needs) before drawing. */
function loadFonts(sample: string): Promise<void> {
  const key = sample;
  let p = fontsReady.get(key);
  if (!p) {
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    p = fonts?.load
      ? Promise.race([
          Promise.all([
            fonts.load('600 64px "Geist Variable"', sample),
            fonts.load('400 64px "Geist Variable"', sample),
            fonts.load('500 64px "Geist Variable"', sample),
            fonts.load('italic 400 120px "Instrument Serif"', sample),
            fonts.load('400 120px "Instrument Serif"', '0123456789,.%AMP '),
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

function periodPill(s: WrappedStats): string {
  if (s.period === 'year') return `${s.label} Wrapped`;
  if (s.period === '12m') return '12-month Wrapped';
  if (s.period === '30d') return '30-day Wrapped';
  return 'All-time Wrapped';
}

function compactNumber(n: number): string {
  if (n < 100_000) return new Intl.NumberFormat().format(n);
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** Draw the share card. Exported for tests and custom exports. */
export function drawShareCard(canvas: HTMLCanvasElement, s: WrappedStats, opts: ShareOptions, avatars: Map<string, ImageBitmap | null> = new Map()) {
  const { w: W, h: H } = SHARE_SIZES[opts.format];
  const story = opts.format === 'story';
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas is not available');
  const t = THEMES[opts.theme];
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  if ('fontKerning' in ctx) ctx.fontKerning = 'normal';

  t.bg(ctx, W, H);
  grain(ctx, t, W, H);

  const P = 84;
  const CW = W - P * 2;
  const top = story ? 128 : 80;
  const bottom = story ? 124 : 76;

  // Header ------------------------------------------------------------
  const headerH = 64;
  const drawHeader = (y: number) => {
    drawLogo(ctx, P, y, 64);
    font(ctx, 600, 42, SANS);
    tracking(ctx, -1.2);
    const base = y + 46;
    ctx.fillStyle = t.fg;
    ctx.fillText('twt', P + 84, base);
    const tw = ctx.measureText('twt').width;
    const dw = ctx.measureText('dash').width;
    ctx.fillStyle = t.dash(ctx, P + 84 + tw, P + 84 + tw + dw);
    ctx.fillText('dash', P + 84 + tw, base);
    // Period pill
    font(ctx, 600, 23, SANS);
    tracking(ctx, 3.5);
    const label = periodPill(s).toUpperCase();
    const lw = ctx.measureText(label).width;
    const pw = lw + 48;
    const px = W - P - pw;
    roundRect(ctx, px, y + 6, pw, 52, 26);
    ctx.fillStyle = t.pillBg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = t.pillStroke;
    ctx.stroke();
    ctx.fillStyle = t.fg;
    ctx.fillText(label, px + 24 + 1.75, y + 41);
    tracking(ctx, 0);
  };

  // Persona -------------------------------------------------------------
  const persona = s.persona;
  const eyebrow = (opts.handle ? `@${opts.handle.replace(/^@/, '')} · my bookmark persona` : 'My bookmark persona').toUpperCase();
  const emojiSize = story ? 120 : 100;
  const nameFit = fitWrap(ctx, persona.name, CW, 2, story ? 148 : 128, story ? 92 : 80, (sz) => {
    font(ctx, 400, sz, SERIF, true);
    tracking(ctx, -sz * 0.012);
  });
  const nameLH = Math.round(nameFit.size * 0.98);
  font(ctx, 400, story ? 38 : 33, SANS);
  tracking(ctx, -0.3);
  const lineLines = wrap(ctx, persona.line, CW - 20, 2);
  const lineLH = story ? 52 : 45;
  const personaH = 30 + 26 + emojiSize + 18 + nameLH * nameFit.lines.length + 22 + lineLH * lineLines.length;
  const drawPersona = (y: number) => {
    font(ctx, 600, 24, SANS);
    tracking(ctx, 4);
    ctx.fillStyle = t.fg3;
    ctx.fillText(ellipsize(ctx, eyebrow, CW), P, y + 24);
    tracking(ctx, 0);
    // Emoji with a soft glow
    const ey = y + 30 + 26;
    glowAt(ctx, P + emojiSize * 0.55, ey + emojiSize * 0.5, emojiSize * 1.05, t.glow);
    font(ctx, 400, emojiSize, EMOJI);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = t.fg;
    ctx.fillText(persona.emoji, P, ey + emojiSize * 0.54);
    ctx.textBaseline = 'alphabetic';
    // Name
    font(ctx, 400, nameFit.size, SERIF, true);
    tracking(ctx, -nameFit.size * 0.012);
    let ny = ey + emojiSize + 18 + nameFit.size * 0.8;
    for (const line of nameFit.lines) {
      const lw = ctx.measureText(line).width;
      ctx.fillStyle = t.accent(ctx, P, ny - nameFit.size, P + Math.max(lw, 400), ny);
      ctx.fillText(line, P - 2, ny);
      ny += nameLH;
    }
    tracking(ctx, 0);
    // One-liner
    font(ctx, 400, story ? 38 : 33, SANS);
    tracking(ctx, -0.3);
    ctx.fillStyle = t.fg2;
    let ly = ey + emojiSize + 18 + nameLH * nameFit.lines.length + 22 + lineLH * 0.72;
    for (const l of lineLines) {
      ctx.fillText(l, P, ly);
      ly += lineLH;
    }
    tracking(ctx, 0);
  };

  // Key numbers ----------------------------------------------------------
  const tiles: Array<{ value: string; label: string }> = [
    { value: compactNumber(s.total), label: s.total === 1 ? 'post saved' : 'posts saved' },
    { value: s.streak ? String(s.streak.days) : '—', label: s.streak && s.streak.days === 1 ? 'day streak' : 'day streak' },
    { value: s.busiestHour ? s.busiestHour.label : '—', label: 'peak hour' },
  ];
  const tileH = story ? 196 : 180;
  const drawTiles = (y: number) => {
    const gap = 20;
    const tw = (CW - gap * 2) / 3;
    tiles.forEach((tile, i) => {
      const x = P + i * (tw + gap);
      panel(ctx, t, x, y, tw, tileH, 36);
      const size = fitSize(ctx, tile.value, tw - 56, story ? 100 : 92, 48, (sz) => {
        font(ctx, 400, sz, SERIF);
        tracking(ctx, -sz * 0.01);
      });
      ctx.fillStyle = t.fg;
      ctx.fillText(tile.value, x + 28, y + 30 + size * 0.78);
      tracking(ctx, 0);
      font(ctx, 500, story ? 25 : 23, SANS);
      ctx.fillStyle = t.fg3;
      ctx.fillText(tile.label, x + 30, y + tileH - 34);
    });
  };

  // Lists ------------------------------------------------------------------
  const showAuthors = !opts.hideAuthors && s.authors.length > 0;
  const rowH = story ? 72 : 66;
  const sectionLabel = (text: string, x: number, y: number) => {
    font(ctx, 600, 22, SANS);
    tracking(ctx, 4);
    ctx.fillStyle = t.fg3;
    ctx.fillText(text.toUpperCase(), x, y + 22);
    tracking(ctx, 0);
  };
  const maxShare = s.categories[0]?.share || 1;
  const drawCategories = (x: number, y: number, w: number, rows: number) => {
    sectionLabel('Top categories', x, y);
    let ry = y + 52;
    for (const c of s.categories.slice(0, rows)) {
      font(ctx, 400, 32, EMOJI);
      ctx.fillStyle = t.fg;
      ctx.fillText(c.emoji, x, ry + 32);
      const pctText = `${Math.max(1, Math.round(c.share * 100))}%`;
      font(ctx, 600, 26, SANS);
      const pw = ctx.measureText(pctText).width;
      ctx.fillStyle = t.fg2;
      ctx.fillText(pctText, x + w - pw, ry + 31);
      font(ctx, 500, 28, SANS);
      tracking(ctx, -0.3);
      ctx.fillStyle = t.fg;
      ctx.fillText(ellipsize(ctx, c.name, w - 56 - pw - 20), x + 54, ry + 31);
      tracking(ctx, 0);
      // Bar
      const by = ry + 46;
      roundRect(ctx, x + 54, by, w - 54, 9, 4.5);
      ctx.fillStyle = t.track;
      ctx.fill();
      const bw = Math.max(14, (w - 54) * (c.share / maxShare));
      roundRect(ctx, x + 54, by, bw, 9, 4.5);
      ctx.fillStyle = t.bar(ctx, x + 54, x + w);
      ctx.fill();
      ry += rowH;
    }
  };
  const drawAuthors = (x: number, y: number, w: number, rows: number) => {
    sectionLabel('Most saved accounts', x, y);
    let ry = y + 52;
    for (const a of s.authors.slice(0, rows)) {
      const r = 25;
      drawAvatar(ctx, x + r, ry + 26, r, a.name, a.handle, avatars.get(a.avatar), t.panelStroke);
      const count = compactNumber(a.count);
      font(ctx, 600, 26, SANS);
      const cw = ctx.measureText(count).width;
      ctx.fillStyle = t.fg2;
      ctx.fillText(count, x + w - cw, ry + 24);
      font(ctx, 500, 27, SANS);
      tracking(ctx, -0.3);
      ctx.fillStyle = t.fg;
      ctx.fillText(ellipsize(ctx, a.name || a.handle, w - 2 * r - 20 - cw - 16), x + 2 * r + 18, ry + 22);
      tracking(ctx, 0);
      font(ctx, 400, 21, SANS);
      ctx.fillStyle = t.fg3;
      ctx.fillText(ellipsize(ctx, `@${a.handle}`, w - 2 * r - 20 - cw - 16), x + 2 * r + 18, ry + 50);
      ry += rowH;
    }
  };

  const facts = s.funFacts.filter((f) => !opts.hideAuthors || !f.mentionsAuthor);
  const factBlock = (count: number): Block | null => {
    const list = facts.slice(0, count);
    if (!list.length) return null;
    font(ctx, 500, 29, SANS);
    const wrapped = list.map((f) => wrap(ctx, f.text, CW - 64 - 52, 2));
    const h = 40 + wrapped.reduce((a, l) => a + l.length * 40, 0) + (list.length - 1) * 26;
    return {
      h,
      gap: 0.8,
      draw: (y) => {
        panel(ctx, t, P, y, CW, h, 36);
        let fy = y + 20;
        list.forEach((f, i) => {
          font(ctx, 400, 30, EMOJI);
          ctx.fillStyle = t.fg;
          ctx.fillText(f.emoji, P + 32, fy + 32);
          font(ctx, 500, 29, SANS);
          tracking(ctx, -0.2);
          ctx.fillStyle = t.fg2;
          wrapped[i]!.forEach((l, j) => ctx.fillText(l, P + 32 + 52, fy + 31 + j * 40));
          tracking(ctx, 0);
          fy += wrapped[i]!.length * 40 + 26;
        });
      },
    };
  };

  // Footer ------------------------------------------------------------------
  const footerH = 44;
  const drawFooter = (y: number) => {
    ctx.fillStyle = t.panelStroke;
    ctx.fillRect(P, y - 30, CW, 2);
    drawLogo(ctx, P, y + 4, 38);
    font(ctx, 600, 27, SANS);
    tracking(ctx, -0.2);
    ctx.fillStyle = t.fg;
    ctx.fillText(WRAPPED_SITE.replace(/^https?:\/\//, ''), P + 54, y + 33);
    font(ctx, 500, 24, SANS);
    tracking(ctx, 0);
    const cta = 'Get your own Wrapped — free';
    const cw = ctx.measureText(cta).width;
    ctx.fillStyle = t.fg3;
    ctx.fillText(cta, W - P - cw, y + 32);
  };

  // Layout ------------------------------------------------------------------
  // Try richer layouts first and keep the first one that fits; leftover space
  // is shared out between the gaps so every card feels composed, not crammed.
  const listH = (rows: number) => 52 + rows * rowH - 14;
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
    const colW = (CW - 56) / 2;
    return {
      h: listH(n),
      gap: 0.9,
      draw: (y) => {
        drawCategories(P, y, colW, Math.min(n, s.categories.length));
        drawAuthors(P + colW + 56, y, colW, Math.min(n, s.authors.length));
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

  const avail = H - top - bottom - headerH - footerH - 56; // keep air above the footer rule
  const minGap = story ? 44 : 28;
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
  const fallback = { format: 'feed' as ShareFormat, theme: 'gradient' as ShareTheme, hideAuthors: false };
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<ShareOptions> | null;
    return {
      format: raw?.format === 'story' ? 'story' : 'feed',
      theme: raw?.theme === 'dark' || raw?.theme === 'light' ? raw.theme : 'gradient',
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

const THEME_SWATCH: Record<ShareTheme, { label: string; style: string }> = {
  gradient: { label: 'Gradient', style: 'linear-gradient(135deg, #7B61FF, #B14CF2 55%, #FF5C9D)' },
  dark: { label: 'Dark', style: 'radial-gradient(80% 80% at 20% 10%, #4b3a9e, #0b0a12 70%)' },
  light: { label: 'Light', style: 'radial-gradient(80% 80% at 20% 10%, #e3dcff, #faf9fd 70%)' },
};

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ id: T; label: string; hint?: string }>; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-white/10 p-1 ring-1 ring-white/15">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-3 text-[12.5px] font-medium whitespace-nowrap transition-colors',
            value === o.id ? 'bg-white text-[#14102a] shadow-sm' : 'text-white/75 hover:text-white',
          )}
        >
          {o.label}
          {o.hint ? <span className={cn('text-[11px]', value === o.id ? 'text-[#14102a]/55' : 'text-white/45')}>{o.hint}</span> : null}
        </button>
      ))}
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
      toast.success('Image copied', { description: 'Paste it anywhere — a post, a story or a chat.' });
    } else toast.error('Couldn’t copy the image', { description: 'Your browser blocked it — use Download instead.' });
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
    toast.success(copied ? 'Image copied — paste it into your post' : 'Image downloaded — attach it to your post', {
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

  const primaryBtn = 'inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 text-[15px] font-semibold text-[#14102a] shadow-[0_18px_40px_-16px_rgb(0_0_0/0.6)] transition-[transform,filter] hover:brightness-95 active:scale-[0.98] disabled:opacity-60';
  const ghostBtn = 'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-[13.5px] font-medium text-white ring-1 ring-white/15 transition-colors hover:bg-white/16 disabled:opacity-50 [&_svg]:size-4';

  return (
    <div className={cn('grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] md:gap-10', className)}>
      <figure className="flex min-w-0 justify-center">
        <div
          className="relative overflow-hidden rounded-[22px] bg-white/5 shadow-[0_40px_90px_-30px_rgb(0_0_0/0.75)] ring-1 ring-white/15 transition-[aspect-ratio,height] duration-300"
          style={{ aspectRatio: `${size.w} / ${size.h}`, height: opts.format === 'story' ? 'min(64vh, 560px)' : 'min(56vh, 500px)', maxWidth: '100%' }}
        >
          {preview ? <img src={preview.url} alt={`Preview of your Wrapped card: ${stats.persona.name}, ${stats.total} saves`} className={cn('size-full object-contain transition-opacity duration-200', !ready && 'opacity-60')} /> : null}
          {!ready && !failed ? (
            <div className="absolute inset-0 grid place-items-center">
              <LoaderCircle className="size-6 animate-spin text-white/80" aria-label="Rendering image" />
            </div>
          ) : null}
          {failed ? <div className="absolute inset-0 grid place-items-center p-6 text-center text-[13px] text-white/80">Couldn’t draw the image in this browser.</div> : null}
        </div>
        <figcaption className="sr-only">
          {size.label} image, {size.w} by {size.h} pixels
        </figcaption>
      </figure>

      <div className="flex min-w-0 flex-col gap-4" data-no-tap>
        <div className="space-y-2">
          <div className="text-[11px] font-semibold tracking-[0.14em] text-white/60 uppercase">Size</div>
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
          <div className="text-[11px] font-semibold tracking-[0.14em] text-white/60 uppercase">Style</div>
          <div role="radiogroup" aria-label="Card style" className="grid grid-cols-3 gap-2">
            {(Object.keys(THEME_SWATCH) as ShareTheme[]).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={prefs.theme === id}
                onClick={() => setPrefs((p) => ({ ...p, theme: id }))}
                className={cn('group flex flex-col items-center gap-1.5 rounded-xl p-1.5 text-[12px] font-medium transition-colors', prefs.theme === id ? 'bg-white/14 text-white ring-2 ring-white' : 'text-white/70 ring-1 ring-white/15 hover:bg-white/8 hover:text-white')}
              >
                <span className="relative h-9 w-full rounded-lg ring-1 ring-black/10" style={{ background: THEME_SWATCH[id].style }}>
                  {prefs.theme === id ? <Check className={cn('absolute top-1/2 left-1/2 size-4 -translate-1/2', id === 'light' ? 'text-[#14102a]' : 'text-white')} strokeWidth={3} /> : null}
                </span>
                {THEME_SWATCH[id].label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white/8 px-3.5 py-3 ring-1 ring-white/12">
          <span>
            <span className="block text-[13.5px] font-medium text-white">Hide author names</span>
            <span className="block text-[12px] text-white/60">Keep other accounts off your image</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.hideAuthors}
            onClick={() => setPrefs((p) => ({ ...p, hideAuthors: !p.hideAuthors }))}
            className={cn('relative inline-flex h-[24px] w-[42px] shrink-0 items-center rounded-full transition-colors', prefs.hideAuthors ? 'bg-white' : 'bg-white/20')}
          >
            <span className="sr-only">Hide author names</span>
            <span className={cn('block size-[18px] rounded-full shadow-sm transition-transform duration-200', prefs.hideAuthors ? 'translate-x-[21px] bg-[#7B61FF]' : 'translate-x-[3px] bg-white')} />
          </button>
        </label>

        <div className="mt-1 flex flex-col gap-2.5">
          {nativePrimary ? (
            <button type="button" className={primaryBtn} onClick={() => void onNativeShare()} disabled={!!busy}>
              {busy === 'share' ? <LoaderCircle className="size-5 animate-spin" /> : <Share2 className="size-5" />} Share image
            </button>
          ) : null}
          <button type="button" className={nativePrimary ? cn(ghostBtn, 'h-12 w-full flex-none text-[14.5px]') : primaryBtn} onClick={() => void onShareX()} disabled={!!busy}>
            {busy === 'x' ? <LoaderCircle className="size-5 animate-spin" /> : <XLogo className="size-[18px]" />} Share on X
          </button>
          <div className="flex gap-2">
            {copyable ? (
              <button type="button" className={ghostBtn} onClick={() => void onCopy()} disabled={!!busy}>
                {busy === 'copy' ? <LoaderCircle className="animate-spin" /> : copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy image'}
              </button>
            ) : null}
            <Menu>
              <MenuTrigger asChild>
                <button type="button" className={ghostBtn} disabled={!!busy}>
                  {busy === 'download' ? <LoaderCircle className="animate-spin" /> : <Download />} Download <ChevronDown className="!size-3.5 opacity-70" />
                </button>
              </MenuTrigger>
              <MenuContent align="end" className="min-w-[230px]">
                <MenuItem onSelect={() => void onDownload(opts.format)}>
                  <Download /> This size <span className="ml-auto text-[11px] text-faint">{`${size.w}×${size.h}`}</span>
                </MenuItem>
                <MenuItem onSelect={() => void onDownload('both')}>
                  <Download /> Both sizes <span className="ml-auto text-[11px] text-faint">feed + story</span>
                </MenuItem>
              </MenuContent>
            </Menu>
            {native && !nativePrimary ? (
              <button type="button" className={cn(ghostBtn, 'flex-none px-3.5')} onClick={() => void onNativeShare()} disabled={!!busy} aria-label="More sharing options">
                {busy === 'share' ? <LoaderCircle className="animate-spin" /> : <Share2 />}
              </button>
            ) : null}
          </div>
          <p className="text-[12px] leading-relaxed text-white/55">Your image is made on this device. Nothing is uploaded — you choose where it goes.</p>
        </div>
      </div>
    </div>
  );
}
